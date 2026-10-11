'use strict';
const {fs,path,check,crypto}=require('./common.cjs');
const uploadMemory=require('./staging-budget.cjs').stagingBudget(128*1024*1024);
async function readPart(file,start,length){const fd=await fs.promises.open(file,'r'),buffer=Buffer.alloc(length);try{let read=0;while(read<length){const result=await fd.read(buffer,read,length-read,start+read);if(!result.bytesRead)throw Error('上传缓存文件不完整');read+=result.bytesRead}return buffer}finally{await fd.close()}}

// Checkpoints only acknowledge completed parts. Lost acknowledgements re-send at most a part.
async function multipartUpload({file,identity,driver,partSize=16*1024*1024,...options}){
 const size=fs.statSync(file).size,signature=options.sha256||await require('./common.cjs').hash(file);
 partSize=Math.max(partSize,Math.ceil(size/10000));
 let cp=options.checkpoint?.multipart;
 const persist=()=>options.onCheckpoint?.({multipart:cp});
 if(cp&&(cp.identity!==identity||cp.size!==size||cp.sha256!==signature))throw Error('上传续传记录与当前文件不一致');
 if(cp){
  try{const remote=await driver.list(cp.id,options.signal);const byNumber=new Map(remote.map(p=>[p.number,p]));
   for(const [n,p]of Object.entries(cp.parts)){const r=byNumber.get(Number(n));if(!r)delete cp.parts[n];else if(r.etag!==p.etag||r.size!==p.size)throw Error('上传分片在云端发生变化')}
   persist();
  }catch(error){if(error.code!=='NoSuchUpload'&&error.name!=='NoSuchUpload')throw error;if(cp.completing){if(driver.verifyCompleted&&await driver.verifyCompleted(signature,size,options.signal)){options.onCheckpoint?.({multipart:null});options.onProgress?.({current:size,total:size});return}throw Error('上传结果尚未确认，请核对目标文件后重试')}cp=null;options.onCheckpoint?.({multipart:null})}
 }
 if(!cp){check(options.signal);cp={identity,size,sha256:signature,partSize,id:await driver.create(options.signal),parts:{}};persist()}
 const count=Math.ceil(size/cp.partSize);let cursor=0;
 const controller=new AbortController(),abort=()=>controller.abort();options.signal?.addEventListener('abort',abort,{once:true});if(options.signal?.aborted)abort();
 let error;const report=(resumed=false)=>options.onProgress?.({current:Object.values(cp.parts).reduce((n,p)=>n+p.size,0),total:size,resumed});report(true);
 async function worker(){while(cursor<count&&!controller.signal.aborted){const n=++cursor;if(cp.parts[n])continue;try{check(controller.signal);const start=(n-1)*cp.partSize,length=Math.min(cp.partSize,size-start),release=await uploadMemory.acquire(length,controller.signal);try{const body=await readPart(file,start,length);const etag=await driver.part(cp.id,n,body,controller.signal);cp.parts[n]={etag,size:body.length};persist();report()}finally{release()}}catch(e){error||=e;controller.abort()}}}
 try{await Promise.allSettled(Array.from({length:Math.max(1,Math.min(4,options.streams||2,count))},worker));if(error)throw error;check(options.signal);
  const parts=Object.entries(cp.parts).map(([number,p])=>({number:Number(number),etag:p.etag})).sort((a,b)=>a.number-b.number);
  if(parts.length!==count)throw Error('上传分片不完整');cp.completing=true;persist();await driver.complete(cp.id,parts,options.signal);options.onCheckpoint?.({multipart:null});options.onProgress?.({current:size,total:size});
 }finally{options.signal?.removeEventListener('abort',abort)}
}
function section(config,remote){const text=fs.readFileSync(config,'utf8'),block=text.split(/^\[/m).find(s=>s.startsWith(remote+']'));if(!block)throw Error('请先连接网盘');const entries={};for(const line of block.split('\n').slice(1)){const m=/^([a-z_]+)\s*=\s*(.*)$/.exec(line.trim());if(m)entries[m[1]]=m[2]}return entries}
async function s3Upload({config,meta,ref,file,...options}){
 const sdk=require('@aws-sdk/client-s3'),c=section(config,'s3');
 const pool=require('./client-pool.cjs'),poolKey=crypto.createHash('sha256').update(JSON.stringify(c)).digest('hex');const client=pool.getClient(poolKey,()=>new sdk.S3Client({region:c.region||'us-east-1',...(c.endpoint?{endpoint:c.endpoint}:{}),forcePathStyle:c.force_path_style!=='false',credentials:{accessKeyId:c.access_key_id,secretAccessKey:c.secret_access_key,...(c.session_token?{sessionToken:c.session_token}:{})},requestChecksumCalculation:'WHEN_REQUIRED',responseChecksumValidation:'WHEN_REQUIRED',maxAttempts:3}));const release=pool.retain(poolKey);
 const signature=options.sha256||await require('./common.cjs').hash(file);options.sha256=signature;const base={Bucket:meta.bucket,Key:path.posix.join(ref.path,path.basename(file)).slice(1)},send=(Command,input,signal)=>client.send(new Command({...base,...input}),{abortSignal:signal});
 const driver={
  create:async signal=>(await send(sdk.CreateMultipartUploadCommand,{Metadata:{'wemove-sha256':signature}},signal)).UploadId,
  part:async(id,n,body,signal)=>(await send(sdk.UploadPartCommand,{UploadId:id,PartNumber:n,Body:body,ContentLength:body.length,ContentMD5:crypto.createHash('md5').update(body).digest('base64')},signal)).ETag,
  list:async(id,signal)=>{let marker,parts=[];do{const page=await send(sdk.ListPartsCommand,{UploadId:id,...(marker?{PartNumberMarker:marker}:{})},signal);parts.push(...(page.Parts||[]).map(p=>({number:p.PartNumber,etag:p.ETag,size:p.Size})));marker=page.IsTruncated?page.NextPartNumberMarker:undefined}while(marker);return parts},
  verifyCompleted:async(hash,size,signal)=>{try{const head=await send(sdk.HeadObjectCommand,{},signal);return Number(head.ContentLength)===size&&head.Metadata?.['wemove-sha256']===hash}catch(e){if(e.$metadata?.httpStatusCode===404)return false;throw e}},
  complete:async(id,parts,signal)=>send(sdk.CompleteMultipartUploadCommand,{UploadId:id,IfNoneMatch:'*',MultipartUpload:{Parts:parts.map(p=>({PartNumber:p.number,ETag:p.etag}))}},signal)
 };
 try{await multipartUpload({file,identity:JSON.stringify([meta.id,base.Bucket,base.Key]),driver,partSize:options.chunkSize||16*1024*1024,...options})}catch(error){if(error.name==='NoSuchUpload')error.code='NoSuchUpload';throw error}finally{release()}
}
function validUploadURL(raw){try{const u=new URL(raw);return u.protocol==='https:'&&!u.username&&!u.password&&['microsoft.com','sharepoint.com','1drv.com','onedrive.com','live.com'].some(d=>u.hostname===d||u.hostname.endsWith('.'+d))}catch{return false}}
async function oneDriveUpload({config,ref,file,request=fetch,...options}){
 const c=section(config,'onedrive'),token=JSON.parse(c.token||'{}');if(!token.access_token||!c.drive_id)throw Error('授权已失效，请重新连接 OneDrive');
 const size=fs.statSync(file).size,sha256=options.sha256||await require('./common.cjs').hash(file),identity=JSON.stringify([c.drive_id,ref.path,path.basename(file)]);
 let cp=options.checkpoint?.oneDriveUpload;
 async function call(url,init={}){const response=await request(url,{...init,signal:options.signal?AbortSignal.any([options.signal,AbortSignal.timeout(120000)]):AbortSignal.timeout(120000),redirect:'error'});if(!response.ok){const e=Error('OneDrive 上传请求失败：HTTP '+response.status);e.status=response.status;throw e}return response.json()}
 const persist=()=>options.onCheckpoint?.({oneDriveUpload:cp});
 if(cp&&(cp.identity!==identity||cp.size!==size||cp.sha256!==sha256||!validUploadURL(cp.url)))throw Error('上传续传记录与当前文件不一致');
 let state;
 if(cp)try{state=await call(cp.url);if(!state.nextExpectedRanges){if(!state.id||Number(state.size)!==size)throw Error('OneDrive 上传回执无效');options.onCheckpoint?.({oneDriveUpload:null});return}}catch(e){if(![404,410].includes(e.status))throw e;if(cp.finalSent){const segments=path.posix.join(ref.path,path.basename(file)).split('/').filter(Boolean).map(encodeURIComponent).join('/');let remote;try{remote=await call('https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(c.drive_id)+'/root:/'+segments,{headers:{Authorization:'Bearer '+token.access_token}})}catch(error){if(error.status!==404)throw error}const hashes=remote?.file?.hashes;if(remote&&Number(remote.size)===size&&hashes?.sha1Hash){const local=await require('./hash-service.cjs').fileHashes(file,{signal:options.signal});if(local.sha1===hashes.sha1Hash.toLowerCase()){options.onCheckpoint?.({oneDriveUpload:null});options.onProgress?.({current:size,total:size});return}}throw Error('上传结果尚未确认，请核对目标文件后重试')}cp=null}
 if(!cp){const segments=path.posix.join(ref.path,path.basename(file)).split('/').filter(Boolean).map(encodeURIComponent).join('/');state=await call('https://graph.microsoft.com/v1.0/drives/'+encodeURIComponent(c.drive_id)+'/root:/'+segments+':/createUploadSession',{method:'POST',headers:{Authorization:'Bearer '+token.access_token,'Content-Type':'application/json'},body:JSON.stringify({item:{'@microsoft.graph.conflictBehavior':'fail',name:path.basename(file)}})});if(!validUploadURL(state.uploadUrl))throw Error('OneDrive 返回无效上传地址');cp={identity,size,sha256,url:state.uploadUrl,expires:state.expirationDateTime};state.nextExpectedRanges||=['0-'];persist()}
 const chunk=20*1024*1024;let first=true;
 while(state.nextExpectedRanges?.length){check(options.signal);const starts=state.nextExpectedRanges.map(r=>Number(r.split('-')[0]));if(starts.some(n=>!Number.isSafeInteger(n)||n<0||n>=size||n%(320*1024)!==0))throw Error('OneDrive 返回无效续传范围');const start=Math.min(...starts),length=Math.min(chunk,size-start);
  options.onProgress?.({current:start,total:size,resumed:first});first=false;const body=await readPart(file,start,length);
  if(start+length===size){cp.finalSent=true;persist()}
  try{state=await call(cp.url,{method:'PUT',headers:{'Content-Length':String(length),'Content-Range':`bytes ${start}-${start+length-1}/${size}`},body})}catch(error){if(error.status!==416)throw error;state=await call(cp.url);continue}
  cp.expires=state.expirationDateTime||cp.expires;persist();
 }
 if(!state.id||Number(state.size)!==size)throw Error('OneDrive 上传回执无效');options.onCheckpoint?.({oneDriveUpload:null});options.onProgress?.({current:size,total:size});
}
module.exports={multipartUpload,s3Upload,oneDriveUpload,validUploadURL,section};

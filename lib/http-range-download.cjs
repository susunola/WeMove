'use strict';
const {fs,path,atomic,check}=require('./common.cjs');
async function httpRangeDownload(file,o){
 const {size,identity,getURL,signal,onProgress,throttle,request=fetch}=o;
 if(!Number.isSafeInteger(size)||size<0)throw Error('下载大小无效');
 fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 const journal=file+'.http-ranges.json';let state={identity,size,chunk:o.chunkSize||16*1024**2,done:[]};
 if(fs.existsSync(journal)){
  state=JSON.parse(fs.readFileSync(journal));
  if(state.identity!==identity||state.size!==size||!Number.isSafeInteger(state.chunk)||state.chunk<1||!Array.isArray(state.done))throw Error('分段下载源信息发生变化');
 }else{
  if(fs.existsSync(file)&&fs.lstatSync(file).isSymbolicLink())throw Error('缓存文件类型无效');
  fs.writeFileSync(file,'',{mode:0o600});fs.truncateSync(file,size);atomic(journal,state);
 }
 if(!fs.existsSync(file)||fs.lstatSync(file).isSymbolicLink()||!fs.lstatSync(file).isFile()||fs.statSync(file).size!==size)throw Error('缓存文件类型或大小无效');
 const count=Math.ceil(size/state.chunk),done=new Set(state.done);
 if([...done].some(i=>!Number.isInteger(i)||i<0||i>=count))throw Error('分段下载记录损坏');
 let cursor=0,error;const controller=new AbortController(),combined=signal?AbortSignal.any([signal,controller.signal]):controller.signal;
 const bytes=Array.from({length:count},(_,i)=>done.has(i)?Math.min(state.chunk,size-i*state.chunk):0);
 let total=bytes.reduce((a,b)=>a+b,0);const report=()=>onProgress?.({current:total,total:size});
 onProgress?.({current:total,total:size,resumed:true});
 async function part(i,start,length){
  const attemptController=new AbortController(),attemptSignal=AbortSignal.any([combined,attemptController.signal]);let timer;
  const arm=()=>{clearTimeout(timer);timer=setTimeout(()=>attemptController.abort(Error('ETIMEDOUT: 下载分段长时间没有数据')),o.idleTimeoutMs||120000)};
  try{
   let response;
   for(let renewal=0;renewal<2;renewal++){
    check(combined);const url=await getURL(combined,{force:renewal>0}),u=new URL(url);
    if(u.protocol!=='https:'&&u.hostname!=='127.0.0.1')throw Error('下载地址无效');
    arm();response=await request(url,{headers:{Range:`bytes=${start}-${start+length-1}`},signal:attemptSignal,redirect:'error'});
    if(![401,403].includes(response.status)||renewal===1)break;
    await response.body?.cancel();clearTimeout(timer);
   }
   if(response.status!==206||response.headers.get('content-range')!==`bytes ${start}-${start+length-1}/${size}`){await response.body?.cancel();throw Error('网络：下载分段响应无效 HTTP '+response.status)}
   const fd=await fs.promises.open(file,fs.constants.O_RDWR|fs.constants.O_NOFOLLOW);let received=0;
   try{
    for await(const b of response.body){
     check(attemptSignal);clearTimeout(timer);
     if(received+b.length>length)throw Error('分段返回超出范围');
     // Intentional pacing and disk writes are not network inactivity.
     await throttle?.(b.length,combined);let offset=0;
     while(offset<b.length){const w=await fd.write(b,offset,b.length-offset,start+received+offset);if(!w.bytesWritten)throw Error('缓存写入失败');offset+=w.bytesWritten}
     received+=b.length;total+=b.length;bytes[i]+=b.length;report();arm();
    }
    clearTimeout(timer);if(received!==length)throw Error('网络：分段下载不完整');await fd.sync();
   }finally{await fd.close()}
   done.add(i);state.done=[...done];atomic(journal,state);
  }catch(e){if(attemptController.signal.aborted&&!combined.aborted)throw attemptController.signal.reason;throw e}finally{clearTimeout(timer)}
 }
 async function worker(){
  while(cursor<count&&!combined.aborted){
   const i=cursor++;if(done.has(i))continue;const start=i*state.chunk,length=Math.min(state.chunk,size-start);
   for(let retry=0;retry<=2;retry++){
    try{total-=bytes[i];bytes[i]=0;await part(i,start,length);break}
    catch(e){
     if(!combined.aborted&&require('./failures.cjs').classifyFailure(e).retryable&&retry<2){o.onRetry?.({part:i,attempt:retry+1});await new Promise(r=>setTimeout(r,100*2**retry));continue}
     error||=e;controller.abort();break;
    }
   }
  }
 }
 await Promise.allSettled(Array.from({length:Math.max(1,Math.min(4,o.streams||2))},worker));
 check(signal);if(error)throw error;if(done.size!==count)throw Error('分段下载未完成');fs.unlinkSync(journal);
}
module.exports={httpRangeDownload};

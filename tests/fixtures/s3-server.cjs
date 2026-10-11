'use strict';
// Isolated in-memory S3 test endpoint with SigV4 verification. Never used by the app.
const http=require('node:http'),crypto=require('node:crypto');
const xml=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
const sha=v=>crypto.createHash('sha256').update(v).digest('hex'),hmac=(k,v)=>crypto.createHmac('sha256',k).update(v).digest();
const encode=v=>encodeURIComponent(v).replace(/[!'()*]/g,c=>'%'+c.charCodeAt(0).toString(16).toUpperCase());
function s3Server({accessKey='demo-access',secretKey='demo-secret',bucket='bucket'}={}){
 const objects=new Map(),uploads=new Map();
 const server=http.createServer(async(req,res)=>{
  const u=new URL(req.url,'http://localhost'),auth=req.headers.authorization||'',credential=/Credential=([^, ]+)/.exec(auth)?.[1]||'',signed=/SignedHeaders=([^, ]+)/.exec(auth)?.[1]||'',signature=/Signature=([^, ]+)/.exec(auth)?.[1]||'';
  function send(code,body=''){res.writeHead(code,{'Content-Type':'application/xml'});res.end(body)}
  function fail(code,message){send(code,'<Error><Code>'+xml(message)+'</Code><Message>'+xml(message)+'</Message></Error>')}
  const scope=credential.split('/'),headers=signed.split(';').map(n=>n+':'+String(req.headers[n]||'').trim().replace(/\s+/g,' ')+'\n').join(''),query=[...u.searchParams].sort(([a,av],[b,bv])=>encode(a).localeCompare(encode(b))||encode(av).localeCompare(encode(bv))).map(([k,v])=>encode(k)+'='+encode(v)).join('&');
  const canonical=[req.method,u.pathname,query,headers,signed,req.headers['x-amz-content-sha256']||sha('')].join('\n'),toSign=['AWS4-HMAC-SHA256',req.headers['x-amz-date'],scope.slice(1).join('/'),sha(canonical)].join('\n');
  let key=hmac('AWS4'+secretKey,scope[1]||'');for(const value of scope.slice(2))key=hmac(key,value);const expected=crypto.createHmac('sha256',key).update(toSign).digest('hex');
  if(scope[0]!==accessKey||!signature||signature!==expected)return fail(403,'SignatureDoesNotMatch');
  const parts=decodeURIComponent(u.pathname).split('/').filter(Boolean);if(parts.shift()!==bucket)return fail(404,'NoSuchBucket');
  let objectKey=decodeURIComponent(u.pathname).slice(bucket.length+2);const chunks=[];for await(const buf of req)chunks.push(buf);let bytes=Buffer.concat(chunks);
  if(String(req.headers['content-encoding']).includes('aws-chunked')){const decoded=[];let pos=0;while(pos<bytes.length){const end=bytes.indexOf('\r\n',pos);if(end<0)break;const length=parseInt(bytes.subarray(pos,end).toString().split(';')[0],16);if(!length)break;pos=end+2;decoded.push(bytes.subarray(pos,pos+length));pos+=length+2}bytes=Buffer.concat(decoded)}
  const uploadId=u.searchParams.get('uploadId');
  if(req.method==='POST'&&u.searchParams.has('uploads')){const id=crypto.randomBytes(12).toString('hex');uploads.set(id,{key:objectKey,parts:new Map()});return send(200,'<InitiateMultipartUploadResult><Bucket>'+bucket+'</Bucket><Key>'+xml(objectKey)+'</Key><UploadId>'+id+'</UploadId></InitiateMultipartUploadResult>')}
  if(uploadId){const upload=uploads.get(uploadId);if(!upload||upload.key!==objectKey)return fail(404,'NoSuchUpload');
   if(req.method==='PUT'){const n=Number(u.searchParams.get('partNumber')),etag='"'+crypto.createHash('md5').update(bytes).digest('hex')+'"';if(req.headers['content-md5']!==crypto.createHash('md5').update(bytes).digest('base64'))return fail(400,'BadDigest');upload.parts.set(n,{bytes,etag});res.writeHead(200,{ETag:etag});return res.end()}
   if(req.method==='GET')return send(200,'<ListPartsResult><Bucket>'+bucket+'</Bucket><Key>'+xml(objectKey)+'</Key><UploadId>'+uploadId+'</UploadId><IsTruncated>false</IsTruncated>'+[...upload.parts].sort(([a],[b])=>a-b).map(([n,p])=>'<Part><PartNumber>'+n+'</PartNumber><ETag>'+xml(p.etag)+'</ETag><Size>'+p.bytes.length+'</Size></Part>').join('')+'</ListPartsResult>');
   if(req.method==='DELETE'){uploads.delete(uploadId);return send(204)}
   if(req.method==='POST'){if(req.headers['if-none-match']==='*'&&objects.has(objectKey))return fail(412,'PreconditionFailed');const parts=[...bytes.toString().matchAll(/<Part>.*?<ETag>(.*?)<\/ETag>.*?<PartNumber>(\d+)<\/PartNumber>.*?<\/Part>/g)];if(!parts.length)return fail(400,'MalformedXML');const buffers=[];for(const m of parts){const part=upload.parts.get(Number(m[2]));if(!part||xml(part.etag)!==m[1])return fail(400,'InvalidPart');buffers.push(part.bytes)}const body=Buffer.concat(buffers),etag=crypto.createHash('md5').update(body).digest('hex');objects.set(objectKey,{bytes:body,etag,meta:{},modified:new Date().toISOString()});uploads.delete(uploadId);return send(200,'<CompleteMultipartUploadResult><Bucket>'+bucket+'</Bucket><Key>'+xml(objectKey)+'</Key><ETag>&quot;'+etag+'&quot;</ETag></CompleteMultipartUploadResult>')}
  }
  if(req.method==='GET'&&(!objectKey||u.searchParams.has('list-type'))){const prefix=u.searchParams.get('prefix')||'',delimiter=u.searchParams.get('delimiter')||'',contents=[],dirs=new Set();for(const [k,obj]of objects){if(!k.startsWith(prefix))continue;const suffix=k.slice(prefix.length);if(delimiter&&suffix.includes(delimiter)){dirs.add(prefix+suffix.slice(0,suffix.indexOf(delimiter)+delimiter.length));continue}contents.push('<Contents><Key>'+xml(k)+'</Key><LastModified>'+obj.modified+'</LastModified><ETag>&quot;'+obj.etag+'&quot;</ETag><Size>'+obj.bytes.length+'</Size><StorageClass>STANDARD</StorageClass></Contents>')}return send(200,'<ListBucketResult xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Name>'+bucket+'</Name><Prefix>'+xml(prefix)+'</Prefix><KeyCount>'+(contents.length+dirs.size)+'</KeyCount><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated>'+contents.join('')+[...dirs].map(p=>'<CommonPrefixes><Prefix>'+xml(p)+'</Prefix></CommonPrefixes>').join('')+'</ListBucketResult>')}
  if(req.method==='HEAD'&&!objectKey)return send(200);
  if(req.method==='PUT'){
   const source=req.headers['x-amz-copy-source'];let meta=Object.fromEntries(Object.entries(req.headers).filter(([k])=>k.startsWith('x-amz-meta-')));
   if(source){const original=objects.get(decodeURIComponent(source).replace(/^\/?[^/]+\//,''));if(!original)return fail(404,'NoSuchKey');bytes=original.bytes;if(req.headers['x-amz-metadata-directive']!=='REPLACE')meta=original.meta}
   const obj={bytes,meta,etag:crypto.createHash('md5').update(bytes).digest('hex'),modified:new Date().toISOString()};objects.set(objectKey,obj);
   if(source)return send(200,'<CopyObjectResult><LastModified>'+obj.modified+'</LastModified><ETag>&quot;'+obj.etag+'&quot;</ETag></CopyObjectResult>');res.writeHead(200,{ETag:'"'+obj.etag+'"'});return res.end();
  }
  if(req.method==='DELETE'){objects.delete(objectKey);return send(204)}
  if(req.method==='POST'&&u.searchParams.has('delete')){const keys=[...bytes.toString().matchAll(/<Key>([^<]*)<\/Key>/g)].map(x=>x[1].replace(/&amp;/g,'&'));for(const k of keys)objects.delete(k);return send(200,'<DeleteResult>'+keys.map(k=>'<Deleted><Key>'+xml(k)+'</Key></Deleted>').join('')+'</DeleteResult>')}
  const obj=objects.get(objectKey);if(!obj)return fail(404,'NoSuchKey');
  if(['GET','HEAD'].includes(req.method)){let body=obj.bytes,status=200,extra={};if(req.headers.range){const match=/bytes=(\d+)-(\d*)/.exec(req.headers.range),start=Number(match[1]),end=match[2]?Number(match[2]):body.length-1;body=body.subarray(start,end+1);status=206;extra['Content-Range']='bytes '+start+'-'+end+'/'+obj.bytes.length}res.writeHead(status,{'Content-Length':body.length,'Last-Modified':new Date(obj.modified).toUTCString(),ETag:'"'+obj.etag+'"',...obj.meta,...extra});return res.end(req.method==='HEAD'?undefined:body)}
  fail(501,'NotImplemented');
 });
 return{server,objects,uploads};
}
module.exports={s3Server};

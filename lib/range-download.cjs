'use strict';
const {spawn}=require('child_process');
const {processWatchdog}=require('./process-watchdog.cjs');
const {pipeline}=require('stream/promises');
const {Transform}=require('stream');
const {fs,path,crypto,atomic,check,redact}=require('./common.cjs');
const {streamDownload}=require('./stream-download.cjs');
// Persist only fully written, fsynced ranges. An interrupted range is rewritten,
// never inferred from the sparse output file's apparent length.
async function rangeDownload(exe,args,file,o={}){
 const {size,signal,onProgress}=o,streams=Math.max(1,Math.min(4,o.streams||3));let chunk=o.chunkSize||64*1024*1024;const existingJournal=file+'.ranges.json';if(fs.existsSync(existingJournal)){const previous=JSON.parse(fs.readFileSync(existingJournal,'utf8'));chunk=previous.chunk||64*1024*1024}
 if(!Number.isSafeInteger(size)||size<0||!Number.isSafeInteger(chunk)||chunk<1)throw Error('分段大小无效');
 const journal=file+'.ranges.json';
 if(size<(o.cutoff??256*1024*1024)||(!fs.existsSync(journal)&&fs.existsSync(file)))return streamDownload(exe,args,file,o);
 check(signal);fs.mkdirSync(path.dirname(file),{recursive:true,mode:0o700});
 for(const p of [file,journal])if(fs.existsSync(p)&&(!fs.lstatSync(p).isFile()||fs.lstatSync(p).isSymbolicLink()))throw Error('缓存文件类型无效');
 const identity=crypto.createHash('sha256').update(JSON.stringify([o.identityArgs||args,size,chunk,o.identity||''])).digest('hex');
 let state={identity,chunk,done:[]};if(fs.existsSync(journal)){state=JSON.parse(fs.readFileSync(journal,'utf8'));if(state.identity!==identity)throw Error('分段下载源信息发生变化');}
 const count=Math.ceil(size/chunk);if(!Array.isArray(state.done)||state.done.some(x=>!Number.isInteger(x)||x<0||x>=count))throw Error('分段下载记录损坏');
 if(!fs.existsSync(file)||fs.statSync(file).size!==size){state.done=[];fs.writeFileSync(file,'',{mode:0o600});fs.truncateSync(file,size)}atomic(journal,state);
 const completed=new Set(state.done),bytes=Array.from({length:count},(_,i)=>completed.has(i)?Math.min(chunk,size-i*chunk):0);
 const ctrl=new AbortController(),abort=()=>ctrl.abort();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort();let firstError,cursor=0;
 function report(){onProgress?.({current:bytes.reduce((a,b)=>a+b,0),total:size})}
 async function part(i){const start=i*chunk,length=Math.min(chunk,size-start);const c=spawn(exe,[...args,'--offset',String(start),'--count',String(length)],{env:o.env,stdio:['ignore','pipe','pipe']});let received=0,stderr='',spawnError,timedOut=false;const watchdog=processWatchdog(c,{timeoutMs:o.idleTimeoutMs??90000,onTimeout:()=>{timedOut=true}});const stop=()=>{c.kill('SIGINT');setTimeout(()=>c.kill('SIGKILL'),5000).unref()};ctrl.signal.addEventListener('abort',stop,{once:true});if(ctrl.signal.aborted)stop();c.stderr.on('data',b=>stderr=(stderr+b).slice(-8000));const closed=new Promise(resolve=>{c.on('error',e=>{spawnError=e;resolve(null)});c.on('close',resolve)});
 const bounded=new Transform({transform(b,enc,cb){watchdog.touch();received+=b.length;if(received>length)return cb(Error('分段返回超出范围'));bytes[i]=received;report();cb(null,b)}});let pipeError;
 try{await pipeline(c.stdout,bounded,fs.createWriteStream(file,{flags:'r+',start,mode:0o600}))}catch(e){pipeError=e;c.kill('SIGTERM')}
 const code=await closed;watchdog.dispose();ctrl.signal.removeEventListener('abort',stop);check(ctrl.signal);
 if(timedOut)throw Error("ETIMEDOUT: 分段下载长时间无数据，保留完整分块等待重试");
 if(code!==0||spawnError||pipeError||received!==length)throw Error(redact(stderr||spawnError?.message||pipeError?.message||'分段下载不完整'));
 const fd=fs.openSync(file,'r+');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}completed.add(i);state.done=[...completed];atomic(journal,state);
 }
 async function worker(){while(cursor<count&&!ctrl.signal.aborted){const i=cursor++;if(completed.has(i))continue;try{await part(i)}catch(e){firstError ||= e;ctrl.abort();return}}}
 try{onProgress?.({current:bytes.reduce((a,b)=>a+b,0),total:size,resumed:true});await Promise.allSettled(Array.from({length:Math.min(streams,count)},worker));check(signal);if(firstError)throw firstError;if(completed.size!==count)throw Error('分段下载未完成');fs.unlinkSync(journal)}finally{signal?.removeEventListener('abort',abort)}
}
module.exports={rangeDownload};

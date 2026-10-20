'use strict';
const {Worker}=require('node:worker_threads'),path=require('node:path');
function cacheScan(root,{ttl=3000}={}){let pending,cached,at=0;return {invalidate(){cached=null;at=0},read(){if(cached&&Date.now()-at<ttl)return Promise.resolve(cached);if(pending)return pending;pending=new Promise((resolve,reject)=>{const worker=new Worker(path.join(__dirname,'cache-scan-worker.cjs'),{workerData:root});let done=false;const finish=(e,r)=>{if(done)return;done=true;worker.terminate();e?reject(e):resolve(r)};worker.once('message',r=>finish(r.error?Error(r.error):null,r));worker.once('error',finish);worker.once('exit',code=>{if(!done)finish(Error('缓存统计线程退出：'+code))})}).then(r=>{cached=r;at=Date.now();return r}).finally(()=>{pending=null});return pending}}}
module.exports={cacheScan};

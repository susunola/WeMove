'use strict';
const {Worker}=require('node:worker_threads');const path=require('node:path');const {check}=require('./common.cjs');
let active=0;const waiting=[];
function drain(){while(active<2&&waiting.length){const task=waiting.shift();if(task.signal?.aborted){task.reject(Object.assign(Error('已暂停'),{name:'AbortError'}));continue}active++;task.run()}}
function fileHashes(file,{signal}={}){check(signal);return new Promise((resolve,reject)=>{const task={signal,reject,run(){const worker=new Worker(path.join(__dirname,'hash-worker.cjs'),{workerData:{file}});let ended=false;const finish=(error,result)=>{if(ended)return;ended=true;signal?.removeEventListener('abort',abort);worker.terminate();active--;drain();error?reject(error):resolve(result)};const abort=()=>finish(Object.assign(Error('已暂停'),{name:'AbortError'}));signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)return abort();worker.once('message',m=>finish(m.error?Error(m.error):null,m.result));worker.once('error',finish);worker.once('exit',code=>{if(!ended)finish(Error('校验线程异常退出：'+code))})}};waiting.push(task);drain()})}
module.exports={fileHashes};

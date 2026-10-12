'use strict';
const {check}=require('./common.cjs');
const account=ref=>ref.provider+':'+(ref.account||ref.drive||'default');
function transferLimiter(settings) {
 let used=0,lastJob='',pending=[];const counts=new Map(),health=new Map();
 function drain(){
  while(used<settings().concurrency){
   const available=pending.filter(x=>x.keys.every(k=>(counts.get(k)||0)<Math.min(settings().accountConcurrency,health.get(k)?.limit||settings().accountConcurrency)));
   // Prefer different job, then least-used account to improve fairness
   const scored=available.map(x=>({x,score:(x.job===lastJob?2:0)+x.keys.reduce((n,k)=>n+(counts.get(k)||0),0)}));
   scored.sort((a,b)=>a.score-b.score);
   const next=scored[0]?.x;if(!next)return;
   pending.splice(pending.indexOf(next),1);next.signal?.removeEventListener('abort',next.abort);
   used++;lastJob=next.job;next.keys.forEach(k=>counts.set(k,(counts.get(k)||0)+1));let released=false;
   next.resolve(()=>{if(released)return;released=true;used--;next.keys.forEach(k=>counts.set(k,counts.get(k)-1));drain()});
  }
 }
 function acquire(job,refs,signal){check(signal);return new Promise((resolve,reject)=>{
  const entry={job,keys:[...new Set(refs.map(account))],signal,resolve};
  entry.abort=()=>{pending=pending.filter(x=>x!==entry);reject(Object.assign(Error('已暂停'),{name:'AbortError'}));drain()};
  signal?.addEventListener('abort',entry.abort,{once:true});pending.push(entry);drain();
 })}
 return {acquire,limited(ref){const k=account(ref),h=health.get(k)||{limit:settings().accountConcurrency,successes:0,hits:0};h.hits=(h.hits||0)+1;h.limit=Math.max(1,Math.floor(h.limit*(h.hits===1?0.75:0.5)));h.successes=0;h.lastLimit=Date.now();health.set(k,h)},succeeded(refs){for(const k of new Set(refs.map(account))){const h=health.get(k);if(h&&++h.successes>=2&&Date.now()-h.lastLimit>2000){h.limit=Math.min(settings().accountConcurrency,h.limit+1);h.successes=0;h.hits=0}}drain()},effectiveLimit(refs){const limits=refs.map(r=>{const k=account(r);return Math.min(settings().accountConcurrency,health.get(k)?.limit||settings().accountConcurrency)});return limits.length?Math.min(...limits):settings().concurrency},info:()=>({activeFiles:used,waitingFiles:pending.length,accounts:Object.fromEntries(counts),effectiveLimits:Object.fromEntries([...health].map(([k,h])=>[k,h.limit]))})};
}
module.exports={transferLimiter,account};

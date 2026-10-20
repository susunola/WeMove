'use strict';
// Independent per-account/phase samples. Fixed small-file latency must not inflate stream count.
function transferTuning({now=Date.now}={}){const samples=new Map(),key=(r,p)=>r.provider+':'+(r.account||'default')+':'+p;return{
 options(ref,phase,size){const h=samples.get(key(ref,phase));return{streams:size<32*1024**2?1:h?.streams||2,chunkSize:(h?.rate>25*1024**2?64:h?.rate>8*1024**2?32:16)*1024**2}},
 observe(ref,phase,{bytes,ms,limited=false,failed=false}){const k=key(ref,phase),h=samples.get(k)||{streams:2,rate:0,successes:0,samples:0};h.samples++;
 if(limited||failed){h.streams=Math.max(1,Math.floor(h.streams/2));h.successes=0;h.cooldownUntil=now()+30000;h.lastReason=limited?'rate_limit':'network_failure'}
 else if(ms>0&&bytes>0&&bytes<8*1024**2){h.smallFileMs=h.smallFileMs?.7*h.smallFileMs+.3*ms:ms;h.smallFileSamples=(h.smallFileSamples||0)+1;h.lastReason='fixed_latency_sample'}
 else if(ms>0&&bytes>0){const rate=bytes*1000/ms,previous=h.rate;h.rate=previous?.7*previous+.3*rate:rate;h.lastReason='sampling';if(now()>=(h.cooldownUntil||0)&&++h.successes>=3){if(!previous||rate>=previous*.95){h.streams=Math.min(4,h.streams+1);h.lastReason='stable_throughput'}else if(rate<previous*.7){h.streams=Math.max(1,h.streams-1);h.lastReason='throughput_drop'}h.successes=0}}
 samples.set(k,h)},info:()=>Object.fromEntries([...samples].map(([k,v])=>[k,{...v}]))}}
module.exports={transferTuning};

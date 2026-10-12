'use strict';
function requestMetrics(){const stats=new Map();return {async measure(key,fn){const item=stats.get(key)||{calls:0,errors:0,ms:0,maxMs:0,inFlight:0};stats.set(key,item);item.calls++;item.inFlight++;const at=Date.now();try{return await fn()}catch(e){item.errors++;throw e}finally{const ms=Date.now()-at;item.ms+=ms;item.maxMs=Math.max(item.maxMs,ms);item.inFlight--}},snapshot:()=>Object.fromEntries([...stats].map(([k,v])=>[k,{...v,averageMs:v.calls?Math.round(v.ms/v.calls):0}]))}}
module.exports={requestMetrics};

'use strict';
// Per-file memory-only lease; never persist signed URLs in receipts or reports.
function downloadURL(load,{ttl=300000,now=Date.now}={}){let cached,pending,epoch=0;return async(signal,{force=false}={})=>{if(force&&cached){epoch++;cached=null;pending=null}if(cached&&now()<cached.until)return cached.url;if(!pending){const generation=epoch;pending=Promise.resolve().then(()=>load(signal)).then(result=>{const url=typeof result==='string'?result:result.url,expiry=Date.parse(result.expires||'');if(generation===epoch)cached={url,until:Number.isFinite(expiry)?Math.min(now()+4*3600000,expiry-30000):now()+ttl};return url});const current=pending;current.finally(()=>{if(pending===current)pending=null}).catch(()=>{})}return pending}}
module.exports={downloadURL};

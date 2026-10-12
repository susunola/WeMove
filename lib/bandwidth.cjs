'use strict';
const {check}=require('./common.cjs');
// Reserve a shared time slot across all native transfer streams. No abort-listener leaks.
function createBandwidthLimiter(getLimit){let available=0;return async function throttle(bytes,signal){check(signal);const limit=Number(getLimit())||0;if(limit<=0||bytes<=0){available=0;return}const now=Date.now(),start=Math.max(now,available);available=start+bytes*1000/limit;const ms=available-now;await new Promise((resolve,reject)=>{const done=()=>{signal?.removeEventListener('abort',abort);resolve()},timer=setTimeout(done,ms),abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(Object.assign(Error('已暂停'),{name:'AbortError'}))};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()})}}
module.exports={createBandwidthLimiter};

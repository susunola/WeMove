'use strict';
// Bound silent transfer processes; preserve partial data for the normal retry path.
function processWatchdog(child,{timeoutMs=90000,onTimeout=()=>{}}={}){
 if(!Number.isFinite(timeoutMs)||timeoutMs<=0)throw Error('传输超时设置无效');
 let idle,force,disposed=false;
 function touch(){if(disposed)return;clearTimeout(idle);idle=setTimeout(()=>{onTimeout();child.kill('SIGTERM');force=setTimeout(()=>child.kill('SIGKILL'),5000);force.unref();},timeoutMs);idle.unref()}
 function dispose(){disposed=true;clearTimeout(idle);clearTimeout(force)}
 child.once('close',dispose);child.once('error',dispose);touch();return{touch,dispose};
}
module.exports={processWatchdog};

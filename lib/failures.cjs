'use strict';
function classifyFailure(error,{provider='',phase=''}={}){
 const message=String(error?.message??error??'');let kind='unknown';
 if(/源文件|源项目|source.*chang|发生变化|目录已变化|连接已变化/i.test(message))kind='source_changed';
 else if(/同名|重名|conflict|already.exists|immutable/i.test(message))kind='conflict';
 else if(/校验|checksum|hash.mismatch|corrupt/i.test(message))kind='integrity';
 else if(/Mac.*空间|缓存空间|staging.space|ENOSPC|disk.full/i.test(message))kind='local_space';
 else if(/quota|storage.full|空间不足|容量不足|存储空间/i.test(message))kind='quota';
 else if(/429|请求过于频繁|请求过于频繁|限流|rate.?limit|too.many|SlowDown|throttl/i.test(message))kind='rate_limit';
 else if(/401|expired|invalid_grant|授权.*失效|未授权|未登录|请先连接|重新连接|登录.*过期|凭据.*失效|ExpiredToken|InvalidAccessKeyId|SignatureDoesNotMatch/i.test(message))kind='auth';
 else if(/403|permission|access.?denied|权限|Forbidden/i.test(message))kind='permission';
 else if(/ECONN|ETIMED|ENOTFOUND|EAI_AGAIN|timeout|网络|network|socket|5\d\d|temporary|temporar|TLS|EOF|连接.*(中断|失败)|connection/i.test(message))kind='network';
 return {kind,provider,phase,retryable:['network','rate_limit'].includes(kind),action:kind==='auth'?'reconnect':kind==='local_space'?'cache':kind==='conflict'?'conflict':kind==='quota'?'space':'retry'};
}
function recoveryDelay(round,kind){return Math.min(30*60*1000,(kind==='rate_limit'?60000:15000)*2**Math.max(0,round-1))}
module.exports={classifyFailure,recoveryDelay};

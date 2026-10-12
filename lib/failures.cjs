'use strict';
function classifyFailure(error,{provider='',phase=''}={}){
 const message=String(error?.message??error??'');let kind='unknown';
 if(/源文件|源项目|source.*chang|发生变化|目录已变化|连接已变化/i.test(message))kind='source_changed';
 else if(/同名|重名|conflict|already.exists|immutable|file exists/i.test(message))kind='conflict';
 else if(/校验|checksum|hash.mismatch|corrupt|integrity/i.test(message))kind='integrity';
 else if(/Mac.*空间|缓存空间|staging.space|ENOSPC|disk.full|no space/i.test(message))kind='local_space';
 else if(/quota|storage.full|空间不足|容量不足|存储空间|InsufficientStorage/i.test(message))kind='quota';
 else if(/429|请求过于频繁|限流|rate.?limit|too.many|SlowDown|throttl|TooManyRequests/i.test(message))kind='rate_limit';
 else if(/401|expired|invalid_grant|授权.*失效|未授权|未登录|请先连接|重新连接|登录.*过期|凭据.*失效|ExpiredToken|InvalidAccessKeyId|SignatureDoesNotMatch|Unauthorized/i.test(message))kind='auth';
 else if(/403|permission|access.?denied|权限|Forbidden|AccessDenied/i.test(message))kind='permission';
 else if(/ECONN|ETIMED|ENOTFOUND|EAI_AGAIN|timeout|网络|network|socket|5\d\d|temporary|temporar|TLS|EOF|连接.*(中断|失败)|connection|reset|broken pipe/i.test(message))kind='network';
 else if(/not found|不存在|404|NoSuchKey|file not found/i.test(message))kind='not_found';
 return {kind,provider,phase,retryable:['network','rate_limit','temporary'].includes(kind),action:kind==='auth'?'reconnect':kind==='local_space'?'cache':kind==='conflict'?'conflict':kind==='quota'?'space':kind==='not_found'?'check':'retry'};
}
function recoveryDelay(round,kind){
  const base = kind==='rate_limit' ? 30000 : 5000;
  const jitter = 0.85 + Math.random() * 0.3;
  return Math.min(15*60*1000, Math.round(base * Math.pow(1.6, Math.max(0, round-1)) * jitter));
}
module.exports={classifyFailure,recoveryDelay};

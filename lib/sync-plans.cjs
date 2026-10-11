'use strict';
const {path,crypto,atomic,readJSON,name,redact,check}=require('./common.cjs');
const {compareTree,missingPaths}=require('./compare-tree.cjs');
function nextRun(schedule,now){
 if(schedule.kind==='manual')return 0;
 if(schedule.kind==='hourly')return now+3600000;
 const [hour,minute]=schedule.time.split(':').map(Number),local=new Date(now+8*3600000);
 let next=Date.UTC(local.getUTCFullYear(),local.getUTCMonth(),local.getUTCDate(),hour-8,minute);
 if(next<=now)next+=86400000;return next;
}
function fingerprint(e){return {size:e.size,modified:String(e.modified||''),hash:(e.hash||'').toLowerCase(),hashType:e.hashType||''}}
function matches(a,b){return !!a&&!!b&&a.size===b.size&&a.modified===String(b.modified||'')&&a.hash===(b.hash||'').toLowerCase()&&a.hashType===(b.hashType||'')&&(!!a.hash||!!a.modified)}
function createSyncPlans({data,providers,queue,blocked=()=>false,now=Date.now,autoTick=true}){
 const file=path.join(data,'sync-plans.json');let plans=readJSON(file,[]);if(!Array.isArray(plans))throw Error('同步方案记录损坏');let scanning=null,scanController=null,closed=false;
 const persist=()=>atomic(file,plans);
 const publicPlan=p=>{const {ledger,...rest}=p;return structuredClone(rest)};
 function save(input){
  let p=input.id&&plans.find(p=>p.id===input.id);if(input.id&&!p)throw Error('同步方案不存在');if(plans.length>=100&&!p)throw Error('同步方案超过上限');
  if(p&&active(p))throw Error('请等待此方案的任务结束');
  const source=providers.validate(input.source),target=providers.validate(input.target);
  if(source.provider==='local'||target.provider==='local')throw Error('同步方案需要两个云端目录');
  if(source.provider===target.provider&&(source.drive||'')===(target.drive||'')&&(source.path===target.path||target.path.startsWith(source.path.replace(/\/$/,'')+'/')||source.path.startsWith(target.path.replace(/\/$/,'')+'/')))throw Error('同步目录不能相同或互相包含');
  const title=String(input.name||'').trim();if(!title||title.length>120)throw Error('请填写同步方案名称');
  const mode=input.mode||'missing';if(!['missing','update'].includes(mode))throw Error('同步模式无效');if(mode==='update'&&input.confirmOverwrite!==true)throw Error('更新模式需要确认旧文件备份');
  const schedule=input.schedule||{kind:'manual'};if(!['manual','hourly','daily'].includes(schedule.kind)||schedule.kind==='daily'&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.time||''))throw Error('定时设置无效');
  const names=input.names||[];if(!Array.isArray(names)||names.length>1000)throw Error('选择项目过多');names.forEach(name);
  const exclude=input.exclude||[];if(!Array.isArray(exclude)||exclude.length>30||exclude.some(x=>typeof x!=='string'||x.length>50))throw Error('排除类型无效');
  const spec={id:p?.id||crypto.randomBytes(16).toString('hex'),name:title,source,target,names:[...new Set(names)],mode,strictVerify:input.strictVerify===true,exclude,schedule:{kind:schedule.kind,...(schedule.kind==='daily'?{time:schedule.time}:{})},enabled:schedule.kind!=='manual'&&input.enabled===true,nextRunAt:nextRun(schedule,now()),createdAt:p?.createdAt||now(),status:'idle',lastError:'',ledger:{}};
  if(p)Object.assign(p,spec);else{p=spec;plans.push(p)}persist();return publicPlan(p);
 }
 function active(p){return scanning===p.id||queue.jobs.some(j=>j.planId===p.id&&!['complete','failed','canceled'].includes(j.status))}
 function observe(j){const p=plans.find(p=>p.id===j.planId);if(!p||p.lastJobId!==j.id)return;if(j.status==='complete'){
   p.ledger||={};for(const f of j.files||[])if(f.done&&!f.skipped&&f.destinationInfo)Object.defineProperty(p.ledger,f.rel,{value:{source:{size:f.size,modified:String(f.modified||''),hash:(f.sourceHash||'').toLowerCase(),hashType:f.sourceHashType||''},target:fingerprint(f.destinationInfo)},enumerable:true,writable:true,configurable:true});
   p.status='complete';p.lastError='';p.lastCompletedAt=now();persist();
  }else if(['failed','canceled','paused'].includes(j.status)){p.status=j.status;p.lastError=j.status==='failed'?redact(j.message):'';persist()}}
 const unsubscribe=queue.subscribe?.(observe);
 for(const p of plans){const j=queue.jobs.find(j=>j.id===p.lastJobId);if(j)observe(j);if(p.status==='scanning')p.status='idle'}
 async function analyze(p,signal){check(signal);
  const rows=await compareTree(providers,p.source,p.target,{recursive:true,exclude:p.exclude,fresh:true,excludeDirs:['搬运助手回收站'],topNames:p.names,signal});check(signal);
  const allowed=x=>!x.split('/').includes('搬运助手回收站')&&(!p.names.length||selected.has(x.split('/')[0]));
  const selected=new Set(p.names);let paths=missingPaths(rows,'left').filter(allowed);
  if(p.mode==='update')paths=paths.concat(rows.filter(r=>allowed(r.name)&&r.left&&!r.left.isDir&&r.right&&!r.right.isDir&&(r.status==='different'||r.status==='unknown'&&!(matches(p.ledger?.[r.name]?.source,r.left)&&matches(p.ledger?.[r.name]?.target,r.right)))).map(r=>r.name));
  const conflicts=rows.filter(r=>allowed(r.name)&&r.left&&r.right&&r.left.isDir!==r.right.isDir).map(r=>r.name);
  paths=[...new Set(paths)];const picked=new Set(paths);return {paths,conflicts,files:rows.filter(r=>picked.has(r.name)&&!r.left?.isDir).length,bytes:rows.filter(r=>picked.has(r.name)&&!r.left?.isDir).reduce((n,r)=>n+r.left.size,0)};
 }
 async function preview(id){const p=plans.find(p=>p.id===id);if(!p)throw Error('同步方案不存在');if(scanning||blocked())throw Error('请等待当前扫描、授权或删除完成');scanning=id;scanController=new AbortController();try{return{...await analyze(p,scanController.signal),plan:publicPlan(p)}}finally{scanning=null;scanController=null}}
 async function run(id){const p=plans.find(p=>p.id===id);if(!p)throw Error('同步方案不存在');if(scanning||blocked())throw Error('请等待当前扫描、授权或删除完成');if(active(p))throw Error('此方案已有运行、排队或暂停任务，请继续原任务');scanning=id;scanController=new AbortController();p.status='scanning';p.lastRunAt=now();p.lastError='';persist();
  try{const result=await analyze(p,scanController.signal);if(closed)throw Error('扫描中断，可重新执行');if(result.conflicts.length)throw Error('文件与文件夹类型冲突：'+result.conflicts.slice(0,3).join('、'));if(!result.paths.length){p.status='complete';p.lastCompletedAt=now();return{count:0}}
   const names=[...new Set(result.paths.map(x=>x.split('/')[0]))];if(names.length>1000)throw Error('顶层项目超过 1000，请拆分同步方案');
   const id=await queue.enqueue({source:p.source,target:p.target,names,includePaths:result.paths,conflict:p.mode==='update'?'overwrite':'stop',confirmOverwrite:p.mode==='update',strictVerify:p.strictVerify,planId:p.id});p.lastJobId=id;p.status='queued';return{id,count:result.paths.length};
  }catch(error){p.status=closed?'idle':'failed';p.lastError=closed?'扫描中断，可重新执行':redact(error.message);throw error}finally{p.nextRunAt=closed&&p.enabled?now()+15000:nextRun(p.schedule,now());scanning=null;scanController=null;persist()}
 }
 function toggle(id,enabled){const p=plans.find(p=>p.id===id);if(!p)throw Error('同步方案不存在');if(typeof enabled!=='boolean')throw Error('定时设置无效');p.enabled=enabled&&p.schedule.kind!=='manual';if(p.enabled)p.nextRunAt=nextRun(p.schedule,now());persist()}
 function remove(id){const p=plans.find(p=>p.id===id);if(!p)throw Error('同步方案不存在');if(active(p))throw Error('请先结束此方案的任务');plans=plans.filter(p=>p.id!==id);persist()}
 async function tick(){if(closed||scanning||blocked())return;const due=plans.find(p=>p.enabled&&p.nextRunAt&&p.nextRunAt<=now()&&!active(p));if(due)try{await run(due.id)}catch{}}
 const timer=autoTick?setInterval(tick,10000):null;timer?.unref();
 return{save,preview,run,toggle,remove,tick,snapshot:()=>plans.map(p=>{const out=publicPlan(p),j=queue.jobs.find(j=>j.id===p.lastJobId);if(j)out.status=j.status;return out}),busy:()=>!!scanning,close:()=>{closed=true;scanController?.abort();if(timer)clearInterval(timer);unsubscribe?.()}};
}
module.exports={createSyncPlans,nextRun};

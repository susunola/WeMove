'use strict';
const {fs,path,atomic,readJSON,redact,name}=require('./common.cjs');
const {compareTree}=require('./compare-tree.cjs');
async function preflight(providers,data,spec,settings){
 const source=providers.validate(spec.source),target=providers.validate(spec.target);
 if(!Array.isArray(spec.names)||!spec.names.length||spec.names.length>1000)throw Error('请选择 1 至 1000 个项目');
 const names=[...new Set(spec.names.map(name))];
 const rows=await compareTree(providers,source,target,{recursive:true,fresh:true,topNames:names});
 const present=new Set(rows.filter(r=>r.left).map(r=>r.name.split('/')[0]));if(names.some(n=>!present.has(n)))throw Error('源项目已不存在，请刷新目录');
 const policy=spec.conflict||'stop',files=rows.filter(r=>r.left&&!r.left.isDir),conflicts=rows.filter(r=>r.left&&r.right&&r.left.isDir!==r.right.isDir).map(r=>r.name);
 const bytes=files.reduce((n,r)=>n+r.left.size,0),sizes=files.filter(r=>!r.right||policy!=='skip').map(r=>r.left.size).sort((a,b)=>b-a);
 const disk=fs.statfsSync(data),available=Number(disk.bavail)*Number(disk.bsize),required=sizes.slice(0,settings.concurrency).reduce((n,x)=>n+x,0)+(spec.strictVerify?(sizes[0]||0):0)+32*1024*1024;
 let quota=null;try{quota=await providers.quota?.(target)||null}catch{}
 return {source,target,files:files.length,directories:rows.filter(r=>r.left?.isDir).length,bytes,existing:files.filter(r=>r.right).length,conflicts,cache:{available,required,sufficient:available>=required},quota,readable:true,writePermission:'unknown',rows:rows.filter(r=>r.left).map(r=>({path:r.name,isDir:r.left.isDir,size:r.left.size,status:r.status,action:r.right?(r.left.isDir===r.right.isDir?(r.left.isDir?'merge':policy):'type-conflict'):'copy'})),checkedAt:Date.now()};
}
function migrationReports(data){const dir=path.join(data,'reports');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const report=job=>({version:1,id:job.id,createdAt:job.createdAt,recordedAt:Date.now(),status:job.status,source:job.source,target:job.target,conflict:job.conflict||'stop',strictVerify:!!job.strictVerify,outcome:job.outcome||null,scanComplete:!!job.planned,sourceConflicts:job.sourceConflicts||[],message:redact(job.message||''),metrics:job.metrics||{},files:(job.files||[]).map(f=>({path:f.rel,targetName:f.targetName||path.posix.basename(f.rel),size:f.size,status:f.skipped?'skipped':f.done?'complete':f.error?'failed':'pending',verification:f.skipped?'not-verified':f.done?(f.verification||'metadata'):'not-verified',sha256:f.sha256||'',remoteHash:f.destinationInfo?.hash||'',remoteHashType:f.destinationInfo?.hashType||'',error:redact(f.error||''),retries:f.retries||0,backup:f.backup||''}))});
 function save(job){atomic(path.join(dir,job.id+'.json'),report(job))}
 function get(id){if(!/^[a-f0-9]{16}$/.test(id||''))throw Error('报告标识无效');const r=readJSON(path.join(dir,id+'.json'));if(!r)throw Error('报告不存在');return r}
 function list(){return fs.readdirSync(dir).filter(n=>/^[a-f0-9]{16}\.json$/.test(n)).map(n=>{const r=get(n.slice(0,-5));return {id:r.id,status:r.status,recordedAt:r.recordedAt,source:r.source,target:r.target,files:r.files.length}}).sort((a,b)=>b.recordedAt-a.recordedAt)}
 return {save,get,list};
}
module.exports={preflight,migrationReports};

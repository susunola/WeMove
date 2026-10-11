'use strict';
const {path,name}=require('./common.cjs');
const running=new Set(['queued','scanning','preparing','downloading','uploading','verifying','transferring','retrying']);
function assertDeleteSafe(providers,jobs,ref,names){
 ref=providers.validate(ref)||ref;
 if(!Array.isArray(names)||!names.length||names.length>1000)throw Error('请选择 1 至 1000 个项目');
 const selected=names.map(n=>path.posix.join(ref.path,name(n)));
 const identity=r=>{const base=providers.root(r.provider);return [r.provider,r.account||base.account||'default'].join(':')};
 const intersects=(a,b)=>a===b||a.startsWith(b+'/')||b.startsWith(a+'/');
 for(const j of jobs){if(!running.has(j.status))continue;
  for(const base of [j.source,j.target]){if(!base||base.provider!==ref.provider||identity(base)!==identity(ref)||base.drive&&ref.drive&&base.drive!==ref.drive)continue;
   const paths=(j.names||[]).map(n=>path.posix.join(base.path,n));
   if(base===j.target)for(const f of j.files||[])if(f.targetName)paths.push(path.posix.join(base.path,path.posix.dirname(f.rel),f.targetName));
   if(selected.some(p=>paths.some(q=>intersects(p,q))))throw Error('所选项目正在被传输任务使用，请先暂停相关任务再删除');
  }
 }
 return ref;
}
module.exports={assertDeleteSafe};

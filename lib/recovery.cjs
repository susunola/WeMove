'use strict';
const {fs,path,crypto,atomic,readJSON,name,redact}=require('./common.cjs');
const TRASH='搬运助手回收站';
function createRecovery({data,providers}){
 const dir=path.join(data,'recovery');fs.mkdirSync(dir,{recursive:true,mode:0o700});const records=new Map(),locks=new Set();
 for(const file of fs.readdirSync(dir).filter(n=>/^[a-f0-9]{32}\.json$/.test(n))){try{const r=readJSON(path.join(dir,file));if(r.version===1)records.set(r.id,r)}catch{fs.renameSync(path.join(dir,file),path.join(dir,file+'.broken'))}}
 const save=r=>atomic(path.join(dir,r.id+'.json'),r);
 function begin({original,trash,items,reason='delete',jobId=''}){
  const r={version:1,id:crypto.randomBytes(16).toString('hex'),createdAt:Date.now(),original:{...original},trash:{...trash},reason,jobId,items:items.map(e=>({id:crypto.randomBytes(8).toString('hex'),name:e.name,isDir:e.isDir,size:e.size,hash:e.hash||'',hashType:e.hashType||'',modified:e.modified||'',sourceId:e.ref.id||'',status:'pending',message:''}))};records.set(r.id,r);save(r);return r.id;
 }
 function mark(id,n,status,message=''){const r=records.get(id);if(!r)return;const item=r.items.find(x=>x.name===n);if(item){item.status=status;item.message=redact(message);save(r)}}
 function snapshot(){return [...records.values()].sort((a,b)=>b.createdAt-a.createdAt).map(r=>structuredClone(r))}
 async function originalFolder(ref){let current={...providers.root(ref.provider),...(ref.drive?{drive:ref.drive}:{})};for(const n of ref.path.split('/').filter(Boolean)){name(n);const e=await providers.find(current,n,{fresh:true});if(e&&!e.isDir)throw Error('恢复路径中存在同名文件：'+n);current=e?e.ref:await providers.mkdir(current,n,{fresh:true})}return current}
 function same(item,e){return !!e&&e.isDir===item.isDir&&(item.isDir||e.size===item.size)&&(!item.hash||!e.hash||item.hashType!==e.hashType||item.hash.toLowerCase()===e.hash.toLowerCase())}
 async function restore(id,itemId,options={}){
  const r=records.get(id),item=r?.items.find(x=>x.id===itemId);if(!r||!item)throw Error('恢复记录不存在');if(item.status==='restored')return {ok:true};if(locks.has(id))throw Error('恢复正在进行');locks.add(id);
  try{
   providers.validate(r.original);providers.validate(r.trash);
   const from=await providers.find(r.trash,item.name,{fresh:true}),destination=await originalFolder(r.original),existing=await providers.find(destination,item.name,{fresh:true});
   if(!from){
    const identity=existing&&((['ali','baidu','onedrive'].includes(r.original.provider)&&item.sourceId&&existing.ref.id===item.sourceId)||(item.hash&&existing.hash&&item.hashType===existing.hashType&&item.hash.toLowerCase()===existing.hash.toLowerCase()));
    if(item.status==='restoring'&&identity&&same(item,existing)){item.status='restored';item.restoredAt=Date.now();item.message='';save(r);return{ok:true}}
    throw Error('回收文件不存在，请在网盘中核实：'+item.name);
   }
   if(!same(item,from))throw Error('回收文件发生变化，已停止恢复：'+item.name);
   if(existing){if(options.confirmReplace!==true||item.isDir||existing.isDir)throw Error('原位置已有同名项目，恢复不会覆盖：'+item.name);await require('./trash.cjs').trashItems(providers,destination,[item.name],()=>{},{reason:'restore-replace'});if(await providers.find(destination,item.name,{fresh:true}))throw Error('恢复前目标仍有同名文件：'+item.name)}const latest=await providers.find(r.trash,item.name,{fresh:true});if(!same(item,latest))throw Error('回收文件发生变化，已停止恢复：'+item.name);
   if(['ali','baidu'].includes(from.ref.provider)&&/[*?\[\]]/.test(from.ref.path))throw Error('名称包含客户端通配符，请在网盘中恢复');
   item.status='restoring';item.message='';save(r);
   await providers.get(latest.ref).move(latest.ref,destination,item.isDir);
   const restored=await providers.find(destination,item.name,{fresh:true}),remaining=await providers.find(r.trash,item.name,{fresh:true});
   if(!same(item,restored)||remaining)throw Error('恢复结果尚未确认，请刷新后重试：'+item.name);
   item.status='restored';item.restoredAt=Date.now();save(r);return{ok:true,ref:destination};
  }catch(error){item.message=redact(error.message);save(r);throw error}finally{locks.delete(id)}
 }
 return{begin,mark,snapshot,restore,busy:()=>locks.size>0};
}
module.exports={createRecovery};

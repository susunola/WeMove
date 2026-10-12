'use strict';
const {path,name,crypto}=require('./common.cjs');const TRASH='搬运助手回收站';
async function trashItems(providers,ref,names,onProgress=()=>{},options={}){onProgress({phase:"preparing",done:0,total:names?.length||0});ref=providers.validate(ref);if(!Array.isArray(names)||!names.length||names.length>1000)throw Error('请选择 1 至 1000 个项目');names=[...new Set(names.map(name))];if(ref.path==='/'+TRASH||ref.path.startsWith('/'+TRASH+'/')||ref.path==='/'&&names.includes(TRASH))throw Error('不能删除回收站中的项目，请在网盘中管理');const entries=await providers.list(ref,{fresh:true}),items=names.map(n=>{const e=entries.find(x=>x.name===n);if(!e)throw Error('项目已不存在：'+n);if(['ali','baidu'].includes(ref.provider)&&/[*?\[\]]/.test(e.ref.path))throw Error('此名称包含客户端通配符，请在网盘中删除：'+n);return e});const root={...providers.root(ref.provider),...(ref.account?{account:ref.account}:{}),...(ref.drive?{drive:ref.drive}:{})},bin=await providers.mkdir(root,TRASH),batch=await providers.mkdir(bin,new Date().toISOString().replace(/[:.]/g,'-')+'-'+crypto.randomBytes(3).toString('hex'));const record=providers.recovery?.begin({original:ref,trash:batch,items,reason:options.reason||'delete',jobId:options.jobId||''});let done=0;
 const concurrency=Math.min(4,items.length);
 const queue=[...items];
 async function worker(){
  while(queue.length){
   const e=queue.shift();
   if(!e)break;
   try{
    onProgress({phase:"moving",done,total:items.length,name:e.name});
    const fresh=await providers.find(ref,e.name,{fresh:false});
    if(!fresh)throw Error('源项目发生变化：'+e.name);
    if(record)providers.recovery.mark(record,e.name,'moving');
    await providers.get(fresh.ref).move(fresh.ref,batch,e.isDir);
    done++;
    onProgress({phase:"moved",done,total:items.length,name:e.name});
    if(record)providers.recovery.mark(record,e.name,'recoverable');
   }catch(err){throw Error('已移入回收站 '+done+' 项；'+err.message+'。回收目录：'+batch.path)}
  }
 }
 await Promise.all(Array.from({length:concurrency},()=>worker()));
 return {count:done,trash:batch.path,recordId:record}}
module.exports={trashItems,TRASH};
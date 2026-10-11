'use strict';
const {fs,path,crypto,atomic,readJSON,check}=require('./common.cjs');
function directoryIndex({data,providers,now=Date.now}){
 const dir=path.join(data,'directory-index');fs.mkdirSync(dir,{recursive:true,mode:0o700});
 const memory=new Map(),pending=new Map(),signals=new WeakMap();let signalNumber=0;const epochs=readJSON(path.join(dir,'epochs.json'),{});
 let lastAliMeta=providers.aliMeta?.()||{},writes=0;const stats={requests:0,hits:0,diskHits:0,errors:0,totalMs:0,byProvider:{}};
 const key=ref=>crypto.createHash('sha256').update(JSON.stringify(ref)).digest('hex');
 function invalidate(ref=null){
  const ids=ref?[ref.provider]:Object.keys(providers.labels||{});
  for(const id of ids){epochs[id]=(epochs[id]||0)+1;for(const [k,v] of memory)if(v.ref.provider===id&&(!ref||v.ref.path===ref.path||v.ref.path.startsWith(ref.path.replace(/\/$/,'')+'/')||ref.path.startsWith(v.ref.path.replace(/\/$/,'')+'/')))memory.delete(k)}
  atomic(path.join(dir,'epochs.json'),epochs);
 }
 async function list(input,options={}){
  const ref=providers.validate(input),k=key(ref),epoch=epochs[ref.provider]||0,ttl=options.fresh?0:Math.min(15000,Math.max(0,options.maxAge??2000));check(options.signal);
  let cached=memory.get(k);
  if(!cached&&ttl){try{const entry=readJSON(path.join(dir,k+'.json'),null);if(entry&&entry.epoch===epoch&&now()-entry.at<ttl){cached=entry;stats.diskHits++;memory.set(k,entry)}}catch{}}
  if(cached&&ttl&&now()-cached.at<ttl){if(ref.provider==='ali'&&cached.aliMeta)lastAliMeta=cached.aliMeta;stats.hits++;if(stats.byProvider[ref.provider])stats.byProvider[ref.provider].hits++;return structuredClone(cached.items)}
  // Each network listing owns its abort signal. Independent callers share only completed data.
  if(options.signal&&!signals.has(options.signal))signals.set(options.signal,++signalNumber);const pendingKey=k+':'+epoch+':'+(options.signal?signals.get(options.signal):0);
  if(pending.has(pendingKey)){const items=await pending.get(pendingKey);check(options.signal);return structuredClone(items)}
  const request=(async()=>{
   const started=now();stats.requests++;const per=stats.byProvider[ref.provider]||={requests:0,hits:0,errors:0,totalMs:0};per.requests++;
   try{const items=await providers.list(ref,options);check(options.signal);const entry={ref,items,at:now(),epoch,...(ref.provider==='ali'?{aliMeta:providers.aliMeta()}:{})};if(entry.aliMeta)lastAliMeta=entry.aliMeta;
    if(epoch===(epochs[ref.provider]||0)){memory.set(k,entry);if(memory.size>512)memory.delete(memory.keys().next().value);if(items.length<=10000){const raw=JSON.stringify(entry);if(Buffer.byteLength(raw)<=4*1024*1024)(()=>{try{atomic(path.join(dir,k+'.json'),entry);if(++writes%32===0)trim()}catch{stats.indexWriteErrors=(stats.indexWriteErrors||0)+1}})()}}
    return items;
   }catch(error){stats.errors++;per.errors++;throw error}finally{const elapsed=Math.max(0,now()-started);stats.totalMs+=elapsed;per.totalMs+=elapsed}
  })();
  pending.set(pendingKey,request);
  try{return structuredClone(await request)}finally{if(pending.get(pendingKey)===request)pending.delete(pendingKey)}
 }
 const adapters=new Map();
 function get(ref){const original=providers.get(ref);if(adapters.has(original))return adapters.get(original);const wrapped={...original};
  for(const op of ['upload','mkdir','move'])if(original[op])wrapped[op]=async(...args)=>{const changed=op==='move'?[args[0],args[1]]:[args[0]];for(const r of changed)invalidate(r);try{return await original[op](...args)}finally{for(const r of changed)invalidate(r)}};
  adapters.set(original,wrapped);return wrapped;
 }
 async function find(ref,n,o={}){return (await list(ref,o)).find(e=>e.name===n)}
 async function mkdir(ref,n,o={}){const found=await find(ref,n,o);if(found){if(!found.isDir)throw Error('目标同名项目不是目录：'+n);return found.ref}return get(ref).mkdir(ref,n,o)}
 function info(){return {...stats,byProvider:structuredClone(stats.byProvider),cachedDirectories:memory.size,averageMs:stats.requests?Math.round(stats.totalMs/stats.requests):0}}
 function clean(){if(pending.size)throw Error('目录读取中，请稍后清理');for(const f of fs.readdirSync(dir))if(/^[a-f0-9]{64}\.json$/.test(f))fs.rmSync(path.join(dir,f),{force:true});memory.clear()}
 // Bound persistent metadata growth across long-running scans.
 function trim(){const files=fs.readdirSync(dir).filter(n=>/^[a-f0-9]{64}\.json$/.test(n)).map(n=>({n,...fs.statSync(path.join(dir,n))})).sort((a,b)=>b.mtimeMs-a.mtimeMs);let bytes=0,count=0;for(const f of files){bytes+=f.size;count++;if(count>1024||now()-f.mtimeMs>86400000||bytes>64*1024*1024)fs.rmSync(path.join(dir,f.n),{force:true})}}
 trim();return {...providers,aliMeta:()=>structuredClone(lastAliMeta),get,list,find,mkdir,invalidate,directoryInfo:info,cleanIndex:clean};
}
module.exports={directoryIndex};

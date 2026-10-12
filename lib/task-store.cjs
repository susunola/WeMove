'use strict';
const {DatabaseSync}=require('node:sqlite');
const {fs,path,readJSON}=require('./common.cjs');

// Metadata and individual file receipts commit together; unchanged files are not rewritten.
function taskStore(data,log=()=>{}) {
 const file=path.join(data,'tasks.sqlite');
 const db=new DatabaseSync(file);
 fs.chmodSync(file,0o600);
 db.exec(`PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON;
 CREATE TABLE IF NOT EXISTS jobs(id TEXT PRIMARY KEY, metadata TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS files(job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE, position INTEGER NOT NULL, body TEXT NOT NULL, PRIMARY KEY(job_id,position));
 CREATE TABLE IF NOT EXISTS auxiliary(job_id TEXT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,kind TEXT NOT NULL,key TEXT NOT NULL,body TEXT NOT NULL,PRIMARY KEY(job_id,kind,key));
 CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);`);
 for(const suffix of ['-wal','-shm'])if(fs.existsSync(file+suffix))fs.chmodSync(file+suffix,0o600);
 const upJob=db.prepare('INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata');
 const upFile=db.prepare('INSERT INTO files VALUES(?,?,?) ON CONFLICT(job_id,position) DO UPDATE SET body=excluded.body');
 const deleteTail=db.prepare('DELETE FROM files WHERE job_id=? AND position>=?');
 const auxiliary=new Map(),upAux=db.prepare('INSERT INTO auxiliary VALUES(?,?,?,?) ON CONFLICT(job_id,kind,key) DO UPDATE SET body=excluded.body'),delAux=db.prepare('DELETE FROM auxiliary WHERE job_id=? AND kind=?'),delPrefix=db.prepare("DELETE FROM auxiliary WHERE job_id=? AND kind='scan' AND CAST(key AS INTEGER)<?");
 const signatures=new Map(),pending=new Map();let flushTimer;function flush(){clearTimeout(flushTimer);flushTimer=null;const batch=[...pending.values()];pending.clear();for(const job of batch)save(job,[])}function softSave(job){pending.set(job.id,job);if(!flushTimer){flushTimer=setTimeout(flush,200);flushTimer.unref()}}
 function save(job,changed) {
  pending.delete(job.id);
  const {files=[],dirs=[],parents={},scanPending=[],...metadata}=job,meta={...metadata,_aux:true,_scanDefined:job.scanPending!==undefined,_auxFields:{dirs:Object.hasOwn(job,'dirs'),parents:Object.hasOwn(job,'parents'),scanPending:Object.hasOwn(job,'scanPending')}};const priorAux=auxiliary.get(job.id);const state={dirs:dirs.length,scan:scanPending.length,head:job.scanHead||0};const previous=signatures.get(job.id)||[];const serialized=changed===undefined?files.map(f=>JSON.stringify(f)):previous;const indices=changed===undefined?files.map((_,i)=>i):changed;const updates=new Map();for(const i of indices)updates.set(i,JSON.stringify(files[i]));
  db.exec('BEGIN IMMEDIATE');
  try {
   upJob.run(job.id,JSON.stringify(meta));
   for(const [kind,items]of [['dirs',dirs],['scan',scanPending]]){const previous=priorAux?.[kind==='dirs'?'dirs':'scan']||0;if(items.length<previous)delAux.run(job.id,kind);for(let i=items.length<previous?0:previous;i<items.length;i++)if(items[i]!==undefined&&items[i]!==null)upAux.run(job.id,kind,String(i),JSON.stringify(items[i]))}
   if(state.head!==priorAux?.head)delPrefix.run(job.id,state.head);
   const keys=!priorAux||changed===undefined?Object.keys(parents):[...(job._dirtyParents||[])];for(const key of keys)upAux.run(job.id,'parents',key,JSON.stringify(parents[key]));
   indices.forEach(i=>{const body=updates.get(i);if(body!==previous[i])upFile.run(job.id,i,body)});
   if(previous.length>serialized.length)deleteTail.run(job.id,serialized.length);
   db.exec('COMMIT');for(const suffix of ['-wal','-shm'])if(fs.existsSync(file+suffix))fs.chmodSync(file+suffix,0o600); for(const [i,body]of updates)serialized[i]=body;signatures.set(job.id,serialized);auxiliary.set(job.id,state);job._dirtyParents?.clear();
  }catch(error){db.exec('ROLLBACK');throw error}
 }
 const legacy=path.join(data,'jobs-v2');
 fs.mkdirSync(legacy,{recursive:true,mode:0o700});
 // A marker also prevents cleared legacy jobs from returning on the next launch.
 for(const name of fs.readdirSync(legacy).filter(n=>/^[a-f0-9]{16}\.json$/.test(n))) {
  if(db.prepare('SELECT 1 FROM migrations WHERE name=?').get(name))continue;
  let job;
  try{job=readJSON(path.join(legacy,name));if(job?.version!==2||job.id!==name.slice(0,-5))throw Error('invalid legacy task')}
  catch(error){fs.renameSync(path.join(legacy,name),path.join(legacy,name+'.broken-'+Date.now()));log('任务记录损坏，已隔离：'+name);continue}
  if(!db.prepare('SELECT 1 FROM jobs WHERE id=?').get(job.id))save(job);
  db.prepare('INSERT INTO migrations VALUES(?)').run(name);
 }
 function load() {
  return db.prepare('SELECT id,metadata FROM jobs ORDER BY rowid').all().map(row=>{
   const records=db.prepare('SELECT body FROM files WHERE job_id=? ORDER BY position').all(row.id);
   const files=records.map(r=>JSON.parse(r.body));signatures.set(row.id,records.map(r=>r.body));
   const meta=JSON.parse(row.metadata);if(meta._aux){meta.dirs=db.prepare("SELECT body FROM auxiliary WHERE job_id=? AND kind='dirs' ORDER BY CAST(key AS INTEGER)").all(row.id).map(r=>JSON.parse(r.body));meta.parents=Object.fromEntries(db.prepare("SELECT key,body FROM auxiliary WHERE job_id=? AND kind='parents'").all(row.id).map(r=>[r.key,JSON.parse(r.body)]));const scan=db.prepare("SELECT key,body FROM auxiliary WHERE job_id=? AND kind='scan' ORDER BY CAST(key AS INTEGER)").all(row.id);meta.scanPending=meta._scanDefined===false?undefined:[];for(const r of scan)meta.scanPending[Number(r.key)]=JSON.parse(r.body);auxiliary.set(row.id,{dirs:meta.dirs.length,scan:meta.scanPending?.length||0,head:meta.scanHead||0});for(const key of ['dirs','parents','scanPending'])if(meta._auxFields?.[key]===false)delete meta[key];delete meta._aux;delete meta._scanDefined;delete meta._auxFields}return {...meta,files};
  });
 }
 return {softSave,flush,save,load,remove(id){pending.delete(id);db.prepare('DELETE FROM jobs WHERE id=?').run(id);signatures.delete(id);auxiliary.delete(id)},info:()=>({engine:'SQLite',journal:'WAL',durability:'FULL'}),close:()=>{flush();db.close()}};
}
module.exports={taskStore};

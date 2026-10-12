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
 CREATE TABLE IF NOT EXISTS migrations(name TEXT PRIMARY KEY);`);
 for(const suffix of ['-wal','-shm'])if(fs.existsSync(file+suffix))fs.chmodSync(file+suffix,0o600);
 const upJob=db.prepare('INSERT INTO jobs VALUES(?,?) ON CONFLICT(id) DO UPDATE SET metadata=excluded.metadata');
 const upFile=db.prepare('INSERT INTO files VALUES(?,?,?) ON CONFLICT(job_id,position) DO UPDATE SET body=excluded.body');
 const deleteTail=db.prepare('DELETE FROM files WHERE job_id=? AND position>=?');
 const signatures=new Map(),pending=new Map();let flushTimer;function flush(){clearTimeout(flushTimer);flushTimer=null;const batch=[...pending.values()];pending.clear();for(const job of batch)save(job,[])}function softSave(job){pending.set(job.id,job);if(!flushTimer){flushTimer=setTimeout(flush,50);flushTimer.unref()}}
 function save(job,changed) {
  pending.delete(job.id);
  const {files=[],...meta}=job;const previous=signatures.get(job.id)||[];const serialized=changed===undefined?files.map(f=>JSON.stringify(f)):previous.slice();const indices=changed===undefined?files.map((_,i)=>i):changed;for(const i of indices)serialized[i]=JSON.stringify(files[i]);
  db.exec('BEGIN IMMEDIATE');
  try {
   upJob.run(job.id,JSON.stringify(meta));
   indices.forEach(i=>{const body=serialized[i];if(body!==previous[i])upFile.run(job.id,i,body)});
   if(previous.length>serialized.length)deleteTail.run(job.id,serialized.length);
   db.exec('COMMIT');for(const suffix of ['-wal','-shm'])if(fs.existsSync(file+suffix))fs.chmodSync(file+suffix,0o600); signatures.set(job.id,serialized);
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
   return {...JSON.parse(row.metadata),files};
  });
 }
 return {softSave,flush,save,load,remove(id){pending.delete(id);db.prepare('DELETE FROM jobs WHERE id=?').run(id);signatures.delete(id)},info:()=>({engine:'SQLite',journal:'WAL',durability:'FULL'}),close:()=>{flush();db.close()}};
}
module.exports={taskStore};

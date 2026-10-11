'use strict';
const {fs,path,crypto,atomic,readJSON,check}=require('./common.cjs');
// Clients get private writable snapshots; only newer tokens return to the authoritative config.
function mergeAli(current,next){
 const result=structuredClone(current);
 for(const user of result.userList||[]){const fresh=(next.userList||[]).find(x=>x.userId===user.userId);if(!fresh)continue;
  for(const field of ['openapiToken','webapiToken'])if(fresh[field]?.accessToken&&Number(fresh[field].expired||0)>Number(user[field]?.expired||0))user[field]=fresh[field];
 }return result;
}
function credentialCoordinator({directory}){
 const config=path.join(directory,'aliyunpan_config.json');let pending,lastChecked=0;
 async function isolate(fn){if(!fs.existsSync(config))return fn(directory);const dir=path.join(directory,'.clients',crypto.randomBytes(12).toString('hex'));fs.mkdirSync(dir,{recursive:true,mode:0o700});atomic(path.join(dir,'aliyunpan_config.json'),readJSON(config,{}));try{return await fn(dir)}finally{try{const next=readJSON(path.join(dir,'aliyunpan_config.json'),null),current=readJSON(config,null);if(next&&current)atomic(config,mergeAli(current,next))}finally{fs.rmSync(dir,{recursive:true,force:true})}}}
 async function ensure(refresh,signal){check(signal);if(Date.now()-lastChecked<60000)return;if(!pending)pending=isolate(refresh).then(()=>{lastChecked=Date.now()}).finally(()=>{pending=null});await pending;check(signal)}
 return{isolate,ensure,invalidate(){lastChecked=0}};
}
module.exports={credentialCoordinator,mergeAli};
function mergeQuarkFile(shared,privateFile){if(!fs.existsSync(shared)||!fs.existsSync(privateFile))return;const current=readJSON(shared,{}),next=readJSON(privateFile,{});for(const [id,record]of Object.entries(current)){if(!record||typeof record!=='object'||!record.accessToken)continue;const candidate=next[id];if(candidate?.accessToken&&Number(candidate.update_time||0)>Number(record.update_time||0))current[id]=candidate}atomic(shared,current)}
module.exports.mergeQuarkFile=mergeQuarkFile;
function mergeRclone(current,next){const blocks=text=>{const out=new Map();for(const m of text.matchAll(/^\[([^\]\r\n]+)\][\s\S]*?(?=^\[|$(?![\s\S]))/gm))out.set(m[1],m[0]);return out};const a=blocks(current),b=blocks(next);let result=current;for(const [name,block]of a){const candidate=b.get(name);if(!candidate)continue;const token=text=>{try{return JSON.parse(/^token\s*=\s*(.*)$/m.exec(text)?.[1]||'{}')}catch{return{}}};const old=token(block),fresh=token(candidate);if(fresh.access_token&&Date.parse(fresh.expiry)>Date.parse(old.expiry||'1970-01-01'))result=result.replace(block,block.replace(/^token\s*=\s*.*$/m,'token = '+JSON.stringify(fresh)))}return result}
async function rcloneSnapshot(config,fn){if(!fs.existsSync(config))return fn(config);const dir=fs.mkdtempSync(path.join(path.dirname(config),'.rclone-client-'));fs.chmodSync(dir,0o700);const privateFile=path.join(dir,'rclone.conf');fs.copyFileSync(config,privateFile);fs.chmodSync(privateFile,0o600);try{return await fn(privateFile)}finally{try{if(fs.existsSync(config)&&fs.existsSync(privateFile)){const current=fs.readFileSync(config,'utf8'),merged=mergeRclone(current,fs.readFileSync(privateFile,'utf8'));if(merged!==current){const tmp=config+'.merge-'+crypto.randomBytes(4).toString('hex');fs.writeFileSync(tmp,merged,{mode:0o600});fs.renameSync(tmp,config)}}}finally{fs.rmSync(dir,{recursive:true,force:true})}}}
module.exports.mergeRclone=mergeRclone;module.exports.rcloneSnapshot=rcloneSnapshot;

'use strict';
const {fs,path,crypto,atomic,readJSON}=require('./common.cjs');
const {execFileSync}=require('node:child_process');
const FILES=['rclone.conf','aliyun/aliyunpan_config.json','baidu/pcs_config.json','quark/codex/config.json'];
function credentialVault({root,data,key}){
 if(!key){const account=crypto.createHash('sha256').update(path.resolve(data)).digest('hex');try{key=Buffer.from(execFileSync(path.join(root,'vendor/keychain-bridge'),[account],{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']}).trim(),'base64')}catch{throw Error('无法访问 macOS 钥匙串，请允许 WeMove 访问后重新打开')}}
 if(key.length!==32)throw Error('钥匙串密钥无效');
 const sealed=path.join(data,'credentials.sealed.json'),runtime=path.join(data,'.credentials-runtime');
 // Runtime compatibility files are required by upstream clients; durable copies are encrypted.
 const encrypted=readJSON(sealed,null);let contents={};
 if(encrypted){const decipher=crypto.createDecipheriv('aes-256-gcm',key,Buffer.from(encrypted.iv,'base64'));decipher.setAuthTag(Buffer.from(encrypted.tag,'base64'));contents=JSON.parse(Buffer.concat([decipher.update(Buffer.from(encrypted.body,'base64')),decipher.final()]).toString())}
 for(const file of FILES){const original=path.join(data,file);if(fs.existsSync(original)&&!encrypted)contents[file]=fs.readFileSync(original).toString('base64')}
 // On crash, client refreshes may only exist in the runtime file. Recover those before removing it.
 for(const file of FILES){const leftover=path.join(runtime,file);if(fs.existsSync(leftover))contents[file]=fs.readFileSync(leftover).toString('base64')}
 fs.mkdirSync(runtime,{recursive:true,mode:0o700});
 for(const [file,body]of Object.entries(contents)){if(!FILES.includes(file))throw Error('凭据存储记录无效');const dest=path.join(runtime,file);fs.mkdirSync(path.dirname(dest),{recursive:true,mode:0o700});fs.writeFileSync(dest,Buffer.from(body,'base64'),{mode:0o600});fs.chmodSync(dest,0o600)}
 let last='';
 function seal(){const next={};for(const file of FILES){const dest=path.join(runtime,file);if(fs.existsSync(dest)){fs.chmodSync(dest,0o600);next[file]=fs.readFileSync(dest).toString('base64')}}const plain=JSON.stringify(next);if(plain===last)return;const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const body=Buffer.concat([cipher.update(plain),cipher.final()]);atomic(sealed,{version:1,iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),body:body.toString('base64')});last=plain}
 seal();for(const file of FILES)fs.rmSync(path.join(data,file),{force:true});
 return {runtime,seal,close(){seal();fs.rmSync(runtime,{recursive:true,force:true});key.fill(0)},status:'keychain'};
}
module.exports={credentialVault};

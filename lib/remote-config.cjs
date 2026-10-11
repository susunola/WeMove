'use strict';
const {fs,path,exec}=require('./common.cjs');
function validateRemoteInput(provider,input){
 if(!['weiyun','pan115','icloud'].includes(provider))throw Error('不支持此连接方式');
 const user=String(input.user||'').trim(),password=String(input.password||'');
 if(!user||user.length>320||/[\r\n\0]/.test(user)||!password||password.length>4096||/[\r\n\0]/.test(password))throw Error('请填写有效的账号和密码');
 if(provider==='icloud'){if(!user.includes('@'))throw Error('请填写 Apple ID 邮箱');return{user,password}}
 let url;try{url=new URL(String(input.endpoint||''))}catch{throw Error('请填写有效的 WebDAV 地址')}
 if(url.username||url.password||url.search||url.hash||!['https:','http:'].includes(url.protocol)||url.protocol==='http:'&&!['localhost','127.0.0.1','[::1]'].includes(url.hostname))throw Error('WebDAV 地址须使用 HTTPS 或本机 HTTP 地址');
 return{user,password,endpoint:url.href};
}
async function saveRemoteConfig({provider,input,config,root,env,verify}){
 const checked=validateRemoteInput(provider,input);
 const hidden=(await exec(path.join(root,'vendor/rclone'),['obscure','-'],{env,input:checked.password})).output.trim();
 const old=fs.existsSync(config)?fs.readFileSync(config,'utf8'):'';
 const stripped=old.replace(new RegExp('^\\['+provider+'\\][\\s\\S]*?(?=^\\[|$(?![\\s\\S]))','m'),'').trim();
 const section=provider==='icloud'?`type = iclouddrive\napple_id = ${checked.user}\npassword = ${hidden}\nservice = drive`:`type = webdav\nurl = ${checked.endpoint}\nvendor = other\nuser = ${checked.user}\npass = ${hidden}`;
 fs.writeFileSync(config+'.tmp',stripped+`\n\n[${provider}]\n${section}\n`,{mode:0o600});fs.renameSync(config+'.tmp',config);fs.chmodSync(config,0o600);
 try{await verify?.()}catch(error){if(old){fs.writeFileSync(config+'.tmp',old,{mode:0o600});fs.renameSync(config+'.tmp',config);fs.chmodSync(config,0o600)}else fs.rmSync(config,{force:true});throw error}
}
module.exports={validateRemoteInput,saveRemoteConfig};

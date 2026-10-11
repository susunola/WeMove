'use strict';
const {fs,path,exec}=require('./common.cjs');
const TYPES={gdrive:'drive',dropbox:'dropbox',box:'box',pcloud:'pcloud',mega:'mega',nextcloud:'webdav',webdav:'webdav',ftp:'ftp',sftp:'sftp',smb:'smb'};
function value(input,key,required=false){const v=String(input[key]??'').trim();if(v.length>4096||/[\r\n\0]/.test(v)||required&&!v)throw Error('连接信息无效：'+key);return v}
function validateExtended(provider,input){if(!TYPES[provider])throw Error('不支持此存储');const c={type:TYPES[provider]};
 if(['gdrive','dropbox','box','pcloud'].includes(provider)){let token;try{token=JSON.parse(value(input,'token',true))}catch{throw Error('请填写有效的 OAuth Token JSON')}if(!token.access_token||typeof token.access_token!=='string')throw Error('OAuth Token 缺少 access_token');c.token=JSON.stringify(token);if(provider==='gdrive')c.scope='drive';return c}
 c.user=value(input,'user',true);const pass=String(input.password??'');if(!pass||pass.length>4096||/[\r\n\0]/.test(pass))throw Error('请填写有效的密码');c.pass=pass;
 if(['nextcloud','webdav'].includes(provider)){let u;try{u=new URL(value(input,'endpoint',true))}catch{throw Error('请填写有效的 WebDAV 地址')}if(u.username||u.password||u.search||u.hash||!['https:','http:'].includes(u.protocol))throw Error('WebDAV 地址无效');c.url=u.href;c.vendor=provider==='nextcloud'?'nextcloud':'other'}
 else if(provider==='mega'){const code=value(input,'twoFactor');if(code)throw Error('MEGA 双重认证账号暂不支持，请使用其他存储');}
 else{c.host=value(input,'host',true);if(!/^[A-Za-z0-9.\-:\[\]_]+$/.test(c.host))throw Error('请填写主机名或 IP 地址');const port=value(input,'port')||({ftp:21,sftp:22,smb:445}[provider]);if(!/^\d+$/.test(String(port))||+port<1||+port>65535)throw Error('端口需要 1 至 65535');c.port=String(port);
 if(provider==='ftp'){const mode=value(input,'security')||'explicit';if(!['explicit','implicit','none'].includes(mode))throw Error('FTP 安全模式无效');c.tls=String(mode==='implicit');c.explicit_tls=String(mode==='explicit')}
 if(provider==='sftp'){c.known_hosts_file=value(input,'knownHosts',true);if(!path.isAbsolute(c.known_hosts_file)||!fs.existsSync(c.known_hosts_file)||!fs.statSync(c.known_hosts_file).isFile())throw Error('请选择现有的 SSH known_hosts 文件')}
 if(provider==='smb')c.domain=value(input,'domain')||'WORKGROUP';}
 return c;
}
async function saveExtended({provider,input,config,root,env,verify}){const c=validateExtended(provider,input);if(c.pass)c.pass=(await exec(path.join(root,'vendor/rclone'),['obscure','-'],{env,input:c.pass})).output.trim();const old=fs.existsSync(config)?fs.readFileSync(config,'utf8'):'';const stripped=old.replace(new RegExp('^\\['+provider+'\\][\\s\\S]*?(?=^\\[|$(?![\\s\\S]))','m'),'').trim();fs.mkdirSync(path.dirname(config),{recursive:true,mode:0o700});const write=s=>{fs.writeFileSync(config+'.tmp',s,{mode:0o600});fs.renameSync(config+'.tmp',config);fs.chmodSync(config,0o600)};write(stripped+'\n\n['+provider+']\n'+Object.entries(c).map(([k,v])=>k+' = '+v).join('\n')+'\n');try{await verify()}catch(e){if(old)write(old);else fs.rmSync(config,{force:true});throw e}}
module.exports={TYPES,validateExtended,saveExtended};

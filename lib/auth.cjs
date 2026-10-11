'use strict';
const {fs,path,exec,jsonResult,redact,quarkEnv}=require('./common.cjs');const {spawn}=require('child_process');
function createAuth({root,data,credentialData=data,env,providers,log}){
 let child=null,timer=null,current=null,configState='',credentialBusy=false;const state={status:'idle',provider:'',url:'',message:'',option:null};
 const OAUTH={onedrive:'onedrive',gdrive:'drive',dropbox:'dropbox',box:'box',pcloud:'pcloud'};
 const files={ali:path.join(credentialData,'aliyun/aliyunpan_config.json'),quark:path.join(credentialData,'quark/codex/config.json'),baidu:path.join(credentialData,'baidu/pcs_config.json'),onedrive:providers.config,nutcloud:providers.config,s3:providers.config,weiyun:providers.config,icloud:providers.config,pan115:providers.config,...Object.fromEntries(require('./providers.cjs').RCLONE_PROVIDERS.map(p=>[p,providers.config]))};
 function permissions(){for(const f of Object.values(files))if(fs.existsSync(f))fs.chmodSync(f,0o600)}
 function clear(){if(timer)clearTimeout(timer);timer=null;child=null;permissions()}
 function cancel(){state.status='cancelled';state.message='已取消本次连接';state.url='';state.option=null;child?.kill('SIGTERM');clear()}
 function safeURL(raw){try{const u=new URL(raw);return u.protocol==='https:'&&(['openapi.alipan.com','pan.quark.cn','open-api-drive.quark.cn','login.microsoftonline.com','login.live.com','accounts.google.com','www.dropbox.com','dropbox.com','account.box.com','app.box.com','my.pcloud.com','e.pcloud.com'].includes(u.hostname))||u.protocol==='http:'&&u.hostname==='127.0.0.1'&&u.port==='53682'}catch{return false}}
 function openLink(url){if(!safeURL(url))return;state.url=url;const p=spawn('/usr/bin/open',[url]);p.on('error',()=>{state.message='请点击页面中的授权链接完成连接。'})}
 function question(j){configState=j.State||'';if(!configState){state.status='success';state.url='';state.message=providers.labels[state.provider]+' 已连接。';state.option=null;return}const o=j.Option||{};const help={config_type:'请选择 OneDrive 类型',config_driveid:'请选择要连接的云盘',config_driveok:'确认选择此云盘',config_is_local:'是否通过浏览器授权'};state.status='question';state.message=j.Error||help[o.Name]||o.Help?.split('\n')[0]||'请选择授权选项';state.option={name:o.Name,help:o.Help,default:o.IsPassword?'':String(o.Default??''),isPassword:!!o.IsPassword,choices:(o.Examples||[]).map(x=>({value:String(x.Value),label:x.Help||x.Value})),exclusive:!!o.Exclusive};state.url=''}
 function launch(p,args,rcMode=false,result){
  state.provider=p;state.status='waiting';state.option=null;state.message='正在获取授权链接…';state.url='';current=p;
  const exe=p==='ali'?path.join(root,'vendor/aliyunpan'):p==='quark'?process.execPath:path.join(root,'vendor/rclone');
  const c=spawn(exe,args,{env:p==='quark'?quarkEnv(env):result===undefined?env:{...env,RCLONE_RESULT:result},cwd:data,stdio:['pipe','pipe','pipe']});child=c;let output='',buffer='',success=false,failed=false;
  function read(b,isErr=false){const text=b.toString();if(!isErr)output+=text;buffer=(buffer+text).slice(-32000);for(const raw of buffer.match(/https?:\/\/[^\s"'<>\\]+/g)||[]){if(safeURL(raw)&&state.url!==raw){if(p==='ali')openLink(raw);else state.url=raw}}
   if(p==='ali'){if(buffer.includes('请在浏览器里面完成扫码登录'))state.message='请完成浏览器授权和扫码，然后点击“已完成扫码，继续”。';if(buffer.includes('登录成功'))success=true;if(buffer.includes('登录失败'))failed=true}
   else if(p==='quark'){for(const line of output.split(/\r?\n/))try{const j=JSON.parse(line);if(j.type==='result'){success=j.code===0||j.code===-118;failed=!success;state.message=redact(j.msg||'授权已返回结果')}}catch{}}
   else state.message=p==='icloud'?'请完成 Apple ID 验证。':'请在浏览器完成 '+providers.labels[p]+' 授权。';
  }
  c.stdout.on('data',b=>read(b));c.stderr.on('data',b=>read(b,true));c.on('error',e=>{state.status='failed';state.message='登录客户端启动失败：'+e.message;clear()});c.on('close',code=>{if(child!==c)return;clear();if(['cancelled','failed'].includes(state.status))return;if(rcMode&&code===0){try{const j=JSON.parse(output);question(j);if(j.Option?.Name==='config_is_local')continueAnswer('true')}catch(e){state.status='failed';state.message=providers.labels[p]+' 授权返回异常：'+e.message}}else if(code===0&&success&&!failed){state.status='success';state.url='';state.message=providers.labels[p]+' 已连接。'}else{state.status='failed';state.url='';state.message=p==='quark'&&failed?state.message:'授权未完成，请重新连接。'}});
  timer=setTimeout(()=>{if(child===c){state.status='failed';state.message='授权等待超时，请重新连接。';c.kill('SIGTERM');clear()}},6*60*1000);
 }
 function start(p){if(child||credentialBusy||state.status==='question')throw Error('请先完成或取消当前连接');if(!['ali','quark',...Object.keys(OAUTH)].includes(p))throw Error('此网盘需要填写连接信息');configState='';if(p==='ali')launch(p,['login']);else if(p==='quark')launch(p,[path.join(credentialData,'quark/scripts/quark-drive.cjs'),'login']);else launch(p,['--config',providers.config,'config','create',p,OAUTH[p],...(p==='gdrive'?['scope','drive']:[]),'--non-interactive'],true)}
 function continueAnswer(answer){if(current==='ali'&&child){child.stdin.write('\n');state.message='正在确认登录…';return}if(![...Object.keys(OAUTH),'icloud'].includes(current)||!configState||child)throw Error('没有等待回答的授权步骤');if(typeof answer!=='string'||answer.length>4096)throw Error('授权选项无效');launch(current,['--config',providers.config,'config','update',current,'--non-interactive','--continue','--state',configState],true,answer)}
 async function credentials(p,b){if(child||credentialBusy||state.status==='question')throw Error('请先完成当前连接');credentialBusy=true;try{if(['gdrive','dropbox','box','pcloud','mega','nextcloud','ftp','sftp','webdav','smb'].includes(p)){await require('./extended-storage.cjs').saveExtended({provider:p,input:b,config:providers.config,root,env,verify:()=>providers.list(providers.root(p))});
 }else if(['weiyun','pan115','icloud'].includes(p)){await require('./remote-config.cjs').saveRemoteConfig({provider:p,input:b,config:providers.config,root,env,verify:p==='icloud'?undefined:()=>providers.list(providers.root(p))});if(p==='icloud'){configState='';launch(p,['--config',providers.config,'config','update',p,'--non-interactive'],true);return}
 }else if(p==='nutcloud'){
  if(typeof b.user!=='string'||!b.user.includes('@')||/[\r\n]/.test(b.user)||typeof b.password!=='string'||!b.password)throw Error('请填写坚果云邮箱和第三方应用密码');
  const obscure=await exec(path.join(root,'vendor/rclone'),['obscure','-'],{env,input:b.password});let old=fs.existsSync(providers.config)?fs.readFileSync(providers.config,'utf8'):'';old=old.replace(/^\[nutcloud\][\s\S]*?(?=^\[|$(?![\s\S]))/m,'');const content=old.trim()+`\n\n[nutcloud]\ntype = webdav\nurl = https://dav.jianguoyun.com/dav/\nvendor = other\nuser = ${b.user.trim()}\npass = ${obscure.output.trim()}\n`;fs.writeFileSync(providers.config+'.tmp',content,{mode:0o600});fs.renameSync(providers.config+'.tmp',providers.config);
 }else if(p==='s3'){await require('./s3-config.cjs').saveS3({input:b,root,data,config:providers.config,env});providers.invalidate?.(null);
 }else if(p==='baidu'){
  let bduss=String(b.bduss||''),cookies=String(b.cookies||'');if(!bduss&&cookies){bduss=/(?:^|;\s*)BDUSS=([^;]+)/.exec(cookies)?.[1]||''}if(!bduss||/[\r\n]/.test(bduss)||cookies.length>30000)throw Error('需要有效的 BDUSS 或包含 BDUSS 的百度登录 Cookie');const z=await exec(path.join(root,'vendor/baidu-bridge'),['login'],{env,cwd:data,input:JSON.stringify({bduss,cookies,stoken:b.stoken||''})});if(!jsonResult(z).ok)throw Error('百度登录校验失败');
 }else throw Error('不支持此连接方式');permissions();await providers.list(providers.root(p));state.provider=p;state.status='success';state.message=providers.labels[p]+' 已连接。';state.url='';state.option=null;
 }finally{credentialBusy=false}}
 return {state,start,continueAnswer,cancel,credentials,permissions,busy:()=>!!child||credentialBusy||state.status==='question'};
}
module.exports={createAuth};

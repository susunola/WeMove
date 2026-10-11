'use strict';
const {fs,path,crypto,atomic,readJSON}=require('./common.cjs');
const {makeProviders,LABELS}=require('./providers.cjs');
function accountProviders({root,data,env,vaultFactory}){
 const file=path.join(data,'accounts.json');let saved=readJSON(file,{accounts:[],active:{}});const instances=new Map(),vaults=new Map();
 const persist=()=>atomic(file,saved);
 function entries(){return Object.keys(LABELS).flatMap(provider=>[{id:'default',provider,name:LABELS[provider]},...saved.accounts.filter(a=>a.provider===provider)]).map(a=>({...a,active:(saved.active[a.provider]||'default')===a.id}))}
 function context(provider,id='default'){
  if(!Object.hasOwn(LABELS,provider)||id!=='default'&&!saved.accounts.some(a=>a.id===id&&a.provider===provider))throw Error('账号不存在，请重新选择');
  const key=provider+':'+id;if(instances.has(key))return instances.get(key);
  const dir=id==='default'?data:path.join(data,'accounts',id);fs.mkdirSync(dir,{recursive:true,mode:0o700});
  if(vaultFactory&&!vaults.has(dir))vaults.set(dir,vaultFactory({root,data:dir}));const vault=vaults.get(dir);const credentialData=vault?.runtime||dir;const clientEnv={...env,ALIYUNPAN_CONFIG_DIR:path.join(credentialData,'aliyun'),BAIDUPCS_GO_CONFIG_DIR:path.join(credentialData,'baidu')};
  for(const p of ['aliyun','baidu','quark/scripts'])fs.mkdirSync(path.join(credentialData,p),{recursive:true,mode:0o700});
  for(const name of ['quark-drive.cjs','hash-worker.cjs'])fs.copyFileSync(path.join(root,'vendor/quark/scripts',name),path.join(credentialData,'quark/scripts',name));
  const providers=makeProviders({root,data:dir,credentialData,env:clientEnv});const result={root,data:dir,credentialData,env:clientEnv,providers,vault};instances.set(key,result);return result;
 }
 const active=p=>context(p,saved.active[p]||'default');
 function validate(ref){const account=ref?.account||'default';return {...context(ref?.provider,account).providers.validate(ref),account}}
 const wrapper={visibleProviders(){const defaults=["ali","quark","onedrive","nutcloud","baidu","weiyun","icloud","pan115","s3"];return Object.keys(LABELS).filter(p=>defaults.includes(p)||saved.accounts.some(a=>a.provider===p))},sealCredentials(){for(const v of vaults.values())v.seal()},closeCredentials(){require('./client-pool.cjs').closeClients();for(const v of vaults.values())v.close()},quota:ref=>context(ref.provider,ref.account||'default').providers.quota(ref),labels:LABELS,validate,root:p=>({...active(p).providers.root(p),account:saved.active[p]||'default'}),get:ref=>context(ref.provider,ref.account||'default').providers.get(ref),list:(ref,o)=>context(ref.provider,ref.account||'default').providers.list(ref,o),find:(ref,n,o)=>context(ref.provider,ref.account||'default').providers.find(ref,n,o),mkdir:(ref,n,o)=>context(ref.provider,ref.account||'default').providers.mkdir(ref,n,o),aliMeta:ref=>(ref?context('ali',ref.account||'default'):active('ali')).providers.aliMeta(),s3Meta:ref=>context('s3',ref?.account||saved.active.s3||'default').providers.s3Meta(),accounts:entries,context,activeContext:active,
  addAccount(provider,label){if(!Object.hasOwn(LABELS,provider))throw Error('网盘类型无效');label=String(label||'').trim();if(!label||label.length>80)throw Error('账号名称需要 1 至 80 个字符');if(saved.accounts.length>=100)throw Error('账号数量达到上限');const a={id:crypto.randomBytes(12).toString('hex'),provider,name:label};saved.accounts.push(a);saved.active[provider]=a.id;persist();return a},
  selectAccount(provider,id){context(provider,id);saved.active[provider]=id;persist();return wrapper.root(provider)}
 };
 return wrapper;
}
module.exports={accountProviders};

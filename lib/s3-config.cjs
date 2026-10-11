'use strict';
const {fs,path,crypto,atomic,readJSON,exec}=require('./common.cjs');
const TYPES=new Set(['AWS','Other','Minio','Cloudflare','Ceph','Alibaba','TencentCOS','Wasabi','DigitalOcean']);
function clean(value,label,{required=false,max=4096}={}){
 const text=String(value??'').trim();
 if((required&&!text)||text.length>max||/[\r\n\x00]/.test(text))throw Error('S3 '+label+' 无效');
 return text;
}
function parseS3(input){
 const provider=clean(input.s3Provider||'Other','服务类型');if(!TYPES.has(provider))throw Error('S3 服务类型无效');
 const bucket=clean(input.bucket,'Bucket',{required:true,max:255});
 if(!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(bucket)||bucket==='.'||bucket==='..')throw Error('S3 Bucket 无效');
 let endpoint=clean(input.endpoint,'Endpoint');
 if(endpoint){let url;try{url=new URL(endpoint)}catch{throw Error('S3 Endpoint 需要完整的 http(s) 地址')}
 if(!['https:','http:'].includes(url.protocol)||url.username||url.password||url.search||url.hash||!url.hostname||url.pathname!=='/')throw Error('S3 Endpoint 需要服务根地址，不能包含路径或凭据');endpoint=url.origin;
 }else if(provider!=='AWS')throw Error('请填写 S3 Endpoint');
 const region=clean(input.region||(provider==='Cloudflare'?'auto':'us-east-1'),'Region',{max:128});
 if(!/^[a-zA-Z0-9_-]+$/.test(region))throw Error('S3 Region 无效');
 const accessKey=clean(input.accessKey,'Access Key',{required:true}),secretKey=clean(input.secretKey,'Secret Key',{required:true}),sessionToken=clean(input.sessionToken,'Session Token');
 const pathStyle=input.pathStyle!==false;
 const id=crypto.createHash('sha256').update(JSON.stringify({provider,bucket,endpoint,region,accessKey,pathStyle})).digest('hex').slice(0,24);
 return {provider,bucket,endpoint,region,accessKey,secretKey,sessionToken,pathStyle,id};
}
async function saveS3({input,root,data,config,env}){
 const c=parseS3(input),metaFile=path.join(data,'s3-connection.json');
 const oldConfig=fs.existsSync(config)?fs.readFileSync(config,'utf8'):null,oldMeta=fs.existsSync(metaFile)?fs.readFileSync(metaFile):null;
 const stripped=(oldConfig||'').replace(/^\[s3\][\s\S]*?(?=^\[|$(?![\s\S]))/m,'').trim();
 const content=stripped+'\n\n[s3]\n'+Object.entries({type:'s3',provider:c.provider,env_auth:'false',access_key_id:c.accessKey,secret_access_key:c.secretKey,session_token:c.sessionToken,region:c.region,endpoint:c.endpoint,force_path_style:String(c.pathStyle),directory_markers:'true',no_check_bucket:'true'}).map(([k,v])=>k+' = '+v).join('\n')+'\n';
 const temp=config+'.s3-test';fs.writeFileSync(temp,content,{mode:0o600});
 try{
  await exec(path.join(root,'vendor/rclone'),['--config',temp,'lsjson','s3:'+c.bucket,'--max-depth','1','--retries','1','--low-level-retries','1'],{env,cwd:data,timeout:30000});
  fs.renameSync(temp,config);fs.chmodSync(config,0o600);
  try{atomic(metaFile,{id:c.id,bucket:c.bucket,endpoint:c.endpoint,region:c.region,provider:c.provider,pathStyle:c.pathStyle})}catch(error){if(oldConfig===null)fs.rmSync(config,{force:true});else fs.writeFileSync(config,oldConfig,{mode:0o600});if(oldMeta!==null)fs.writeFileSync(metaFile,oldMeta,{mode:0o600});throw error}
  return readJSON(metaFile,{});
 }finally{fs.rmSync(temp,{force:true})}
}
module.exports={parseS3,saveS3};

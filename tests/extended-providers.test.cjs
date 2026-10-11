'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),net=require('node:net'),{spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),{validateRemoteInput,saveRemoteConfig}=require('../lib/remote-config.cjs'),{makeProviders,LABELS}=require('../lib/providers.cjs');
test('new provider order keeps S3 last; gateway configuration rejects injection and unsafe URLs',()=>{
 assert.equal(Object.keys(LABELS).at(-1),'s3');for(const p of ['weiyun','icloud','pan115'])assert(LABELS[p]);
 for(const endpoint of ['file:///tmp','https://user:pass@example.com/dav','http://example.com/dav','https://example.com/dav?token=secret'])assert.throws(()=>validateRemoteInput('weiyun',{endpoint,user:'test',password:'secret'}));
 assert.throws(()=>validateRemoteInput('pan115',{endpoint:'https://example.com/dav',user:'test\n[other]',password:'secret'}));
 assert.throws(()=>validateRemoteInput('icloud',{user:'invalid',password:'secret'}));assert.equal(validateRemoteInput('icloud',{user:'test@example.com',password:'secret'}).user,'test@example.com');
});
test('real WebDAV transport browses, uploads, downloads and moves both gateway providers',async()=>{
 const data=fs.mkdtempSync(path.join(os.tmpdir(),'wemove-gateway-')),storage=path.join(data,'storage');fs.mkdirSync(storage);
 const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p))})});
 const child=spawn(path.join(root,'vendor/rclone'),['serve','webdav',storage,'--addr','127.0.0.1:'+port,'--user','test','--pass','test-pass'],{stdio:'ignore'});
 try{let ready=false;for(let i=0;i<100;i++){try{await fetch('http://127.0.0.1:'+port);ready=true;break}catch{await new Promise(r=>setTimeout(r,20))}}assert(ready);
 const config=path.join(data,'rclone.conf');fs.writeFileSync(config,'[existing]\ntype = local\n');
 for(const provider of ['weiyun','pan115']){
  await saveRemoteConfig({provider,input:{endpoint:'http://127.0.0.1:'+port+'/',user:'test',password:'test-pass'},config,root,env:process.env});
  const providers=makeProviders({root,data,env:process.env}),ref=providers.root(provider),dest=await providers.mkdir(ref,provider);const file=path.join(data,provider+'.txt');fs.writeFileSync(file,'verified gateway content');
  await providers.get(dest).upload(dest,file,{});const found=await providers.find(dest,path.basename(file),{fresh:true});assert(found);assert.equal(found.size,24);
  const output=path.join(data,provider+'.out');await providers.get(found.ref).download(found.ref,output,{size:found.size});assert.equal(fs.readFileSync(output,'utf8'),'verified gateway content');
  const bin=await providers.mkdir(ref,provider+'-trash');await providers.get(found.ref).move(found.ref,bin,false);assert(await providers.find(bin,path.basename(file)));assert.equal(await providers.find(dest,path.basename(file)),undefined);
 }
 const conf=fs.readFileSync(config,'utf8');assert(conf.includes('[existing]'));assert(!conf.includes('test-pass'));assert.equal(fs.statSync(config).mode&0o777,0o600);
 }finally{child.kill('SIGTERM');await new Promise(r=>child.once('close',r));fs.rmSync(data,{recursive:true,force:true})}
});

test('iCloud two-factor flow keeps password out of argv and sends answers through environment',async()=>{
 const C=require('../lib/common.cjs'),cp=require('node:child_process'),EventEmitter=require('node:events'),original=cp.spawn;const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wemove-icloud-auth-'));let child,args,env;
 cp.spawn=(exe,a,o)=>{args=a;env=o.env;child=new EventEmitter();child.stdout=new EventEmitter();child.stderr=new EventEmitter();child.stdin={write(){}};child.kill=()=>child.emit('close',143);return child};delete require.cache[require.resolve('../lib/auth.cjs')];const auth=require('../lib/auth.cjs').createAuth({root,data:dir,env:process.env,providers:{config:path.join(dir,'rclone.conf'),labels:LABELS},log(){}});
 try{await auth.credentials('icloud',{user:'test@example.com',password:'private-password'});assert(!args.includes('private-password'));assert.equal(auth.state.status,'waiting');assert(!fs.readFileSync(path.join(dir,'rclone.conf'),'utf8').includes('private-password'));
 child.stdout.emit('data',Buffer.from(JSON.stringify({State:'2fa',Option:{Name:'config_2fa',Help:'Verification code',IsPassword:true}})));child.emit('close',0);assert.equal(auth.state.status,'question');assert.equal(auth.state.option.isPassword,true);
 auth.continueAnswer('123456');assert.equal(env.RCLONE_RESULT,'123456');assert(!args.includes('123456'));child.stdout.emit('data',Buffer.from(JSON.stringify({State:''})));child.emit('close',0);assert.equal(auth.state.status,'success');assert.equal(auth.state.message,'iCloud Drive 已连接。');
 }finally{auth.cancel();cp.spawn=original;delete require.cache[require.resolve('../lib/auth.cjs')];fs.rmSync(dir,{recursive:true,force:true})}
});

test('failed gateway validation restores the previous remote configuration',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wemove-config-rollback-')),config=path.join(dir,'rclone.conf'),old='[weiyun]\ntype = webdav\nurl = https://old.example/dav/\n';try{fs.writeFileSync(config,old);
 await assert.rejects(saveRemoteConfig({provider:'weiyun',input:{endpoint:'https://new.example/dav/',user:'test',password:'private'},config,root,env:process.env,verify:async()=>{throw Error('401 unauthorized')}}),/401/);assert.equal(fs.readFileSync(config,'utf8'),old);
 }finally{fs.rmSync(dir,{recursive:true,force:true})}
});

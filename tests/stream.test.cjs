const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('fs'),path=require('path'),os=require('os');const {streamDownload}=require('../lib/stream-download.cjs');
test('真实子进程断流后从已有字节继续，不重新输出前缀',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pan-stream-')),file=path.join(dir,'a.bin');const script=`const offset=Number(process.argv[process.argv.indexOf('--offset')+1]);const b=Buffer.from('abcdefghij');if(offset===0)process.stdout.write(b.subarray(0,5),()=>{process.stderr.write('ECONNRESET');process.exit(1)});else{if(offset!==5)throw Error('wrong offset');process.stdout.write(b.subarray(offset))}`;try{await assert.rejects(streamDownload(process.execPath,['-e',script,'--'],file,{size:10}),/ECONNRESET/);assert.equal(fs.readFileSync(file,'utf8'),'abcde');await streamDownload(process.execPath,['-e',script,'--'],file,{size:10});assert.equal(fs.readFileSync(file,'utf8'),'abcdefghij')}finally{fs.rmSync(dir,{recursive:true,force:true})}});
test('rclone 实际 cat offset 续传完整二进制',async()=>{const dir=fs.mkdtempSync(path.join(os.tmpdir(),'pan-range-')),source=path.join(dir,'source.bin'),dest=path.join(dir,'cache.bin'),data=Buffer.alloc(256*1024);for(let i=0;i<data.length;i++)data[i]=i%251;fs.writeFileSync(source,data);fs.writeFileSync(dest,data.subarray(0,12345));try{await streamDownload(path.resolve(__dirname,'../vendor/rclone'),['cat',source],dest,{size:data.length});assert.deepEqual(fs.readFileSync(dest),data)}finally{fs.rmSync(dir,{recursive:true,force:true})}});

test('resumed progress reports cached bytes before counting new network bytes',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wemove-resume-rate-')),file=path.join(dir,'a');const events=[];
 try{fs.writeFileSync(file,'abc');await streamDownload(process.execPath,['-e',"process.stdout.write('def')",'--'],file,{size:6,onProgress:p=>events.push(p)});assert.deepEqual(events[0],{current:3,total:6,resumed:true});assert.equal(events.at(-1).current,6);assert.equal(fs.readFileSync(file,'utf8'),'abcdef')}
 finally{fs.rmSync(dir,{recursive:true,force:true})}
});

test('silent download times out, exits and preserves bytes for subsequent resume',async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'wemove-stall-')),file=path.join(dir,'a');
 try{await assert.rejects(streamDownload(process.execPath,['-e',"process.stdout.write('abc');setInterval(()=>{},1000)",'--'],file,{size:6,idleTimeoutMs:200}),/ETIMEDOUT/);assert.equal(fs.readFileSync(file,'utf8'),'abc');
 await streamDownload(process.execPath,['-e',"process.stdout.write('def')",'--'],file,{size:6,idleTimeoutMs:1000});assert.equal(fs.readFileSync(file,'utf8'),'abcdef');}
 finally{fs.rmSync(dir,{recursive:true,force:true})}
});

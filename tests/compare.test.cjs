'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),compare=require('../compare.js');
const file=(name,size=10,extra={})=>({name,size,isDir:false,...extra});
test('目录对比区分缺失、类型、大小、哈希及未知内容',()=>{
 const left=[file('左'),file('类型'),file('大小'),file('一致',10,{hash:'ABC',hashType:'sha1'}),file('哈希',10,{hash:'abc',hashType:'sha1'}),file('未知'),file('目录',0,{isDir:true})];
 const right=[file('右'),file('类型',0,{isDir:true}),file('大小',20),file('一致',10,{hash:'abc',hashType:'sha1'}),file('哈希',10,{hash:'def',hashType:'sha1'}),file('未知'),file('目录',0,{isDir:true})];
 assert.deepEqual(Object.fromEntries(compare(left,right).map(x=>[x.name,x.status])),{'左':'left','右':'right','类型':'different','大小':'different','一致':'same','哈希':'different','未知':'unknown','目录':'folder'});
});
test('异种哈希、重复名称与缺失大小不误判一致',()=>{
 const rows=compare([file('异种',10,{hash:'abc',hashType:'sha1'}),file('重复'),file('重复'),file('无大小',undefined,{size:undefined})],[file('异种',10,{hash:'abc',hashType:'md5'}),file('重复'),file('无大小',20)]);
 assert.ok(rows.every(x=>x.status==='unknown'));assert.deepEqual(compare([],[]),[]);
});

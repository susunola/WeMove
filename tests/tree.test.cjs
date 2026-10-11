'use strict';
const test=require('node:test'),assert=require('node:assert/strict');const {compareTree,missingPaths}=require('../lib/compare-tree.cjs');
function providers(tree){return {list:async ref=>(tree[ref.path]||[]).map(e=>({...e,ref:{provider:ref.provider,path:ref.path+'/'+e.name}}))}}
const file=(name,size=1,isDir=false)=>({name,size,isDir});
test('递归对比发现同名目录内缺失文件，不复制已有或类型冲突子项',async()=>{
 const p=providers({'/a':[file('共有',0,true),file('冲突',0,true)],'/b':[file('共有',0,true),file('冲突')],'/a/共有':[file('缺失'),file('已有')],'/b/共有':[file('已有')],'/a/冲突':[file('不复制')]});
 const rows=await compareTree(p,{provider:'ali',path:'/a'},{provider:'quark',path:'/b'},{recursive:true});assert.deepEqual(missingPaths(rows,'left'),['共有/缺失']);
});
test('当前层对比不递归，扩展名排除有效',async()=>{const p=providers({'/a':[file('a.tmp'),file('b'),file('dir',0,true)],'/b':[],'/a/dir':[file('child')]});const rows=await compareTree(p,{path:'/a'},{path:'/b'},{exclude:['.tmp']});assert.deepEqual(rows.map(x=>x.name),['b','dir'])});

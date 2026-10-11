(function(root){
'use strict';
function compare(left,right){
 const a=new Map(),b=new Map();for(const e of left){if(!a.has(e.name))a.set(e.name,[]);a.get(e.name).push(e)}for(const e of right){if(!b.has(e.name))b.set(e.name,[]);b.get(e.name).push(e)}
 return [...new Set([...a.keys(),...b.keys()])].sort((x,y)=>x.localeCompare(y,'zh-CN')).map(name=>{
 const aa=a.get(name)||[],bb=b.get(name)||[],l=aa[0],r=bb[0];let status,reason;
 if(aa.length>1||bb.length>1){status='unknown';reason='同名项目重复，需人工核实'}
 else if(!l){status='right';reason='仅右侧存在'}else if(!r){status='left';reason='仅左侧存在'}
 else if(l.isDir!==r.isDir){status='different';reason='文件与文件夹类型不同'}
 else if(l.isDir){status='folder';reason='两边均为文件夹，未比较内部内容'}
 else if(Number.isFinite(l.size)&&Number.isFinite(r.size)&&l.size!==r.size){status='different';reason='文件大小不同'}
 else if(l.hash&&r.hash&&l.hashType&&l.hashType===r.hashType){status=l.hash.toLowerCase()===r.hash.toLowerCase()?'same':'different';reason=status==='same'?'校验值一致':'校验值不同'}
 else {status='unknown';reason='缺少可比校验值，内容待核实'}
 return {name,status,reason,left:l,right:r};
 });
}
if(typeof module==='object'&&module.exports)module.exports=compare;else root.compareDirectories=compare;
})(globalThis);

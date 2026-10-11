'use strict';
const compare=require('../compare.js');
const {name,check}=require('./common.cjs');
const {compileFilters}=require('./filters.cjs');
async function compareTree(providers,left,right,{recursive=false,exclude=[],signal,fresh=false,excludeDirs=[],topNames=[],filters={}}={}){
 const top=new Set(topNames),excludedDirs=new Set(excludeDirs);const suffixes=exclude.map(x=>String(x).trim().toLowerCase()).filter(Boolean);if(suffixes.length>30)throw Error('排除类型过多');
 const fileFilter=compileFilters({excludeExt:suffixes,...filters});
 async function scan(ref){const rows=[],seen=new Set();async function walk(parent,prefix,depth){check(signal);if(depth>128)throw Error('目录层级过深');const k=JSON.stringify(parent);if(seen.has(k))throw Error('目录出现循环');seen.add(k);for(const e of await providers.list(parent,{signal,fresh})){if(e.isDir&&excludedDirs.has(e.name)||!prefix&&top.size&&!top.has(e.name))continue;const rel=prefix?prefix+'/'+name(e.name):name(e.name);if(!e.isDir&&!fileFilter({...e,name:rel}))continue;if(rows.length>=100000)throw Error('对比超过十万个项目，请分目录');rows.push({...e,name:rel});if(recursive&&e.isDir)await walk(e.ref,rel,depth+1)}}await walk(ref,'',0);return rows}
 const [a,b]=await Promise.all([scan(left),scan(right)]);return compare(a,b);
}
function missingPaths(rows,side){const other=side==='left'?'right':'left',blocked=new Set(rows.filter(x=>x[other]&&!x[other].isDir).map(x=>x.name));return rows.filter(x=>{if(x.status!==side)return false;const bits=x.name.split('/');bits.pop();while(bits.length){if(blocked.has(bits.join('/')))return false;bits.pop()}return true}).map(x=>x.name)}
module.exports={compareTree,missingPaths};
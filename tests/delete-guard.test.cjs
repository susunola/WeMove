'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');const{assertDeleteSafe}=require('../lib/delete-guard.cjs');
const providers={validate:r=>r,root:p=>({provider:p,path:'/',account:'default',drive:''})};
const job={status:'transferring',names:['folder'],source:{provider:'ali',path:'/'},target:{provider:'quark',path:'/backup'}};
test('deleting unrelated items is allowed during transfer; used items and ancestors are protected',()=>{
 assert.doesNotThrow(()=>assertDeleteSafe(providers,[job],{provider:'quark',path:'/'},['music.mp3']));
 for(const [ref,names] of [[{provider:'ali',path:'/'},['folder']],[{provider:'ali',path:'/folder'},['child']],[{provider:'quark',path:'/'},['backup']],[{provider:'quark',path:'/backup'},['folder']]])assert.throws(()=>assertDeleteSafe(providers,[job],ref,names),/相关任务/);
 assert.doesNotThrow(()=>assertDeleteSafe(providers,[job],{provider:'ali',path:'/'},['folder2']));
 assert.throws(()=>assertDeleteSafe(providers,[job],{provider:'ali',path:'/',drive:'resolved-drive'},['folder']),/相关任务/);
});
test('guard separates providers, accounts and drives, includes queued work and renamed targets',()=>{
 assert.doesNotThrow(()=>assertDeleteSafe(providers,[job],{provider:'ali',account:'other',path:'/'},['folder']));
 assert.doesNotThrow(()=>assertDeleteSafe(providers,[{...job,source:{...job.source,drive:'one'}}],{provider:'ali',drive:'two',path:'/'},['folder']));
 assert.throws(()=>assertDeleteSafe(providers,[{...job,status:'queued'}],{provider:'ali',path:'/'},['folder']),/相关任务/);
 assert.throws(()=>assertDeleteSafe(providers,[{...job,files:[{rel:'folder',targetName:'folder (副本 1)'}]}],{provider:'quark',path:'/backup'},['folder (副本 1)']),/相关任务/);
 for(const status of ['paused','complete','canceled','failed'])assert.doesNotThrow(()=>assertDeleteSafe(providers,[{...job,status}],{provider:'ali',path:'/'},['folder']));
});

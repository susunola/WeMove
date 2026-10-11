'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {exec}=require('../lib/common.cjs');
const {classifyFailure}=require('../lib/failures.cjs');
test('client timeout is recoverable network failure rather than missing authorization',async()=>{
 await assert.rejects(exec(process.execPath,['-e','setInterval(()=>{},1000)'],{timeout:80}),e=>e.code==='ETIMEDOUT'&&classifyFailure(e).kind==='network'&&classifyFailure(e).retryable);
});

'use strict';
const {parentPort,workerData}=require('node:worker_threads');
require('./common.cjs').hashes(workerData.file).then(result=>parentPort.postMessage({result}),e=>parentPort.postMessage({error:e.message}));

import assert from 'node:assert/strict';
import {privateBatchSettings,partitionPrivateRoles} from '../assistant/private-batch-plan.mjs';
assert.deepEqual(privateBatchSettings({stage:'screen'}),{batchSize:8,concurrency:2});
assert.deepEqual(privateBatchSettings({stage:'screen',screenBatchSize:'5',concurrency:'2'}),{batchSize:5,concurrency:2});
assert.deepEqual(privateBatchSettings({stage:'review',screenBatchSize:8,concurrency:2}),{batchSize:3,concurrency:2});
for(const size of [0,-1,1.5,26,NaN,Infinity,'eight'])assert.throws(()=>privateBatchSettings({stage:'screen',screenBatchSize:size}));
for(const concurrency of [0,4,1.5,NaN])assert.throws(()=>privateBatchSettings({stage:'screen',concurrency}));
for(const count of [0,1,5,6,25,100,500])for(const size of [1,5,8,25]){
 const roles=Object.freeze(Array.from({length:count},(_,i)=>Object.freeze({url:`https://example.test/job/${i}`})));
 const batches=partitionPrivateRoles(roles,size);
 assert.ok(batches.every(batch=>batch.length>0&&batch.length<=size));
 assert.deepEqual(batches.flat(),roles,'Batching must retain all roles once, in order, including the remainder');
 assert.equal(new Set(batches.flat().map(r=>r.url)).size,count);
 if(count)assert.notEqual(batches[0],roles,'Do not mutate the source selection');
}
console.log('PASS: bounded execution settings; exact once-only role coverage including empty, singleton and remainder batches; detailed review size unchanged.');

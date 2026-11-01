// Execution controls only: these do not change evidence, scoring or fingerprints.
export function privateBatchSettings({stage,screenBatchSize=8,concurrency=2}){
  if(!['screen','review'].includes(stage))throw new Error('Unknown private assessment stage');
  const size=Number(screenBatchSize),workers=Number(concurrency);
  if(!Number.isSafeInteger(size)||size<1||size>25)throw new Error('screen-batch-size must be an integer from1 to25');
  if(!Number.isSafeInteger(workers)||workers<1||workers>3)throw new Error('concurrency must be an integer from1 to3');
  return {batchSize:stage==='screen'?size:3,concurrency:workers};
}
export function partitionPrivateRoles(roles,batchSize){
  if(!Number.isSafeInteger(batchSize)||batchSize<1||batchSize>25)throw new Error('Invalid private batch size');
  return Array.from({length:Math.ceil(roles.length/batchSize)},(_,i)=>roles.slice(i*batchSize,(i+1)*batchSize));
}

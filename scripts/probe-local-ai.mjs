import { runLocal } from '../assistant/runtime.mjs';
const schema = {type:'object', properties:{ready:{type:'boolean'},message:{type:'string'}},required:['ready','message'],additionalProperties:false};
const provider = process.argv[2] || 'claude_local';
const result = await runLocal(provider, 'Return ready true and message "Local inference works". Do not use tools.', schema);
if (result.ready !== true) throw new Error('Probe failed');
console.log(JSON.stringify({provider,ready:result.ready,message:result.message}));

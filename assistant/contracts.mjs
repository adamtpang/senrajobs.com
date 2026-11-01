import { profileSchema,cleanProfile } from './profile.mjs';
export { profileFields,profileSchema,cleanProfile } from './profile.mjs';
export const interviewSchema={type:'object',properties:{question:{type:'string',maxLength:600},ready:{type:'boolean'},profile:profileSchema},required:['question','ready','profile'],additionalProperties:false};
const criterion={type:'object',properties:{rating:{type:['number','null'],minimum:0,maximum:100},candidateEvidence:{type:'string',maxLength:500},jobEvidence:{type:'string',maxLength:500},reason:{type:'string',maxLength:500}},required:['rating','candidateEvidence','jobEvidence','reason'],additionalProperties:false};
export const matchSchema={type:'object',properties:{summary:{type:'string',maxLength:220},matches:{type:'array',maxItems:8,items:{type:'object',properties:{id:{type:'string'},criteria:{type:'object',properties:Object.fromEntries(['skills','experience','direction','environment','practical'].map(key=>[key,criterion])),required:['skills','experience','direction','environment','practical'],additionalProperties:false},requirements:{type:'array',maxItems:8,items:{type:'object',properties:{status:{type:'string',enum:['met','gap','unknown']},jobEvidence:{type:'string',maxLength:500},candidateEvidence:{type:'string',maxLength:500}},required:['status','jobEvidence','candidateEvidence'],additionalProperties:false}},reason:{type:'string',maxLength:500},gap:{type:'string',maxLength:600},nextStep:{type:'string',maxLength:400}},required:['id','criteria','requirements','reason','gap','nextStep'],additionalProperties:false}}},required:['summary','matches'],additionalProperties:false};
export const sageSchema={type:'object',properties:{answer:{type:'string'},sources:{type:'array',items:{type:'string'}}},required:['answer','sources'],additionalProperties:false};
function text(value,max=2000) {return typeof value==='string' && value.length<=max && !/[\u0000-\u0008]/.test(value);}
export function validateRequest(body) {
  if(!body||typeof body!=='object')return null;
  if(body.kind==='interview'&&Array.isArray(body.messages)&&body.messages.length>0&&body.messages.length<=30&&body.messages.every(m=>['user','assistant'].includes(m.role)&&text(m.text,8000))&&new TextEncoder().encode(JSON.stringify(body.messages)).length<=24000) {
    const profile=body.profile?cleanProfile(body.profile):null;if(body.profile&&!profile)return null;
    return {kind:body.kind,payload:{messages:body.messages.map(m=>({role:m.role,text:m.text})),profile}};
  }
  if(body.kind==='match') {const profile=cleanProfile(body.profile);if(body.targetUrl!==undefined&&(!text(body.targetUrl,1800)||!/^https:\/\//i.test(body.targetUrl)))return null;return profile&&profile.role?{kind:body.kind,payload:{profile,...(body.targetUrl?{targetUrl:body.targetUrl}:{})}}:null;}
  if(body.kind==='sage'&&text(body.question,1200)&&body.question.trim().length>=3) {const profile=body.profile?cleanProfile(body.profile):null;return {kind:body.kind,payload:{question:body.question.trim(),profile}};}
  return null;
}

// Shared browser/server contract. Professional evidence is candidate-supplied.
export const profileFields=['experience','role','location','workMode','learning'];
export const topicNames=['direction','experience','skills','proof','preferences','constraints','learning','tradeoffs'];
const string={type:'string'},strings={type:'array',maxItems:20,items:{type:'string'}};
function record(properties,maxItems) {return {type:'array',maxItems,items:{type:'object',properties,required:Object.keys(properties),additionalProperties:false}};}
export const professionalSchema={type:'object',properties:{headline:string,careerHistory:record({role:string,organization:string,work:string,impact:string},10),skills:record({name:string,evidence:string,depth:string},30),projects:record({name:string,work:string,impact:string,url:string},10),achievements:strings,education:strings,strengths:strings,gaps:strings,targetRoles:strings,industries:strings,locations:strings,environment:string,constraints:strings,tradeoffs:strings,availability:string,workAuthorization:string,uncertainties:strings,skippedTopics:{type:'array',items:{type:'string',enum:topicNames},maxItems:8}},required:['headline','careerHistory','skills','projects','achievements','education','strengths','gaps','targetRoles','industries','locations','environment','constraints','tradeoffs','availability','workAuthorization','uncertainties','skippedTopics'],additionalProperties:false};
export const profileSchema={type:'object',properties:{...Object.fromEntries(profileFields.map(name=>[name,string])),minimumPay:{type:'number'},currency:string,professional:professionalSchema},required:[...profileFields,'minimumPay','currency','professional'],additionalProperties:false};
export function emptyProfessional() {return {headline:'',careerHistory:[],skills:[],projects:[],achievements:[],education:[],strengths:[],gaps:[],targetRoles:[],industries:[],locations:[],environment:'',constraints:[],tradeoffs:[],availability:'',workAuthorization:'',uncertainties:[],skippedTopics:[]};}
function text(value,max=2000) {return typeof value==='string'&&value.length<=max&&!/[\u0000-\u0008]/.test(value);}
export function cleanProfile(value) {
  if(!value||typeof value!=='object'||profileFields.some(key=>!text(value[key]))||!['Any','Remote','Hybrid','On-site'].includes(value.workMode)||!text(value.currency,3)||!/^(?:[A-Z]{3}|)$/.test(value.currency)||!Number.isFinite(value.minimumPay)||value.minimumPay<0||value.minimumPay>10000000||value.minimumPay>0&&!value.currency)return null;
  const profile=Object.fromEntries([...profileFields.map(key=>[key,value[key].trim()]),['minimumPay',value.minimumPay],['currency',value.currency]]),professional=emptyProfessional(),raw=value.professional;
  if(raw!==undefined) {
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return null;
    for(const [key,schema]of Object.entries(professionalSchema.properties)) {
      if(raw[key]===undefined)continue;
      if(schema.type==='string') {if(!text(raw[key]))return null;professional[key]=raw[key].trim();}
      else if(schema.items.type==='string') {
        if(!Array.isArray(raw[key])||raw[key].length>schema.maxItems||raw[key].some(value=>!text(value,1000)))return null;
        professional[key]=[...new Set(raw[key].map(value=>value.trim()).filter(Boolean))];
        if(key==='skippedTopics'&&professional[key].some(value=>!topicNames.includes(value)))return null;
      }else {
        if(!Array.isArray(raw[key])||raw[key].length>schema.maxItems)return null;
        professional[key]=[];
        for(const row of raw[key]) {
          if(!row||typeof row!=='object'||Object.keys(schema.items.properties).some(field=>!text(row[field]??'',1500)))return null;
          const item=Object.fromEntries(Object.keys(schema.items.properties).map(field=>[field,(row[field]||'').trim()]));
          if(key==='projects'&&item.url&&!/^https?:\/\//i.test(item.url))return null;
          professional[key].push(item);
        }
      }
    }
  }
  profile.professional=professional;return new TextEncoder().encode(JSON.stringify(profile)).length<=26000?profile:null;
}
export function profileCoverage(profile) {
  const p=profile?.professional||emptyProfessional(),skipped=new Set(p.skippedTopics||[]);
  const known={direction:!!profile?.role,experience:!!profile?.experience&&p.careerHistory.some(role=>role.work||role.impact),skills:p.skills.some(skill=>skill.name&&skill.evidence),proof:p.projects.some(project=>project.work&&project.impact)||p.achievements.length>0,preferences:!!p.environment||p.industries.length>0,constraints:p.constraints.length>0&&!!p.availability,learning:!!profile?.learning,tradeoffs:p.tradeoffs.length>0};
  return {covered:topicNames.filter(topic=>known[topic]||skipped.has(topic)),missing:topicNames.filter(topic=>!known[topic]&&!skipped.has(topic))};
}
export function importProfile(text) {
  let raw=String(text).trim();
  const fenced=raw.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/i);if(fenced)raw=fenced[1].trim();
  if(raw.length>40000)throw new Error('Please paste the profile JSON, not the whole conversation.');
  let parsed;try{parsed=JSON.parse(raw);}catch{throw new Error('Paste the profile JSON your AI produced.');}
  const profile=cleanProfile(parsed?.profile||parsed);if(!profile||!profile.role)throw new Error('The profile needs a desired role and valid preferences. Ask your AI to use the Senra Jobs format.');return profile;
}

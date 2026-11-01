import assert from 'node:assert/strict';
import { basePay } from '../base-pay.mjs';
const source = 'https://api.ashbyhq.com/posting-api/job-board/base-power?includeCompensation=true';
const salary = (min,max,interval='1 YEAR') => ({ minValue:min,maxValue:max,currencyCode:'USD',interval,compensationType:'Salary' });
const fixture = (id,descriptionPlain,components,tiers=[]) => ({ id,descriptionPlain,
  jobUrl:`https://jobs.ashbyhq.com/base-power/${id}`,
  compensation:{summaryComponents:components,compensationTiers:tiers} });
const electrician = fixture('c417f390-5d7a-4291-a2eb-113973b32e65',
  'Benefits\n - Wireman: $32/hr - $37hr.\n - Journeyman: $37/hr - $39/hr.',
  [salary(32,39)], ['Wireman','Journeyman'].map((title,i)=>({title,components:[{...salary(i?37:32,i?39:37),summary:title+' pay'}]})));
electrician.title = 'Journeyman Electrician (Dallas-Fort Worth)';
let p = basePay(electrician,source);
assert.deepEqual(p.pay,{min:37,max:39,currency:'USD',period:'hour'},'Named Journeyman role must not show the Wireman wage.');
assert.deepEqual(p.payRanges.map(({level,min,max,period})=>({level,min,max,period})),[
  {level:'Wireman',min:32,max:37,period:'hour'},
  {level:'Journeyman',min:37,max:39,period:'hour'},
]);
assert.equal(p.payEvidence.rawSummary.interval,'1 YEAR');
assert.equal(p.payEvidence.sourceConflict,true);
assert.deepEqual(basePay({...electrician,title:'Wireman Electrician (Dallas-Fort Worth)'},source).pay,
  {min:32,max:37,currency:'USD',period:'hour'});
for (const title of ['Residential Electrician','Crew Lead Electrician','Wireman / Journeyman Electrician']) {
  assert.equal(basePay({...electrician,title},source).pay,null,'Ambiguous titles must retain separate bands without inferring a level.');
}
const production = fixture('667ce127-66a5-4f9a-8f52-047ebe153d9d',
  ' - Pay: $23hr + 10% shift differential\n - Benefits', [salary(23,25)]);
p = basePay(production,source);
assert.deepEqual(p.pay,{min:23,max:23,currency:'USD',period:'hour'},'Description gives fixed $23, not the structured $25 upper bound.');
assert.equal(p.payRanges[0].additionalCompensation,'10% shift differential');
assert.match(p.payNote,/10% shift differential/);
assert.equal(p.payEvidence.amountConflict,true);
assert.equal(p.payEvidence.rawSummary.maxValue,25,'Conflicting published range must remain inspectable.');
const hourly = fixture('af950052-12a9-4c66-ae8f-815fb42b76ca',
  'THIS IS AN HOURLY POSITION. SEE LEFT SIDE FOR DETAILS.',[salary(23,28)]);
assert.deepEqual(basePay(hourly,source).pay,{min:23,max:28,currency:'USD',period:'hour'});
const unknown = fixture('d753f04d-c397-440e-9119-fd14f6a0619f','Pay: $23',[salary(23,25)]);
p = basePay(unknown,source);
assert.equal(p.pay,null);
assert.deepEqual(p.payRanges.map(({min,max,period})=>({min,max,period})),[{min:23,max:25,period:null}]);
assert.equal(p.payEvidence.status,'period-unconfirmed');
assert.match(p.payNote,/Pay: \$23/);
const driver = fixture('090c9e00-e7e3-442a-b830-12ccfa684682','Move equipment safely.',[salary(23,25)]);
assert.equal(basePay(driver,source).payRanges[0].period,null,'No period may be inferred from low dollars or job title.');
// Normal salaries and already-correct hourly records must remain untouched.
assert.equal(basePay({...hourly,compensation:{summaryComponents:[salary(23000,28000)]}},source),null);
assert.equal(basePay({...hourly,compensation:{summaryComponents:[salary(23,28,'1 HOUR')]}},source),null);
assert.equal(basePay({...unknown,descriptionPlain:'Pay: $23–25 per year'},source),null);
assert.equal(basePay({...unknown,descriptionPlain:'Salary: $23–25 annually'},source),null);
assert.equal(basePay({...unknown,id:'unreviewed',jobUrl:'https://jobs.ashbyhq.com/base-power/unreviewed'},source),null);
assert.equal(basePay(production,'https://api.ashbyhq.com/posting-api/job-board/other'),null);
assert.equal(basePay(production,'https://api.ashbyhq.com.evil.example/posting-api/job-board/base-power'),null);
assert.equal(basePay({...production,jobUrl:'https://jobs.ashbyhq.com/other/'+production.id},source),null);
assert.equal(basePay(production,'not a URL'),null);
const partial = {...electrician,descriptionPlain:'Wireman: $32/hr - $37hr.'};
p = basePay(partial,source);
assert.equal(p.payRanges.length,2);
assert.equal(p.payRanges.find(r=>r.level==='Journeyman').period,null,'Partial evidence cannot erase or invent the other level.');
const original = JSON.stringify(electrician);
basePay(electrician,source);
assert.equal(JSON.stringify(electrician),original,'Normalizer must not mutate its source job.');
const html = {...production,descriptionPlain:'',descriptionHtml:'<p>Pay: $23hr &#43; 10% shift differential</p>'};
assert.equal(basePay(html,source).payRanges[0].additionalCompensation,'10% shift differential');
console.log('Base pay: electrician levels, fixed production pay, shift differential, unknown periods, source isolation and normal-pay preservation pass.');

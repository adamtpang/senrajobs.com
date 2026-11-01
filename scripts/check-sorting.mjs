import assert from 'node:assert/strict';
import { normalizePay, ashbyPay, compareRoles, formatPay } from '../job-utils.mjs';

assert.equal(normalizePay({min:400,max:300,currency:'USD',period:'year'}),null);
assert.equal(normalizePay({min:400,max:800,currency:null,period:'year'}),null);
assert.equal(ashbyPay({summaryComponents:[{compensationType:'EquityCashValue',minValue:10000,maxValue:30000,currencyCode:'USD',interval:'1 YEAR'}]}),null);
assert.deepEqual(ashbyPay({summaryComponents:[{compensationType:'Salary',minValue:200000,maxValue:300000,currencyCode:'USD',interval:'1 YEAR'}]}),{min:200000,max:300000,currency:'USD',period:'year'});
const role = (title,pay,location='') => ({title,pay,location,company:'Company',url:`https://example.com/${title}`,fetched:'2026-10-06'});
const roles=[role('A',null),role('B',{max:800000,currency:'EUR',period:'year'}),role('C',{max:200,currency:'USD',period:'hour'}),role('D',{max:300000,currency:'USD',period:'year'}),role('E',{max:400000,currency:'USD',period:'year'})];
assert.deepEqual([...roles].sort((a,b)=>compareRoles(a,b,'pay|USD|year')).slice(0,2).map(r=>r.title),['E','D'],'Do not compare unlike currencies, intervals or unknown pay');
assert.equal(formatPay(null),'Pay not listed');
assert.equal(formatPay({min:20,max:25,currency:'USD',period:'hour'}),'USD 20–25/hour');
assert.deepEqual([role('A',null,''),role('B',null,'Zurich'),role('C',null,'Amsterdam')].sort((a,b)=>compareRoles(a,b,'location')).map(r=>r.location),['Amsterdam','Zurich','']);
console.log('Pay normalization and global role sorting checks passed.');

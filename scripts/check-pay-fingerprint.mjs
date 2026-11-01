import assert from 'node:assert/strict';
import {fingerprint} from '../assistant/batch-fit.mjs';
const role={url:'https://example.com/job/1',title:'Engineer',company:'Example',location:'Austin',sourceStatus:'current'},content={text:'Public requirements',observedAt:'2026-10-26T00:00:00Z'},profile={};
const without=fingerprint(role,content,profile,'screen');
assert.equal(fingerprint({...role,payRanges:[]},content,profile,'screen'),without);
const paid={...role,payRanges:[{min:80000,max:100000,currency:'USD',period:'year'}]};
assert.notEqual(fingerprint(paid,content,profile,'screen'),without);
for(const change of [{max:120000},{currency:'CAD'},{period:'month'},{type:'Total cash including potential bonus'}]){
 assert.notEqual(fingerprint({...paid,payRanges:[{...paid.payRanges[0],...change}]},content,profile,'review'),fingerprint(paid,content,profile,'review'));
}
console.log('Assessment cache invalidates changed pay ranges, currency, interval and compensation basis.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
const jobs=JSON.parse(fs.readFileSync('jobs.json','utf8'));
const board=jobs['Meta (chief AI officer, not founder)'];
assert(board,'Meta board missing');assert.equal(board.roles.length,1285);
assert.equal(new Set(board.roles.map(r=>r.url)).size,1285);
assert.equal(board.coverage.status,'partial');assert.equal(board.coverage.listingStatus,'complete');
assert.equal(board.coverage.pageReceipts.length,129);
assert.equal(board.coverage.pageReceipts.reduce((n,p)=>n+p.rows,0),1285);
for(const [i,p] of board.coverage.pageReceipts.entries()){assert.equal(p.page,i+1);assert.equal(p.rows,i===128?5:10);assert(p.total==null||p.total===1285);}
assert.equal(board.roles.filter(r=>r.locationStatus==='unknown').length,6);
assert.equal(board.roles.filter(r=>r.locations.some(l=>l.raw==='Austin, TX')).length,120);
assert.equal(board.roles.filter(r=>r.payRanges.length).length,197);
for(const r of board.roles){
 assert(!r.locations.some(l=>/show less|\+\d+ more|\+\d+ location/.test(l.raw)));
 assert(r.locations.every(l=>!r.department.split(' · ').includes(l.raw)));
 assert(r.pay===null,'Location-specific compensation must not become a universal range');
 for(const pay of r.payRanges){assert.equal(pay.currency,'USD');assert.equal(pay.location,'United States of America');assert(pay.min>0&&pay.max>=pay.min);assert(['year','month','hour'].includes(pay.period));}
}
const product=board.roles.find(r=>r.id==='9657291271065759');assert.equal(product.locations.length,12);assert(product.secondaryLocations.includes('Austin, TX'));
assert.equal(product.payRanges[0].min,183997);assert.equal(product.payRanges[0].max,257000);
console.log('PASS: Meta pagination, 1,285 unique URLs, 120 Austin locations, six unknown locations and 197 scoped pay ranges.');

import assert from 'node:assert/strict';
import fs from 'node:fs';
import {gzipSync} from 'node:zlib';
import {compileRoles} from '../board-data.mjs';
import {clientRole} from '../client-data.mjs';
import {displayLocation,matchesLocation,texasEvidence,isUSRemotePossibility,isLocationUnknown} from '../location-utils.mjs';
import {compareRoles,formatPublishedPay} from '../job-utils.mjs';
const full=compileRoles(JSON.parse(fs.readFileSync('guests.json')),JSON.parse(fs.readFileSync('jobs.json')));
const compact=full.map(clientRole);
for(let i=0;i<full.length;i++) {
  const before=full[i],after=compact[i];
  assert.equal(displayLocation(after),displayLocation(before));
  assert.deepEqual(texasEvidence(after),texasEvidence(before));
  assert.equal(isUSRemotePossibility(after),isUSRemotePossibility(before));
  assert.equal(isLocationUnknown(after),isLocationUnknown(before));
  assert.equal(formatPublishedPay(after),formatPublishedPay(before));
  assert.equal(after.employerBrand,before.employerBrand);
  assert.equal(after.coverage.listingStatus,before.coverage.listingStatus);
  assert.deepEqual(after.founders.map(f=>f.name),before.founders.map(f=>f.name));
  for(const query of ['Texas','TX','US remote','Location unknown','Austin','London','remote'])assert.equal(matchesLocation(after,query),matchesLocation(before,query));
}
for(const sort of ['role','location','department','company','checked','pay|USD|year','pay|EUR|year','pay|USD|hour']) {
  assert.deepEqual([...compact].sort((a,b)=>compareRoles(a,b,sort)).map(r=>r.url),[...full].sort((a,b)=>compareRoles(a,b,sort)).map(r=>r.url));
}
assert.ok(JSON.stringify(compact).length<JSON.stringify(full).length*.55,'Keep the initial response substantially smaller than full source records');
const html=fs.readFileSync('index.html');
console.log(`Client projection verified for ${full.length} roles. HTML ${(html.length/1e6).toFixed(2)} MB; gzip ${(gzipSync(html).length/1e6).toFixed(2)} MB. Search, locations, pay and sorting retain their results.`);

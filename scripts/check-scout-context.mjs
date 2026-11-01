import assert from 'node:assert/strict';
import {generateKeyPair,SignJWT} from 'jose';
import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {loadConfig} from '../assistant/config.mjs';
import {verifyAccountToken} from '../assistant/scout-auth.mjs';
import {initializeProfiles,readContext,decryptContext} from '../assistant/scout-store.mjs';
import {createProfileHandler} from '../api/profile.mjs';
loadConfig();process.env.SENRA_DEV='1';
const db=neon(process.env.SENRA_DATABASE_URL),{publicKey,privateKey}=await generateKeyPair('RS256');
const issuer='https://scout-fixture.clerk.accounts.dev',origin='http://127.0.0.1:4187',suffix=randomUUID().replaceAll('-','');
const token=async(sub,extra={})=>new SignJWT({sid:'sess_fixture',azp:origin,nbf:Math.floor(Date.now()/1000)-1,...extra}).setProtectedHeader({alg:'RS256'}).setSubject(sub).setIssuer(issuer).setIssuedAt().setExpirationTime('2m').sign(privateKey);
const options={expectedIssuer:issuer,parties:[origin],key:publicKey};
const a=await token('user_scoutA'+suffix),b=await token('user_scoutB'+suffix),ownerA=await verifyAccountToken(a,options),ownerB=await verifyAccountToken(b,options);
const handler=createProfileHandler({ready:()=>true,auth:req=>verifyAccountToken((req.headers.authorization||'').replace(/^Bearer /,''),options)});
async function call(method,bearer,body,version,headers={}){const req={method,headers:{origin,'content-type':'application/json',authorization:'Bearer '+bearer,...(version!==undefined?{'if-match':String(version)}:{}),...headers},body};const responseHeaders={};let output;const res={setHeader:(k,v)=>responseHeaders[k]=v,end:s=>output=JSON.parse(s)};await handler(req,res);return {status:res.statusCode,body:output,headers:responseHeaders};}
const context={report:'Fictional Scout fixture: five years supporting customer accounts, seeking Austin operations work.',provider:'Claude',profile:null,shortlist:[],search:{location:'4671654',q:'support'}};
await initializeProfiles();
try{
  assert.equal((await call('GET','garbage')).status,401);
  const forged=a.slice(0,-10)+'aaaaaaaaaa';await assert.rejects(()=>verifyAccountToken(forged,options));
  for(const extra of [{azp:'https://evil.example'},{sts:'pending'},{nbf:Math.floor(Date.now()/1000)+600}])await assert.rejects(()=>token('user_scoutA'+suffix,extra).then(t=>verifyAccountToken(t,options)));
  const expired=await new SignJWT({sid:'sess_fixture',azp:origin,nbf:1}).setProtectedHeader({alg:'RS256'}).setSubject('user_scoutA'+suffix).setIssuer(issuer).setIssuedAt(1).setExpirationTime(2).sign(privateKey);await assert.rejects(()=>verifyAccountToken(expired,options));
  await assert.rejects(()=>verifyAccountToken(a,{...options,expectedIssuer:'https://another.clerk.accounts.dev'}));
  assert.equal((await call('PUT',a,context,0,{origin:'https://evil.example'})).status,403);
  assert.equal((await call('PUT',a,context)).status,428);
  assert.equal((await call('PUT',a,{...context,owner:ownerB},0)).status,400);
  assert.equal((await call('PUT',a,{...context,report:'x'.repeat(130000)},0)).status,413);
  assert.equal((await call('PUT',a,context,0)).status,200);
  const fetched=await call('GET',a);assert.equal(fetched.body.context.report,context.report);assert.equal(fetched.headers['Cache-Control'],'private, no-store');
  assert.equal((await call('GET',b)).body.context,null);
  assert.equal((await call('DELETE',b,null,1)).status,409);assert.equal((await readContext(ownerA)).context.report,context.report);
  const raw=(await db`SELECT payload FROM senra_scout_profiles WHERE owner=${ownerA}`)[0].payload;assert.ok(!raw.includes('Fictional'));assert.throws(()=>decryptContext(raw,ownerB));
  const concurrent=await Promise.all([call('PUT',a,{...context,report:'Fictional revision one'},1),call('PUT',a,{...context,report:'Fictional revision two'},1)]);assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,409]);
  assert.equal((await call('DELETE',a,null,2)).status,200);assert.equal((await call('GET',a)).body.context,null);
  assert.equal((await call('PUT',a,context,2)).status,409);assert.equal((await call('PUT',a,context,3)).status,200);
  console.log('PASS: real signed token checks, wrong issuer/origin/expiry/signature/pending rejection, encrypted DB roundtrip, owner isolation, write conflicts and deletion.');
}finally{await db`DELETE FROM senra_scout_profiles WHERE owner IN (${ownerA},${ownerB})`;console.log('Only fictional test records removed.');}

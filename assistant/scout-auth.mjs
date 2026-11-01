import {createRemoteJWKSet,jwtVerify} from 'jose';
import {createHash} from 'node:crypto';
let resolver,configuredIssuer;
export function allowedOrigins(){return process.env.SENRA_DEV==='1'?['http://127.0.0.1:4187','http://localhost:4187']:['https://senrajobs.com','https://www.senrajobs.com'];}
export function issuer(){
  const value=process.env.CLERK_ISSUER;
  if(!value)return null;
  try{const url=new URL(value);return url.protocol==='https:'&&!url.username&&!url.password&&url.pathname==='/'&&!url.search&&!url.hash?url.origin:null;}catch{return null;}
}
export async function verifyAccountToken(token,{expectedIssuer=issuer(),parties=allowedOrigins(),key}={}){
  if(!expectedIssuer||typeof token!=='string'||token.length>16000)throw new Error('Invalid account');
  if(!key){if(configuredIssuer!==expectedIssuer){configuredIssuer=expectedIssuer;resolver=createRemoteJWKSet(new URL('/.well-known/jwks.json',expectedIssuer),{timeoutDuration:5000,cooldownDuration:30000,cacheMaxAge:300000});}key=resolver;}
  const {payload}=await jwtVerify(token,key,{issuer:expectedIssuer,algorithms:['RS256'],requiredClaims:['sub','sid','exp','iat','nbf','azp'],clockTolerance:5,maxTokenAge:'10m'});
  if(!parties.includes(payload.azp)||typeof payload.sub!=='string'||!/^user_[A-Za-z0-9]+$/.test(payload.sub)||typeof payload.sid!=='string'||!payload.sid.startsWith('sess_')||payload.sts==='pending')throw new Error('Invalid account');
  return createHash('sha256').update(expectedIssuer+'\0'+payload.sub).digest('hex');
}
export async function authenticate(req){const match=/^Bearer ([A-Za-z0-9_.-]+)$/.exec(req.headers.authorization||'');if(!match)throw new Error('Sign in required');return verifyAccountToken(match[1]);}

import fs from 'node:fs';
import path from 'node:path';
const filename=new URL('../.env.worker.local',import.meta.url);
export function loadConfig() { if(fs.existsSync(filename))for(const [key,value]of Object.entries(JSON.parse(fs.readFileSync(filename,'utf8'))))process.env[key] ||= value; }
export const root=path.resolve(new URL('..',import.meta.url).pathname.replace(/^\/([A-Za-z]:)/,'$1'));

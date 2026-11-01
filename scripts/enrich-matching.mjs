import fs from 'node:fs';
import { loadContent,refreshBulkContent } from '../assistant/content.mjs';
loadContent();const count=await refreshBulkContent(JSON.parse(fs.readFileSync('jobs.json')));console.log(`${count} role descriptions cached privately for matching.`);

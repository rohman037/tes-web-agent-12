const fs = require('fs');
let code = fs.readFileSync('src/db/dbService.ts', 'utf8');

// Use regex to replace CONFIGS with API_KEYS inside dbSaveApiKeys block
const startIdx = code.indexOf('export const dbSaveApiKeys = async');
const endIdx = code.indexOf('};', startIdx) + 2;
let block = code.substring(startIdx, endIdx);
block = block.replace(/CONFIGS/g, 'API_KEYS');
code = code.substring(0, startIdx) + block + code.substring(endIdx);

fs.writeFileSync('src/db/dbService.ts', code);

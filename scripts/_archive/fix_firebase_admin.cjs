const fs = require('fs');
let code = fs.readFileSync('src/lib/firebase-admin.ts', 'utf8');
if (!code.includes('credential: applicationDefault(),')) {
  code = code.replace(/projectId: firebaseConfig.projectId,/g, 'credential: applicationDefault(),\n      projectId: firebaseConfig.projectId,');
  fs.writeFileSync('src/lib/firebase-admin.ts', code);
}

const fs = require('fs');
let code = fs.readFileSync('src/lib/payment.ts', 'utf8');

// Fix targetTrx, res.ok, res.json in uploadPaymentProof
code = code.replace(/targetTrx/g, 'updatedTrx');
code = code.replace(/const res = await setDoc\([^)]+\).catch\(console\.error\);\s*if\s*\(res\.ok\)\s*\{\s*const data = await res\.json\(\);\s*if\s*\(data && data\.transaction\)\s*\{\s*upsertLocalTransaction\(data\.transaction\);\s*return data\.transaction;\s*\}\s*\}/g, 
  "await setDoc(doc(db, 'transactions', cleanId), updatedTrx).catch(console.error);");

// Fix approvedTrx
code = code.replace(/approvedTrx/g, 'current[index]');

// Fix rejectedTrx
code = code.replace(/rejectedTrx/g, 'current[index]');

fs.writeFileSync('src/lib/payment.ts', code);

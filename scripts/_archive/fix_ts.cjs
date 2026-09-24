const fs = require('fs');

let code = fs.readFileSync('server.ts', 'utf8');
code = code.replace(/broadcastLiveEvent\(\s*\{ type: 'audit_logs_updated' \}\s*\)/g, "broadcastLiveEvent({ type: 'audit_logs_updated' } as any)");
fs.writeFileSync('server.ts', code);


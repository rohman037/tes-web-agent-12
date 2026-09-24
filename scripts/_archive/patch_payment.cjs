const fs = require('fs');
let code = fs.readFileSync('src/lib/payment.ts', 'utf8');

code = code.replace("type: 'standard' as const,", "type: 'standard' as const,\n        role: 'user',\n        allowedFeatures: [],\n        maxDailyTokens: 50,\n        usageCount: 0,");

fs.writeFileSync('src/lib/payment.ts', code);

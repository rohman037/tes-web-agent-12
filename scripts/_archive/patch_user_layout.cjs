const fs = require('fs');
let code = fs.readFileSync('src/components/layouts/UserLayout.tsx', 'utf8');

code = code.replace("expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),", "expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),\n          role: session.role === 'admin' ? 'admin' : 'user',\n          allowedFeatures: [],\n          maxDailyTokens: 50,\n          usageCount: 0,");

fs.writeFileSync('src/components/layouts/UserLayout.tsx', code);

const fs = require('fs');
let code = fs.readFileSync('src/views/admin/ClientMonitoringPanel.tsx', 'utf8');

code = code.replace("type: 'standard',", "type: 'standard',\n      role: 'user',\n      allowedFeatures: [],\n      maxDailyTokens: 50,\n      usageCount: 0,");

fs.writeFileSync('src/views/admin/ClientMonitoringPanel.tsx', code);

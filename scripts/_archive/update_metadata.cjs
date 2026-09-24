const fs = require('fs');
const meta = JSON.parse(fs.readFileSync('metadata.json', 'utf8'));
meta.name = 'projek beli';
meta.description = 'Project name: projects/7774265261, Project number: 7774265261';
fs.writeFileSync('metadata.json', JSON.stringify(meta, null, 2));

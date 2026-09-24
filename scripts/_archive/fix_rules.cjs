const fs = require('fs');
let rules = fs.readFileSync('firestore.rules', 'utf8');

rules = rules.replace(
  /request.auth.token.email == 'davidrohman037@gmail.com'/g,
  "request.auth.token.email in ['davidrohman037@gmail.com', 'ahmaddavid0906@gmail.com', 'globallensn@gmail.com']"
);

rules = rules.replace(
  /documents\/clients\/\$\(request\.auth\.uid\)\)\.data\.role/g,
  "documents/users/$(request.auth.uid)).data.role"
);

fs.writeFileSync('firestore.rules', rules);

const fs = require('fs');

const rules = `rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isAuthenticated() {
      return request.auth != null;
    }
    
    function isAdmin() {
      return isAuthenticated() &&
             (request.auth.token.email in ['davidrohman037@gmail.com', 'ahmaddavid0906@gmail.com', 'globallensn@gmail.com'] ||
              get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'admin');
    }

    match /users/{userId} {
      allow read, write: if isAuthenticated() && (request.auth.uid == userId || isAdmin());
    }

    match /clients/{clientId} {
      allow read, update: if isAuthenticated() && (request.auth.uid == clientId || isAdmin());
      allow create, delete: if isAdmin();
    }

    match /packages/{packageId} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /apiKeys/{document=**} {
      allow read, write: if isAdmin();
    }

    match /history/{historyId} {
      allow read: if isAuthenticated() && (resource.data.clientId == request.auth.uid || isAdmin());
      allow create: if isAuthenticated() && request.resource.data.clientId == request.auth.uid;
      allow update, delete: if isAdmin();
    }

    match /apiKeyUsageLogs/{document=**} {
      allow read, write: if isAdmin();
    }

    match /configs/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /trackingEvents/{document=**} {
      allow read, write: if isAdmin();
      allow create: if true; 
    }

    match /learningQueue/{document=**} {
      allow read, write: if isAdmin();
      allow create: if isAuthenticated();
    }

    match /transactions/{document=**} {
      allow read: if isAuthenticated();
      allow create: if isAuthenticated();
      allow update, delete: if isAdmin();
    }

    match /aiAgents/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /auditLogs/{document=**} {
      allow read, write: if isAdmin();
    }

    match /categoryTaxonomy/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }
    
    match /categoryTaxonomyProposals/{document=**} {
      allow read, write: if isAdmin();
      allow create: if isAuthenticated();
    }

    match /accessCodes/{document=**} {
      allow read, write: if isAdmin();
    }

    match /bannedDevices/{document=**} {
      allow read, write: if isAdmin();
    }

    match /pendingSchemaChanges/{document=**} {
      allow read, write: if isAdmin();
    }

    match /announcements/{document=**} {
      allow read: if true;
      allow write: if isAdmin();
    }

    match /promptFormulas/{document=**} {
      allow read: if isAuthenticated();
      allow write: if isAdmin();
    }

    match /affiliates/{document=**} {
      allow read, write: if isAdmin();
    }

    match /{document=**} {
      allow read, write: if isAdmin();
    }
  }
}
`;

fs.writeFileSync('firestore.rules', rules);

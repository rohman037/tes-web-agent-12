export * from './firebase/seed-firestore';
import { runFirestoreSeed } from './firebase/seed-firestore';

if (import.meta.url === `file://${process.argv[1]}`) {
  runFirestoreSeed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ Error during Firestore seed:', err);
      process.exit(1);
    });
}

import { adminDb, adminAuth } from '../lib/firebase-admin';
import firebaseConfig from '../../config/firebase-applet-config.json';
import * as schema from './schema';

export * from './schema';
export * from './dbService';
export * from './users';

// Main Firestore Database Instances
export const db = adminDb;
export const auth = adminAuth;
export const config = firebaseConfig;

export { adminDb, adminAuth, schema };

export default {
  db: adminDb,
  auth: adminAuth,
  schema,
};


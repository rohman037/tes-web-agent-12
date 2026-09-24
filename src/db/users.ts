import { adminDb } from '../lib/firebase-admin';
import { UserDoc, FIRESTORE_COLLECTIONS } from './schema';

export async function getOrCreateUser(
  uid: string,
  email: string,
  name?: string
): Promise<UserDoc> {
  try {
    const userRef = adminDb.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    const snap = await userRef.get();
    const now = new Date().toISOString();

    if (snap.exists) {
      const existingData = snap.data() as UserDoc;
      const updatedUser: UserDoc = {
        ...existingData,
        email: email || existingData.email,
        name: name !== undefined ? name : existingData.name,
        updatedAt: now,
      };
      await userRef.set(updatedUser, { merge: true });
      return updatedUser;
    }

    const newUser: UserDoc = {
      uid,
      email,
      name: name || null,
      role: 'user',
      accessCode: null,
      createdAt: now,
      updatedAt: now,
    };

    await userRef.set(newUser);
    return newUser;
  } catch (error) {
    console.error('[Firebase Users] Error in getOrCreateUser:', error);
    // Fallback object to avoid hard crash during offline or quota constraints
    return {
      uid,
      email,
      name: name || null,
      role: 'user',
      accessCode: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
  }
}

export async function getUserById(uid: string): Promise<UserDoc | null> {
  try {
    const userRef = adminDb.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    const snap = await userRef.get();
    if (snap.exists) {
      return snap.data() as UserDoc;
    }
    return null;
  } catch (error) {
    console.error('[Firebase Users] Error in getUserById:', error);
    return null;
  }
}

export async function updateUserRole(uid: string, role: UserDoc['role']): Promise<void> {
  try {
    const userRef = adminDb.collection(FIRESTORE_COLLECTIONS.USERS).doc(uid);
    await userRef.set({ role, updatedAt: new Date().toISOString() }, { merge: true });
  } catch (error) {
    console.error('[Firebase Users] Error in updateUserRole:', error);
  }
}


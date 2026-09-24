import { adminAuth, adminDb } from '@/src/lib/firebase-admin';
import { logger } from '@/server/core/utils/logger';

export type UserRole = 'owner' | 'admin' | 'moderator' | 'premium' | 'user';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  owner: [
    'all',
    'manage_users',
    'manage_api_keys',
    'manage_config',
    'manage_payments',
    'manage_ai',
    'manage_roles',
    'audit_view',
    'system_admin',
  ],
  admin: [
    'manage_users',
    'manage_api_keys',
    'manage_config',
    'manage_payments',
    'manage_ai',
    'manage_roles',
    'audit_view',
  ],
  moderator: [
    'manage_users_read',
    'audit_view',
    'manage_payments_review',
    'ban_device',
  ],
  premium: [
    'access_vip_ai',
    'use_deep_models',
    'unlimited_prompts',
  ],
  user: [
    'access_standard_ai',
    'generate_prompts',
  ],
};

export interface CustomClaimTokenPayload {
  role: UserRole;
  permissions: string[];
}

/**
 * Assigns Firebase Custom Claims to a user by UID.
 * This sets `request.auth.token.role` and `request.auth.token.permissions` in Firebase.
 */
export async function setUserCustomClaims(
  uid: string,
  role: UserRole,
  customPermissions?: string[]
): Promise<{ success: boolean; role: UserRole; permissions: string[] }> {
  try {
    const validRole = role.toLowerCase() as UserRole;
    if (!ROLE_PERMISSIONS[validRole]) {
      throw new Error(`Role "${role}" tidak valid.`);
    }

    const permissions = customPermissions || ROLE_PERMISSIONS[validRole];

    const claims = {
      role: validRole,
      admin: validRole === 'admin' || validRole === 'owner',
      permissions,
    };

    await adminAuth.setCustomUserClaims(uid, claims);

    // Sync role to Firestore user document for fast indexing (server-side only)
    try {
      await adminDb.collection('users').doc(uid).set(
        {
          role: validRole,
          permissions,
          updatedAt: new Date().toISOString(),
        },
        { merge: true }
      );
    } catch (dbErr) {
      logger.warn(`[CustomClaims] Could not sync claims to users collection for UID ${uid}:`, dbErr);
    }

    logger.info(`[CustomClaims] Assigned role "${validRole}" with ${permissions.length} permissions to UID: ${uid}`);
    return { success: true, role: validRole, permissions };
  } catch (error: any) {
    logger.error(`[CustomClaims] Failed setting claims for UID ${uid}:`, error);
    throw error;
  }
}

/**
 * Retrieves the current Custom Claims for a user.
 */
export async function getUserCustomClaims(uid: string): Promise<CustomClaimTokenPayload | null> {
  try {
    const user = await adminAuth.getUser(uid);
    const claims = user.customClaims as any;
    if (!claims || !claims.role) {
      return null;
    }
    return {
      role: claims.role as UserRole,
      permissions: Array.isArray(claims.permissions) ? claims.permissions : [],
    };
  } catch (error) {
    logger.error(`[CustomClaims] Failed getting claims for UID ${uid}:`, error);
    return null;
  }
}

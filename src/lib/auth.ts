import { getClients } from './admin/clients';


import { loginWithGoogle, logoutGoogle } from './firebase';

export async function loginWithGoogleAdmin() {
  const result = await loginWithGoogle();
  if (result.success && result.user) {
    try {
      const idToken = await result.user.getIdToken(true);
      const res = await fetch('/api/auth/verify-firebase-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken }),
      });
      const data = await res.json();
      if (data.success && data.user) {
        const isAdmin = data.user.role === 'admin' || data.user.role === 'owner';
        if (isAdmin) {
          const session: UserSession = {
            code: idToken,
            role: 'admin',
            email: data.user.email,
            name: data.user.name || result.user.displayName || 'Administrator',
            loginTime: Date.now(),
          };
          setUserSession(session);
          return { success: true, session };
        }
      }
    } catch (e: any) {
      return { success: false, error: e.message || 'Gagal verifikasi status admin.' };
    }
  }
  return { success: false, error: 'Akun Google Anda tidak memiliki otorisasi administrator.' };
}

export interface UserSession {
  code: string;
  role: 'admin' | 'user';
  name?: string;
  email?: string;
  loginTime: number;
  expiryDate?: string;
}

export interface AccessCodeItem {
  code: string;
  note: string;
  createdAt: number;
}

const STORAGE_SESSION_KEY = 'satset_user_session';
const STORAGE_CODES_KEY = 'satset_valid_access_codes';

// Default user access codes (Strictly empty in production; all access codes must originate from database)
const DEFAULT_ACCESS_CODES: AccessCodeItem[] = [];

export function getAccessCodes(): AccessCodeItem[] {
  if (typeof localStorage === 'undefined') {
    return [];
  }
  try {
    const raw = localStorage.getItem(STORAGE_CODES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    // console.error('Gagal membaca kode akses dari localStorage', err);
  }
  return [];
}

export function saveAccessCodes(codes: AccessCodeItem[]) {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_CODES_KEY, JSON.stringify(codes));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_access_codes_updated'));
    }
  } catch (err) {
    // console.error('Gagal menyimpan kode akses ke localStorage', err);
  }
}

export function addSpecificAccessCode(code: string, note: string = 'Pembelian Paket Satset'): AccessCodeItem {
  const current = getAccessCodes();
  const existing = current.find(c => c.code.toUpperCase() === code.toUpperCase());
  if (existing) return existing;
  
  const newItem: AccessCodeItem = {
    code: code.toUpperCase(),
    note,
    createdAt: Date.now(),
  };
  const updated = [newItem, ...current];
  saveAccessCodes(updated);

  // Sync to backend with admin credentials
  const currentAdminCode = (typeof localStorage !== 'undefined' ? localStorage.getItem('satset_access_code') : null) || '';
  if (currentAdminCode) {
    fetch('/api/access-codes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-code': currentAdminCode,
        'Authorization': `Bearer ${currentAdminCode}`
      },
      body: JSON.stringify({ code: newItem.code, note: newItem.note }),
    }).catch(() => {});
  }

  return newItem;
}

export function generateNewAccessCode(note: string = 'Akses Baru'): AccessCodeItem {
  const randomNum = Math.floor(100000 + Math.random() * 900000);
  const newCode = `SATSET-VIP-${randomNum}`;
  return addSpecificAccessCode(newCode, note);
}

export function removeAccessCode(codeToRemove: string) {
  const current = getAccessCodes();
  const updated = current.filter((item) => item.code.toUpperCase() !== codeToRemove.toUpperCase());
  saveAccessCodes(updated);

  // Sync to backend with admin credentials
  const currentAdminCode = (typeof localStorage !== 'undefined' ? localStorage.getItem('satset_access_code') : null) || '';
  if (currentAdminCode) {
    fetch('/api/access-codes/remove', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-access-code': currentAdminCode,
        'Authorization': `Bearer ${currentAdminCode}`
      },
      body: JSON.stringify({ code: codeToRemove }),
    }).catch(() => {});
  }
}

export function verifyAccessCode(input: string): { success: boolean; role?: 'admin' | 'user'; email?: string; code?: string; name?: string; error?: string } {
  const trimmed = input.trim();
  const cleaned = trimmed.toUpperCase();
  if (!trimmed) {
    return { success: false, error: 'Masukkan Kode Akses Anda.' };
  }

  // Check Authorized Administrator
  if (
    trimmed.toLowerCase() === 'davidrohman037@gmail.com' ||
    cleaned === 'SATSET-ADMIN'
  ) {
    return {
      success: true,
      role: 'admin',
      code: trimmed,
      name: 'Super Admin (David)',
      email: 'davidrohman037@gmail.com',
    };
  }

  // Lookup in client list database
  const clients = getClients();
  const foundClient = clients.find((c) => c.accessCode && c.accessCode.toUpperCase() === cleaned);

  if (foundClient) {
    const clientStatus = foundClient.status;
    const now = Date.now();
    const expiry = foundClient.expiryDate ? new Date(foundClient.expiryDate).getTime() : 0;

    if (clientStatus === 'suspended') {
      return {
        success: false,
        error: 'Akses Anda saat ini ditangguhkan. Silakan hubungi administrator.',
      };
    }
    if (clientStatus === 'expired' || (expiry > 0 && expiry <= now)) {
      return {
        success: false,
        error: 'Masa aktif kode akses Anda telah habis/kedaluwarsa (30 hari). Silakan hubungi admin untuk perpanjang paket.',
      };
    }
    return {
      success: true,
      role: 'user',
      code: foundClient.accessCode,
      name: foundClient.name || 'Klien Satset',
      email: foundClient.email,
    };
  }

  // Check against valid user codes
  const validCodes = getAccessCodes();
  const matched = validCodes.find((item) => item.code && item.code.toUpperCase() === cleaned);

  if (matched) {
    return {
      success: true,
      role: 'user',
      code: matched.code,
      name: matched.note || 'Klien Satset',
    };
  }

  return {
    success: false,
    error: 'Kode Akses tidak terdaftar atau telah kedaluwarsa. Silakan konsultasi via WhatsApp.',
  };
}

export async function verifyAccessCodeAsync(input: string) {
  try {
    const fingerprint = typeof window !== 'undefined' ? `${window.screen.width}x${window.screen.height}_${navigator.language}` : '';
    const userAgent = typeof navigator !== 'undefined' ? navigator.userAgent : 'Web Browser';

    const response = await fetch('/api/verify-access-code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-device-fingerprint': fingerprint,
      },
      body: JSON.stringify({
        accessCode: input,
        fingerprint,
        userAgent,
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data && typeof data.success === 'boolean') {
        // Hydrate caches on background (admin only to prevent data leakage)
        if (data.role === 'admin') {
          fetch('/api/access-codes', {
            headers: { 'x-access-code': input, 'Authorization': `Bearer ${input}` }
          }).then(r => r.ok && r.json()).then(codes => {
            if (Array.isArray(codes) && typeof localStorage !== 'undefined') localStorage.setItem(STORAGE_CODES_KEY, JSON.stringify(codes));
          }).catch(() => {});
          fetch('/api/admin/clients', {
            headers: { 'x-access-code': input, 'Authorization': `Bearer ${input}` }
          }).then(r => r.ok && r.json()).then(clients => {
            if (Array.isArray(clients) && typeof localStorage !== 'undefined') localStorage.setItem('satset_clients_data', JSON.stringify(clients));
          }).catch(() => {});
        }

        return data;
      }
    }
  } catch (e) {
    console.warn('[verifyAccessCodeAsync] Server verification error, falling back to local sync check:', e);
  }

  return verifyAccessCode(input);
}

export function getUserSession(): UserSession | null {
  if (typeof localStorage === 'undefined') {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_SESSION_KEY);
    if (raw) {
      const session: UserSession = JSON.parse(raw);
      if (session && session.code) {
        if (session.code === 'GUEST-ACCESS') {
          return null;
        }

        // Admin sessions are authenticated
        if (session.role === 'admin') {
          session.name = session.name || 'Administrator';
          return session;
        }

        // Client lookup with strict timestamp audit
        const clients = getClients();
        const foundClient = clients.find(
          (c) => c.accessCode && c.accessCode.toUpperCase() === session.code.toUpperCase()
        );

        if (foundClient) {
          const now = Date.now();
          const expiry = foundClient.expiryDate ? new Date(foundClient.expiryDate).getTime() : 0;
          
          // Verify timestamp comparison against current date
          if (
            foundClient.status === 'suspended' ||
            foundClient.status === 'expired' ||
            (expiry > 0 && !isNaN(expiry) && expiry <= now)
          ) {
            // Strictly revoke and purge expired/suspended user session
            localStorage.removeItem(STORAGE_SESSION_KEY);
            return null;
          }

          if (foundClient.name) {
            session.name = foundClient.name;
          }
          if (foundClient.expiryDate) {
            session.expiryDate = foundClient.expiryDate;
          }
          return session;
        }

        // If session has an explicit expiryDate property, verify against current timestamp
        if (session.expiryDate) {
          const expTime = new Date(session.expiryDate).getTime();
          if (!isNaN(expTime) && expTime <= Date.now()) {
            localStorage.removeItem(STORAGE_SESSION_KEY);
            return null;
          }
        }

        if (!session.name) {
          session.name = 'Klien Satset';
        }
        return session;
      }
    }
  } catch (err) {
    // console.error('Gagal membaca sesi dari localStorage', err);
  }
  return null;
}

export function setUserSession(session: UserSession | null) {
  if (typeof localStorage === 'undefined') return;
  try {
    if (!session) {
      localStorage.removeItem(STORAGE_SESSION_KEY);
    } else {
      localStorage.setItem(STORAGE_SESSION_KEY, JSON.stringify(session));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_auth_updated'));
      window.dispatchEvent(new Event('satset_session_updated'));
    }
  } catch (err) {
    // console.error('Gagal menyimpan sesi ke localStorage', err);
  }
}

export async function sendLoginAuditLog(payload: {
  action: string;
  details: string;
  category?: string;
  actor?: string;
}) {
  try {
    await fetch('/api/admin/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: payload.action,
        details: payload.details,
        category: payload.category || 'system',
        adminName: payload.actor || 'System',
        actor: payload.actor || 'System',
      }),
    });
  } catch (e) {
    console.error('Gagal kirim audit log:', e);
  }
}

export function logoutUser() {
  const current = getUserSession();
  if (current) {
    sendLoginAuditLog({
      action: 'LOGOUT SESI',
      details: `Pengguna resmi mengakhiri sesi login (${current.name || 'User'} • ${current.code || 'Sesi'})`,
      category: current.role === 'admin' ? 'system' : 'client',
      actor: current.name ? `${current.name} (${current.code || 'Sesi'})` : (current.code || 'Pengguna'),
    });

    if (typeof fetch !== 'undefined') {
      try {
        fetch('/api/logout', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessCode: current.code,
            name: current.name,
            role: current.role,
          }),
        }).catch(() => {});
      } catch (e) {}
    }
  }
  setUserSession(null);
}

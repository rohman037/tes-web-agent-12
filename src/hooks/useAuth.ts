import { syncHistoryAsync } from '../lib/history';
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getUserSession,
  setUserSession,
  logoutUser,
  verifyAccessCodeAsync,
  sendLoginAuditLog,
  UserSession,
} from '../lib/auth';
import { getClients, ClientItem } from '../lib/admin/clients';

export interface SessionAuditResult {
  isValid: boolean;
  isExpired: boolean;
  status: 'valid' | 'expired' | 'suspended' | 'no_session' | 'invalid';
  reason: string;
  serverTimestamp: number;
  serverDateIso: string;
  clientTimestamp: number;
  clientDateIso: string;
  clockDriftMs: number;
  expiryTimestamp: number | null;
  expiryDateIso: string | null;
  timeRemainingMs: number | null;
  timeRemainingFormatted: string;
  role: 'admin' | 'user' | null;
  accessCode: string;
  clientInfo?: {
    id?: string;
    name?: string;
    status?: string;
    packageName?: string;
    expiryDate?: string;
  } | null;
  diagnosticMessage: string;
  evaluatedAt: string;
}

// Global server-authoritative clock offset management
const SERVER_OFFSET_STORAGE_KEY = 'satset_server_time_offset_ms';
let cachedServerTimeOffsetMs = (() => {
  if (typeof sessionStorage !== 'undefined') {
    const stored = sessionStorage.getItem(SERVER_OFFSET_STORAGE_KEY);
    if (stored) {
      const parsed = Number(stored);
      if (!isNaN(parsed)) return parsed;
    }
  }
  return 0;
})();

/**
 * Synchronize server clock offset with network round-trip compensation
 */
export function updateServerTimeOffset(serverTimestamp: number, requestInitiatedAt?: number): void {
  if (!serverTimestamp || isNaN(serverTimestamp)) return;
  const now = Date.now();
  const roundTripHalf = requestInitiatedAt ? Math.max(0, Math.floor((now - requestInitiatedAt) / 2)) : 0;
  const adjustedServerNow = serverTimestamp + roundTripHalf;
  cachedServerTimeOffsetMs = adjustedServerNow - now;

  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.setItem(SERVER_OFFSET_STORAGE_KEY, String(cachedServerTimeOffsetMs));
    } catch (e) {}
  }
}

/**
 * Returns strictly server-authoritative current timestamp (Unix ms)
 */
export function getServerAuthoritativeTimestamp(): number {
  return Date.now() + cachedServerTimeOffsetMs;
}

/**
 * Asynchronously sync server time with /api/server-time
 */
export async function syncServerTimeAsync(): Promise<number> {
  const reqStart = Date.now();
  try {
    const res = await fetch('/api/server-time', { cache: 'no-store' });
    if (res.ok) {
      const data = await res.json();
      if (data?.serverTimestamp) {
        updateServerTimeOffset(data.serverTimestamp, reqStart);
      }
    }
  } catch (err) {
    // Non-fatal, fallback to previous offset or local clock
  }
  return getServerAuthoritativeTimestamp();
}

/**
 * Diagnostic logger to capture current session expiry date vs Date.now() / Firestore server timestamp
 */
export function logSessionExpiryDiagnostic(
  session: UserSession | null | undefined,
  audit: SessionAuditResult,
  trigger: string = 'audit'
): void {
  const expiredAt = audit.expiryDateIso || (audit.expiryTimestamp ? new Date(audit.expiryTimestamp).toISOString() : null);
  const currentDate = new Date(Date.now()).toISOString();
  const isExpired = Boolean(audit.isExpired);

  // Standard structured console diagnostic output for real-time debugging
  console.log('[Auth Verification]', {
    expiredAt,
    currentDate,
    isExpired,
    trigger,
    status: audit.status,
    accessCode: audit.accessCode || session?.code || 'NO_CODE',
    role: audit.role || session?.role || null,
    timeRemainingMs: audit.timeRemainingMs,
    timeRemainingFormatted: audit.timeRemainingFormatted,
    reason: audit.reason,
  });

  const isProblematic = audit.isExpired || !audit.isValid || audit.status !== 'valid';
  const prefix = `[AUTH_EXPIRY_DIAGNOSTIC][${trigger.toUpperCase()}]`;

  const logPayload = {
    trigger,
    expiredAt,
    currentDate,
    isExpired,
    status: audit.status,
    isValid: audit.isValid,
    accessCode: audit.accessCode || session?.code || 'NO_CODE',
    role: audit.role || session?.role || 'NONE',
    rawExpiryDate: session?.expiryDate || audit.clientInfo?.expiryDate || 'N/A',
    parsedExpiryTimestamp: audit.expiryTimestamp,
    expiryDateIso: audit.expiryDateIso,
    serverTimestamp: audit.serverTimestamp,
    serverDateIso: audit.serverDateIso,
    clientDateNow: audit.clientTimestamp,
    clientDateIso: audit.clientDateIso,
    clockDriftOffsetMs: audit.clockDriftMs,
    timeRemainingMs: audit.timeRemainingMs,
    timeRemainingFormatted: audit.timeRemainingFormatted,
    reason: audit.reason,
    diagnosticMessage: audit.diagnosticMessage,
  };

  if (isProblematic) {
    console.warn(
      `${prefix} Validation Failure Detected: ${audit.status.toUpperCase()} • expiredAt: ${expiredAt} • currentDate: ${currentDate} • isExpired: ${isExpired} • Code: ${logPayload.accessCode} • Delta: ${audit.timeRemainingMs}ms • Cause: ${audit.reason}`,
      logPayload
    );
  } else {
    console.info(
      `${prefix} Session Verified Active: expiredAt: ${expiredAt || 'Lifetime'} • currentDate: ${currentDate} • isExpired: false • Code: ${logPayload.accessCode} • Remaining: ${audit.timeRemainingFormatted}`,
      logPayload
    );
  }
}

/**
 * Diagnostic utility to audit user session expiry and access validity
 * using strictly Date.now() against secure Firestore / server timestamp comparison.
 */
export function auditSessionExpiry(
  sessionToAudit?: UserSession | null,
  referenceTimestamp?: number
): SessionAuditResult {
  const clientNow = Date.now();
  const serverNow = referenceTimestamp !== undefined ? referenceTimestamp : getServerAuthoritativeTimestamp();
  const clockDriftMs = serverNow - clientNow;
  const serverNowIso = new Date(serverNow).toISOString();
  const clientNowIso = new Date(clientNow).toISOString();

  // 1. Check for missing or guest session
  if (!sessionToAudit || !sessionToAudit.code || sessionToAudit.code === 'GUEST-ACCESS') {
    const diag = `Tidak ada sesi aktif (Guest). ServerNow: ${serverNowIso}`;
    return {
      isValid: false,
      isExpired: false,
      status: 'no_session',
      reason: 'Tidak ada sesi aktif atau sesi berstatus tamu (Guest).',
      serverTimestamp: serverNow,
      serverDateIso: serverNowIso,
      clientTimestamp: clientNow,
      clientDateIso: clientNowIso,
      clockDriftMs,
      expiryTimestamp: null,
      expiryDateIso: null,
      timeRemainingMs: null,
      timeRemainingFormatted: 'Tidak ada sesi',
      role: null,
      accessCode: sessionToAudit?.code || '',
      clientInfo: null,
      diagnosticMessage: diag,
      evaluatedAt: serverNowIso,
    };
  }

  const { code, role, name } = sessionToAudit;
  const cleanCode = code.trim().toUpperCase();

  // 2. Administrator sessions check
  if (
    role === 'admin' ||
    cleanCode === 'SATSET-ADMIN' ||
    cleanCode === 'DAVIDROHMAN037@GMAIL.COM'
  ) {
    const diag = `Otorisasi Admin Seumur Hidup. ServerNow: ${serverNowIso}`;
    return {
      isValid: true,
      isExpired: false,
      status: 'valid',
      reason: 'Otorisasi Super Admin / Administrator terverifikasi aktif.',
      serverTimestamp: serverNow,
      serverDateIso: serverNowIso,
      clientTimestamp: clientNow,
      clientDateIso: clientNowIso,
      clockDriftMs,
      expiryTimestamp: null,
      expiryDateIso: null,
      timeRemainingMs: null,
      timeRemainingFormatted: 'Akses Penuh Tanpa Batas Waktu (Admin)',
      role: 'admin',
      accessCode: code,
      clientInfo: {
        id: 'admin_root',
        name: name || 'Super Admin (David)',
        status: 'active',
        packageName: 'Administrator Lifetime',
      },
      diagnosticMessage: diag,
      evaluatedAt: serverNowIso,
    };
  }

  // 3. User / Client Session Lookup
  let foundClient: ClientItem | undefined;
  try {
    const clients = getClients();
    foundClient = clients.find(
      (c) => c.accessCode && c.accessCode.trim().toUpperCase() === cleanCode
    );
  } catch (err) {
    console.warn('[auditSessionExpiry] Failed to read client database:', err);
  }

  // Check explicit expiry dates from client database, Firestore timestamp, or session payload
  const rawExpiry: any = foundClient?.expiryDate || (sessionToAudit as any).expiryDate || (sessionToAudit as any).expiredAt;
  let parsedExpiryTimestamp: number | null = null;
  let expiryDateIso: string | null = null;

  if (rawExpiry !== undefined && rawExpiry !== null && rawExpiry !== '') {
    let parsedTime: number = NaN;
    
    // Firestore Timestamp format support: { seconds, nanoseconds } or { _seconds, _nanoseconds } or .toDate()
    if (typeof rawExpiry === 'object') {
      if (typeof rawExpiry.toDate === 'function') {
        parsedTime = rawExpiry.toDate().getTime();
      } else if (typeof rawExpiry.toMillis === 'function') {
        parsedTime = rawExpiry.toMillis();
      } else if ('seconds' in rawExpiry && typeof rawExpiry.seconds === 'number') {
        parsedTime = rawExpiry.seconds * 1000;
      } else if ('_seconds' in rawExpiry && typeof rawExpiry._seconds === 'number') {
        parsedTime = rawExpiry._seconds * 1000;
      } else if (rawExpiry instanceof Date) {
        parsedTime = rawExpiry.getTime();
      }
    } else if (typeof rawExpiry === 'number') {
      parsedTime = rawExpiry < 1e11 ? rawExpiry * 1000 : rawExpiry;
    } else if (typeof rawExpiry === 'string') {
      const trimmed = rawExpiry.trim();
      const num = Number(trimmed);
      if (!isNaN(num) && /^\d+$/.test(trimmed)) {
        parsedTime = num < 1e11 ? num * 1000 : num;
      } else {
        const d = new Date(trimmed);
        parsedTime = d.getTime();
      }
    }

    if (!isNaN(parsedTime)) {
      parsedExpiryTimestamp = parsedTime;
      expiryDateIso = new Date(parsedTime).toISOString();
    }
  }

  // 4. Evaluate Suspension Status
  if (foundClient?.status === 'suspended') {
    const timeRemainingMs = parsedExpiryTimestamp !== null ? parsedExpiryTimestamp - serverNow : 0;
    const diag = `Akun disuspend admin. Code: ${cleanCode}, ServerNow: ${serverNowIso}`;
    return {
      isValid: false,
      isExpired: true,
      status: 'suspended',
      reason: 'Akun klien telah ditangguhkan (Suspended) oleh administrator.',
      serverTimestamp: serverNow,
      serverDateIso: serverNowIso,
      clientTimestamp: clientNow,
      clientDateIso: clientNowIso,
      clockDriftMs,
      expiryTimestamp: parsedExpiryTimestamp,
      expiryDateIso,
      timeRemainingMs,
      timeRemainingFormatted: 'Ditangguhkan',
      role: 'user',
      accessCode: code,
      clientInfo: {
        id: foundClient.id,
        name: foundClient.name,
        status: 'suspended',
        packageName: foundClient.packageName || foundClient.packageId,
        expiryDate: foundClient.expiryDate,
      },
      diagnosticMessage: diag,
      evaluatedAt: serverNowIso,
    };
  }

  // 5. Evaluate Timestamp Expiry against Strictly Server-Authoritative Timestamp
  if (parsedExpiryTimestamp !== null) {
    const timeRemainingMs = parsedExpiryTimestamp - serverNow;

    if (timeRemainingMs <= 0 || foundClient?.status === 'expired') {
      const expiredAtFormatted = new Date(parsedExpiryTimestamp).toLocaleDateString('id-ID', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
      const daysOverdue = Math.abs(Math.floor(timeRemainingMs / (1000 * 3600 * 24)));
      const diag = `Masa aktif habis sejak ${expiryDateIso}. ServerNow: ${serverNowIso} (ClientNow: ${clientNowIso}, Drift: ${clockDriftMs}ms). Selisih: ${timeRemainingMs}ms (${daysOverdue} hari lalu).`;

      return {
        isValid: false,
        isExpired: true,
        status: 'expired',
        reason: `Masa aktif kode akses telah kedaluwarsa sejak ${expiredAtFormatted}. Akses ke sumber daya dibatasi.`,
        serverTimestamp: serverNow,
        serverDateIso: serverNowIso,
        clientTimestamp: clientNow,
        clientDateIso: clientNowIso,
        clockDriftMs,
        expiryTimestamp: parsedExpiryTimestamp,
        expiryDateIso,
        timeRemainingMs,
        timeRemainingFormatted: `Kedaluwarsa (${daysOverdue} hari lalu)`,
        role: 'user',
        accessCode: code,
        clientInfo: foundClient
          ? {
              id: foundClient.id,
              name: foundClient.name,
              status: 'expired',
              packageName: foundClient.packageName || foundClient.packageId,
              expiryDate: foundClient.expiryDate,
            }
          : null,
        diagnosticMessage: diag,
        evaluatedAt: serverNowIso,
      };
    }

    // Valid active session with expiry timestamp
    const days = Math.floor(timeRemainingMs / (1000 * 3600 * 24));
    const hours = Math.floor((timeRemainingMs % (1000 * 3600 * 24)) / (1000 * 3600));
    const formattedRemaining =
      days > 0 ? `${days} hari ${hours} jam` : `${hours} jam ${Math.floor((timeRemainingMs % (1000 * 3600)) / (1000 * 60))} menit`;
    const diag = `Sesi aktif valid hingga ${expiryDateIso}. ServerNow: ${serverNowIso}. Sisa: ${formattedRemaining} (${timeRemainingMs}ms).`;

    return {
      isValid: true,
      isExpired: false,
      status: 'valid',
      reason: `Sesi aktif terverifikasi. Sisa masa aktif: ${formattedRemaining}.`,
      serverTimestamp: serverNow,
      serverDateIso: serverNowIso,
      clientTimestamp: clientNow,
      clientDateIso: clientNowIso,
      clockDriftMs,
      expiryTimestamp: parsedExpiryTimestamp,
      expiryDateIso,
      timeRemainingMs,
      timeRemainingFormatted: formattedRemaining,
      role: 'user',
      accessCode: code,
      clientInfo: foundClient
        ? {
            id: foundClient.id,
            name: foundClient.name,
            status: foundClient.status,
            packageName: foundClient.packageName || foundClient.packageId,
            expiryDate: foundClient.expiryDate,
          }
        : null,
      diagnosticMessage: diag,
      evaluatedAt: serverNowIso,
    };
  }

  // 6. Fallback: Check if loginTime exists and exceeds standard max session limit (30 days)
  if (sessionToAudit.loginTime) {
    const maxSessionDurationMs = 30 * 24 * 3600 * 1000;
    const sessionAgeMs = serverNow - sessionToAudit.loginTime;
    if (sessionAgeMs > maxSessionDurationMs) {
      const diag = `Sesi login melebihi batas 30 hari (${sessionAgeMs}ms > ${maxSessionDurationMs}ms). ServerNow: ${serverNowIso}`;
      return {
        isValid: false,
        isExpired: true,
        status: 'expired',
        reason: 'Sesi login telah melebihi batas durasi maksimum 30 hari.',
        serverTimestamp: serverNow,
        serverDateIso: serverNowIso,
        clientTimestamp: clientNow,
        clientDateIso: clientNowIso,
        clockDriftMs,
        expiryTimestamp: sessionToAudit.loginTime + maxSessionDurationMs,
        expiryDateIso: new Date(sessionToAudit.loginTime + maxSessionDurationMs).toISOString(),
        timeRemainingMs: 0,
        timeRemainingFormatted: 'Sesi Kedaluwarsa',
        role: 'user',
        accessCode: code,
        clientInfo: null,
        diagnosticMessage: diag,
        evaluatedAt: serverNowIso,
      };
    }
  }

  // Default active user session
  const diag = `Sesi aktif tanpa batas waktu kedaluwarsa. ServerNow: ${serverNowIso}`;
  return {
    isValid: true,
    isExpired: false,
    status: 'valid',
    reason: 'Sesi pengguna terverifikasi aktif.',
    serverTimestamp: serverNow,
    serverDateIso: serverNowIso,
    clientTimestamp: clientNow,
    clientDateIso: clientNowIso,
    clockDriftMs,
    expiryTimestamp: null,
    expiryDateIso: null,
    timeRemainingMs: null,
    timeRemainingFormatted: 'Aktif',
    role: 'user',
    accessCode: code,
    clientInfo: null,
    diagnosticMessage: diag,
    evaluatedAt: serverNowIso,
  };
}

export interface UseAuthReturn {
  session: UserSession | null;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isUser: boolean;
  isExpired: boolean;
  sessionAudit: SessionAuditResult;
  auditSession: (targetSession?: UserSession | null) => SessionAuditResult;
  code: string;
  role: 'admin' | 'user' | null;
  name: string;
  email: string;
  isLoading: boolean;
  isValidating: boolean;
  error: string | null;
  login: (accessCode: string) => Promise<{ success: boolean; session?: UserSession; error?: string }>;
  logout: () => Promise<void>;
  refreshSession: () => void;
  validateBackendSession: () => Promise<boolean>;
  setSession: (session: UserSession | null) => void;
  clearError: () => void;
}

/**
 * Custom React Hook for authentication and session management.
 * Follows the secure backend-first architecture, auditing session expiry
 * against server-authoritative timestamps and strictly denying expired access.
 */
export function useAuth(): UseAuthReturn {
  const [session, setSessionState] = useState<UserSession | null>(() => {
    const current = getUserSession();
    if (!current || current.code === 'GUEST-ACCESS') {
      return null;
    }
    const audit = auditSessionExpiry(current);
    logSessionExpiryDiagnostic(current, audit, 'init');
    if (audit.isExpired || !audit.isValid) {
      logoutUser();
      return null;
    }
    return current;
  });

  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isValidating, setIsValidating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Diagnostic Audit Calculation (always backed by server-authoritative timestamp)
  const sessionAudit = useMemo(() => {
    const res = auditSessionExpiry(session);
    return res;
  }, [session]);

  const auditSession = useCallback((targetSession?: UserSession | null) => {
    const res = auditSessionExpiry(targetSession !== undefined ? targetSession : session);
    logSessionExpiryDiagnostic(targetSession !== undefined ? targetSession : session, res, 'manual_audit');
    return res;
  }, [session]);

  const refreshSession = useCallback(() => {
    const current = getUserSession();
    if (current && current.code !== 'GUEST-ACCESS') {
      const audit = auditSessionExpiry(current);
      logSessionExpiryDiagnostic(current, audit, 'refresh');
      if (audit.isExpired || !audit.isValid) {
        logoutUser();
        setSessionState(null);
        setError(audit.reason || 'Masa aktif kode akses Anda telah kedaluwarsa. Silakan hubungi admin.');
      } else {
        setSessionState(current);
      }
    } else {
      setSessionState(null);
    }
  }, []);

  /**
   * Validate session with backend proxy endpoint and enforce server-authoritative expiry check
   */
  const validateBackendSession = useCallback(async (): Promise<boolean> => {
    const current = getUserSession();
    if (!current || !current.code || current.code === 'GUEST-ACCESS') {
      return false;
    }

    // Local pre-audit before calling network
    const initialAudit = auditSessionExpiry(current);
    if (initialAudit.isExpired || !initialAudit.isValid) {
      logSessionExpiryDiagnostic(current, initialAudit, 'validate_pre_check_failed');
      logoutUser();
      setSessionState(null);
      setError(initialAudit.reason || 'Masa aktif akses Anda telah kedaluwarsa.');
      return false;
    }

    setIsValidating(true);
    const reqStart = Date.now();
    try {
      const res = await verifyAccessCodeAsync(current.code);
      if (res.serverTimestamp) {
        updateServerTimeOffset(res.serverTimestamp, reqStart);
      }

      if (res.success && res.role) {
        const updatedSession: UserSession = {
          code: res.code || current.code,
          role: res.role,
          email: res.email || current.email,
          name: res.name || current.name,
          loginTime: current.loginTime || Date.now(),
          expiryDate: res.expiryDate || current.expiryDate,
        };

        const postAudit = auditSessionExpiry(updatedSession);
        logSessionExpiryDiagnostic(updatedSession, postAudit, 'validate_backend_success');

        if (postAudit.isExpired || !postAudit.isValid) {
          logoutUser();
          setSessionState(null);
          setError(postAudit.reason || 'Masa aktif kode akses Anda telah kedaluwarsa.');
          return false;
        }

        setUserSession(updatedSession);
        setSessionState(updatedSession);
        setError(null);
        return true;
      } else {
        // Session invalid or expired on backend
        logoutUser();
        setSessionState(null);
        setError(res.error || 'Sesi telah kedaluwarsa atau tidak valid.');
        return false;
      }
    } catch (err: any) {
      console.warn('[useAuth] Validation network error:', err);
      // On network failure, strictly enforce local server-offset audit
      const fallbackAudit = auditSessionExpiry(current);
      logSessionExpiryDiagnostic(current, fallbackAudit, 'validate_network_fallback');
      if (fallbackAudit.isExpired || !fallbackAudit.isValid) {
        logoutUser();
        setSessionState(null);
        setError(fallbackAudit.reason || 'Masa aktif paket Anda telah kedaluwarsa.');
        return false;
      }
      return true;
    } finally {
      setIsValidating(false);
    }
  }, []);

  // Sync state on mount and subscribe to auth/storage/focus events
  useEffect(() => {
    // Initial clock sync
    syncServerTimeAsync().then(() => {
      refreshSession();
    });

    setIsLoading(false);

    // Actively validate session validity and expiry against backend on startup
    const current = getUserSession();
    if (current && current.code && current.code !== 'GUEST-ACCESS') {
      validateBackendSession();
    }

    const handleAuthEvent = () => {
      refreshSession();
    };

    const handleVisibilityOrFocus = () => {
      if (document.visibilityState === 'visible') {
        syncServerTimeAsync().then(() => {
          refreshSession();
        });
      }
    };

    window.addEventListener('satset_auth_updated', handleAuthEvent);
    window.addEventListener('satset_session_updated', handleAuthEvent);
    window.addEventListener('satset_clients_updated', handleAuthEvent);
    window.addEventListener('storage', handleAuthEvent);
    window.addEventListener('focus', handleVisibilityOrFocus);
    document.addEventListener('visibilitychange', handleVisibilityOrFocus);

    // Periodic interval to actively detect session expiry in real time (every 15s)
    const expiryCheckInterval = setInterval(() => {
      const activeSession = getUserSession();
      if (activeSession && activeSession.code && activeSession.code !== 'GUEST-ACCESS') {
        const audit = auditSessionExpiry(activeSession);
        if (audit.isExpired || !audit.isValid) {
          logSessionExpiryDiagnostic(activeSession, audit, 'interval_check');
          logoutUser();
          setSessionState(null);
          setError(audit.reason || 'Masa aktif kode akses Anda telah kedaluwarsa.');
        }
      }
    }, 15000);

    return () => {
      window.removeEventListener('satset_auth_updated', handleAuthEvent);
      window.removeEventListener('satset_session_updated', handleAuthEvent);
      window.removeEventListener('satset_clients_updated', handleAuthEvent);
      window.removeEventListener('storage', handleAuthEvent);
      window.removeEventListener('focus', handleVisibilityOrFocus);
      document.removeEventListener('visibilitychange', handleVisibilityOrFocus);
      clearInterval(expiryCheckInterval);
    };
  }, [refreshSession, validateBackendSession]);

  // Real-time presence heartbeat every 30 seconds when authenticated
  useEffect(() => {
    if (!session?.code || session.code === 'GUEST-ACCESS' || sessionAudit.isExpired) return;

    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/presence/heartbeat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            accessCode: session.code,
            name: session.name || 'User',
            role: session.role || 'user',
          }),
        });
        if (res.ok) {
          const dateHeader = res.headers.get('date');
          if (dateHeader) {
            const parsedServerTime = new Date(dateHeader).getTime();
            if (!isNaN(parsedServerTime)) {
              updateServerTimeOffset(parsedServerTime);
            }
          }
        }
      } catch (e) {}
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 30000);
    return () => clearInterval(interval);
  }, [session?.code, session?.name, session?.role, sessionAudit.isExpired]);

  /**
   * Secure login via backend verification with server-authoritative expiry check
   */
  const login = useCallback(
    async (
      accessCode: string
    ): Promise<{ success: boolean; session?: UserSession; error?: string }> => {
      const cleaned = accessCode.trim();
      if (!cleaned) {
        const msg = 'Silakan masukkan Kode Akses.';
        setError(msg);
        return { success: false, error: msg };
      }

      setIsValidating(true);
      setError(null);
      const reqStart = Date.now();

      try {
        const res = await verifyAccessCodeAsync(cleaned);
        if (res.serverTimestamp) {
          updateServerTimeOffset(res.serverTimestamp, reqStart);
        }

        if (res.success && res.role) {
          const newSession: UserSession = {
            code: res.code || cleaned.toUpperCase(),
            role: res.role,
            email: res.email,
            name: res.name || (res.role === 'admin' ? 'Administrator' : 'Klien Satset'),
            loginTime: Date.now(),
            expiryDate: res.expiryDate,
          };

          // Diagnostic audit on newly created session using server timestamp
          const audit = auditSessionExpiry(newSession);
          logSessionExpiryDiagnostic(newSession, audit, 'login');

          if (audit.isExpired || !audit.isValid) {
            const expiryMsg = audit.reason || 'Masa aktif kode akses telah kedaluwarsa.';
            setError(expiryMsg);
            return { success: false, error: expiryMsg };
          }

          setUserSession(newSession);
          setSessionState(newSession);
          syncHistoryAsync(newSession.code);
          setError(null);

          sendLoginAuditLog({
            action: 'LOGIN BERHASIL',
            details: `User ${newSession.name || 'User'} berhasil login (${newSession.role.toUpperCase()}) • Kode: ${newSession.code}`,
            category: newSession.role === 'admin' ? 'system' : 'client',
            actor: newSession.name ? `${newSession.name} (${newSession.code})` : newSession.code,
          });

          return { success: true, session: newSession };
        } else {
          const errMsg = res.error || 'Kode Akses tidak valid atau telah kedaluwarsa.';
          setError(errMsg);

          sendLoginAuditLog({
            action: 'LOGIN GAGAL',
            details: `Percobaan login gagal dengan kode: ${cleaned} (${errMsg})`,
            category: 'system',
            actor: `Tamu (${cleaned})`,
          });

          return { success: false, error: errMsg };
        }
      } catch (err: any) {
        const errMsg = err?.message || 'Gagal memverifikasi kode akses ke server.';
        setError(errMsg);

        sendLoginAuditLog({
          action: 'LOGIN GAGAL',
          details: `Error verifikasi login kode: ${cleaned} (${errMsg})`,
          category: 'system',
          actor: `Tamu (${cleaned})`,
        });

        return { success: false, error: errMsg };
      } finally {
        setIsValidating(false);
      }
    },
    []
  );

  /**
   * Secure logout notifying backend and clearing local state
   */
  const logout = useCallback(async (): Promise<void> => {
    setIsValidating(true);
    try {
      logoutUser();
    } finally {
      setSessionState(null);
      setError(null);
      setIsValidating(false);
    }
  }, []);

  /**
   * Explicitly set session with audit verification
   */
  const setSession = useCallback((newSession: UserSession | null) => {
    if (newSession) {
      const audit = auditSessionExpiry(newSession);
      logSessionExpiryDiagnostic(newSession, audit, 'set_session');
      if (audit.isExpired || !audit.isValid) {
        logoutUser();
        setSessionState(null);
        setError(audit.reason || 'Masa aktif kode akses telah kedaluwarsa.');
        return;
      }
    }
    setUserSession(newSession);
    setSessionState(newSession);
    if (!newSession) {
      setError(null);
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Strict authorization logic: expired sessions are rejected immediately
  const isExpired = Boolean(sessionAudit.isExpired);
  const isAuthenticated = Boolean(
    session &&
      session.code &&
      session.code !== 'GUEST-ACCESS' &&
      !isExpired &&
      sessionAudit.isValid
  );
  const isAdmin = Boolean(session?.role === 'admin' && !isExpired);
  const isUser = Boolean(session?.role === 'user' && !isExpired && isAuthenticated);

  return {
    session: isAuthenticated ? session : null,
    isAuthenticated,
    isAdmin,
    isUser,
    isExpired,
    sessionAudit,
    auditSession,
    code: isAuthenticated ? session?.code || '' : '',
    role: isAuthenticated ? session?.role || null : null,
    name: isAuthenticated ? session?.name || '' : '',
    email: isAuthenticated ? session?.email || '' : '',
    isLoading,
    isValidating,
    error,
    login,
    logout,
    refreshSession,
    validateBackendSession,
    setSession,
    clearError,
  };
}

export default useAuth;


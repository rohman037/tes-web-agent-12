import crypto from 'crypto';
import { broadcastLiveEvent } from '@/server/core/state/serverState';

export interface ActivePresenceSession {
  sessionHash: string;
  accessCodeMasked: string;
  name: string;
  role: string;
  ip: string;
  userAgent: string;
  loginAt: string;
  lastSeenAt: number;
}

export const activePresenceSessions = new Map<string, ActivePresenceSession>();

function maskAccessCode(code: string): string {
  if (!code) return '••••';
  const clean = code.trim();
  if (clean.length <= 4) return '••••';
  if (clean.length <= 8) return `${clean.slice(0, 2)}••••${clean.slice(-2)}`;
  return `${clean.slice(0, 4)}••••${clean.slice(-3)}`;
}

function hashSessionKey(code: string, ip: string): string {
  return crypto.createHash('sha256').update(`${code.trim().toUpperCase()}_${ip}`).digest('hex');
}

export function getActiveSessionsList(): ActivePresenceSession[] {
  const cutoff = Date.now() - 2 * 60 * 1000; // 2 minutes timeout
  const activeList: ActivePresenceSession[] = [];
  for (const [key, session] of activePresenceSessions.entries()) {
    if (session.lastSeenAt >= cutoff) {
      activeList.push(session);
    } else {
      activePresenceSessions.delete(key);
    }
  }
  return activeList;
}

export function recordUserPresence(session: { accessCode: string; name?: string; role?: string; ip?: string; userAgent?: string }) {
  const code = (session.accessCode || '').trim();
  if (!code) return;
  const ip = session.ip || 'unknown';
  const sessionKey = hashSessionKey(code, ip);
  const existing = activePresenceSessions.get(sessionKey);
  const now = Date.now();

  const item: ActivePresenceSession = {
    sessionHash: sessionKey.slice(0, 16),
    accessCodeMasked: maskAccessCode(code),
    name: session.name || existing?.name || 'Klien Satset',
    role: session.role || existing?.role || 'user',
    ip: ip || existing?.ip || 'unknown',
    userAgent: session.userAgent || existing?.userAgent || 'Web Browser',
    loginAt: existing?.loginAt || new Date().toISOString(),
    lastSeenAt: now,
  };
  activePresenceSessions.set(sessionKey, item);
  try {
    broadcastLiveEvent({
      type: 'presence_updated',
      activeSessions: getActiveSessionsList(),
    });
  } catch (e) {}
}

export function removeUserPresence(accessCode: string, ip: string = 'unknown') {
  const code = (accessCode || '').trim();
  if (!code) return;
  const sessionKey = hashSessionKey(code, ip);
  if (activePresenceSessions.has(sessionKey)) {
    activePresenceSessions.delete(sessionKey);
    try {
      broadcastLiveEvent({
        type: 'presence_updated',
        activeSessions: getActiveSessionsList(),
      });
    } catch (e) {}
  }
}

// Background cleanup loop for expired sessions
let cleanupTimer: any = null;
export function startPresenceCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const prevCount = activePresenceSessions.size;
    const list = getActiveSessionsList();
    if (activePresenceSessions.size !== prevCount) {
      try {
        broadcastLiveEvent({
          type: 'presence_updated',
          activeSessions: list,
        });
      } catch (e) {}
    }
  }, 45000);
}

import { Request } from 'express';
import { dbAddAuditLog, dbGetAuditLogs } from '@/src/db/dbService';
import { broadcastLiveEvent } from '@/server/core/state/serverState';
import { AuditLogItem } from '@/src/types';
import { logger } from '@/server/core/utils/logger';

export type AuditCategory = 'auth' | 'admin' | 'payment' | 'apikey' | 'api_usage' | 'security' | 'system';

export interface AuditLogPayload {
  action: string;
  details?: string;
  category?: AuditCategory;
  actor?: string;
  adminName?: string;
  clientIp?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export function extractClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    const first = forwarded.split(',')[0].trim();
    if (first) return first.replace('::ffff:', '');
  }
  return (req.ip || req.socket.remoteAddress || 'unknown').replace('::ffff:', '');
}

export function extractUserAgent(req: Request): string {
  return (req.headers['user-agent'] as string) || 'Unknown Browser';
}

/**
 * Persists an audit log entry to Firestore and local backup,
 * and broadcasts it in real-time to active admin dashboards.
 */
export async function recordAuditLog(payload: AuditLogPayload): Promise<AuditLogItem> {
  const id = `audit_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const timestamp = new Date().toISOString();

  const item: AuditLogItem = {
    id,
    action: payload.action,
    details: payload.details || '',
    category: payload.category || 'system',
    adminName: payload.adminName || payload.actor || 'System Engine',
    timestamp,
  };

  try {
    await dbAddAuditLog(item);
    logger.info(`[AUDIT] [${item.category?.toUpperCase()}] ${item.action}: ${item.details}`);

    // Broadcast live event to admin dashboard
    const currentLogs = await dbGetAuditLogs();
    broadcastLiveEvent({
      type: 'audit_log_event',
      log: item,
      auditLogs: currentLogs,
    });
    broadcastLiveEvent({ type: 'audit_logs_updated' } as any);
  } catch (err) {
    logger.warn('[Audit Logger] Failed to persist audit log:', err);
  }

  return item;
}

/**
 * Specialized logger for authentication events (login, failed login, logout, blocked).
 */
export async function logAuthEvent(
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAILED' | 'LOGOUT' | 'UNAUTHORIZED_ACCESS' | 'BANNED_ACCESS_ATTEMPT',
  req: Request,
  details: string,
  actor?: string,
  category: AuditCategory = 'auth'
) {
  const ip = extractClientIp(req);
  const ua = extractUserAgent(req);
  return recordAuditLog({
    action,
    details: `${details} [IP: ${ip}]`,
    category,
    actor: actor || 'Anonymous',
    adminName: actor || `IP_${ip}`,
    clientIp: ip,
    userAgent: ua,
  });
}

/**
 * Specialized logger for admin operations (keys, packages, user changes).
 */
export async function logAdminActionEvent(
  action: string,
  req: Request,
  details: string,
  adminName?: string
) {
  const ip = extractClientIp(req);
  const ua = extractUserAgent(req);
  return recordAuditLog({
    action: `[ADMIN ACTION] ${action}`,
    details: `${details} • Executor: ${adminName || 'Admin'} [IP: ${ip}]`,
    category: 'admin',
    actor: adminName || 'Admin',
    adminName: adminName || 'Administrator',
    clientIp: ip,
    userAgent: ua,
  });
}

/**
 * Specialized logger for payment & transaction verification.
 */
export async function logPaymentEvent(
  action: 'TRANSACTION_CREATED' | 'PROOF_SUBMITTED' | 'TRANSACTION_APPROVED' | 'TRANSACTION_REJECTED',
  req: Request,
  details: string,
  actor?: string
) {
  const ip = extractClientIp(req);
  const ua = extractUserAgent(req);
  return recordAuditLog({
    action: `[PAYMENT] ${action}`,
    details: `${details} [IP: ${ip}]`,
    category: 'payment',
    actor: actor || 'Customer',
    adminName: actor || 'Payment Gateway',
    clientIp: ip,
    userAgent: ua,
  });
}

/**
 * Specialized logger for AI & API usage tracking.
 */
export async function logApiUsageEvent(
  tool: string,
  model: string,
  req: Request,
  status: 'SUCCESS' | 'FAILED' | 'RATE_LIMITED',
  details: string,
  tokenCount?: number
) {
  const ip = extractClientIp(req);
  const ua = extractUserAgent(req);
  return recordAuditLog({
    action: `[API USAGE] ${tool} (${status})`,
    details: `Model: ${model} • Tool: ${tool} • ${details} • Tokens: ${tokenCount || 0} [IP: ${ip}]`,
    category: 'api_usage',
    actor: (req.headers['x-client-access-code'] as string) || (req.headers['x-access-code'] as string) || `IP_${ip}`,
    adminName: 'AI Engine',
    clientIp: ip,
    userAgent: ua,
  });
}

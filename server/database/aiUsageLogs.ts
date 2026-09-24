import { safeGet, safeSave } from '@/src/db/dbService';
import { logger } from '@/server/core/utils/logger';

export interface AiUsageLog {
  id: string;
  api_key_id: string;
  model_name: string;
  task_type: string;
  status: 'success' | 'rate_limited' | 'error' | 'fallback';
  http_status?: number;
  error_message?: string;
  latency_ms?: number;
  timestamp: string;
}

const COLLECTION_NAME = 'ai_usage_logs';
const MAX_IN_MEMORY_LOGS = 200;
const memoryLogs: AiUsageLog[] = [];

export async function recordAiUsageLog(
  log: Omit<AiUsageLog, 'id' | 'timestamp'>
): Promise<AiUsageLog> {
  const fullLog: AiUsageLog = {
    id: `log_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    ...log,
    timestamp: new Date().toISOString(),
  };

  memoryLogs.unshift(fullLog);
  if (memoryLogs.length > MAX_IN_MEMORY_LOGS) {
    memoryLogs.pop();
  }

  try {
    await safeSave(COLLECTION_NAME, fullLog);
  } catch (err) {
    logger.error('[aiUsageLogs] Failed to persist usage log:', err);
  }

  return fullLog;
}

export async function getAiUsageLogs(limit = 100): Promise<AiUsageLog[]> {
  try {
    const logs = (await safeGet(COLLECTION_NAME)) as AiUsageLog[];
    if (logs && logs.length > 0) {
      return logs
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, limit);
    }
  } catch (e) {}
  return memoryLogs.slice(0, limit);
}

export async function getAiUsageStats() {
  const logs = await getAiUsageLogs(300);
  const totalRequests = logs.length;
  const errorLogs = logs.filter((l) => l.status === 'error' || l.status === 'rate_limited');
  const totalErrors = errorLogs.length;
  const rateLimitCount = logs.filter((l) => l.status === 'rate_limited').length;

  const byModel: Record<string, { requests: number; errors: number }> = {};
  const byKey: Record<string, { requests: number; errors: number }> = {};

  for (const log of logs) {
    if (!byModel[log.model_name]) {
      byModel[log.model_name] = { requests: 0, errors: 0 };
    }
    byModel[log.model_name].requests++;
    if (log.status === 'error' || log.status === 'rate_limited') {
      byModel[log.model_name].errors++;
    }

    if (!byKey[log.api_key_id]) {
      byKey[log.api_key_id] = { requests: 0, errors: 0 };
    }
    byKey[log.api_key_id].requests++;
    if (log.status === 'error' || log.status === 'rate_limited') {
      byKey[log.api_key_id].errors++;
    }
  }

  return {
    totalRequests,
    totalErrors,
    rateLimitCount,
    successRate: totalRequests > 0 ? (((totalRequests - totalErrors) / totalRequests) * 100).toFixed(1) + '%' : '100%',
    byModel,
    byKey,
    recentErrors: errorLogs.slice(0, 20),
  };
}

import { logger } from '@/server/core/utils/logger';
import { safeGet, safeSave } from '@/src/db/dbService';
import { wrapCronJob, Sentry } from '@/server/core/observability/sentry';

export interface ModelQuotaLedgerState {
  rpmWindow: number[]; // timestamps in ms
  tpmUsed: number;
  rpdUsed: number;
  lastResetPT: string; // e.g. "2026-09-23"
}

export type KeyQuotaLedger = Map<string, ModelQuotaLedgerState>; // modelName -> state

const GLOBAL_QUOTA_LEDGER = new Map<string, KeyQuotaLedger>(); // keyId -> KeyQuotaLedger

/**
 * Returns Pacific Time (PT) date string (YYYY-MM-DD)
 */
export function getPacificDateString(date = new Date()): string {
  try {
    const ptString = date.toLocaleDateString('en-US', {
      timeZone: 'America/Los_Angeles',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    // ptString is MM/DD/YYYY, convert to YYYY-MM-DD
    const [month, day, year] = ptString.split('/');
    return `${year}-${month}-${day}`;
  } catch {
    return date.toISOString().split('T')[0];
  }
}

/**
 * Initializes or gets ledger state for a specific key and model
 */
export function getModelLedgerState(keyId: string, modelName: string): ModelQuotaLedgerState {
  if (!GLOBAL_QUOTA_LEDGER.has(keyId)) {
    GLOBAL_QUOTA_LEDGER.set(keyId, new Map());
  }
  const keyMap = GLOBAL_QUOTA_LEDGER.get(keyId)!;

  const todayPT = getPacificDateString();

  if (!keyMap.has(modelName)) {
    keyMap.set(modelName, {
      rpmWindow: [],
      tpmUsed: 0,
      rpdUsed: 0,
      lastResetPT: todayPT,
    });
  }

  const state = keyMap.get(modelName)!;

  // Check if Pacific Day has rolled over
  if (state.lastResetPT !== todayPT) {
    state.rpdUsed = 0;
    state.tpmUsed = 0;
    state.rpmWindow = [];
    state.lastResetPT = todayPT;
  }

  // Purge RPM timestamps older than 60 seconds
  const now = Date.now();
  state.rpmWindow = state.rpmWindow.filter((ts) => now - ts < 60000);

  return state;
}

/**
 * Records an outbound request usage for a key and model
 */
export function recordQuotaUsage(keyId: string, modelName: string, estimatedTokens = 500) {
  const state = getModelLedgerState(keyId, modelName);
  const now = Date.now();
  state.rpmWindow.push(now);
  state.tpmUsed += estimatedTokens;
  state.rpdUsed += 1;
}

/**
 * Checks if key is within limits for a model
 */
export function checkKeyQuotaAvailable(
  keyId: string,
  modelName: string,
  rpmLimit: number,
  rpdLimit: number,
  isCronOrBulk = false
): boolean {
  const state = getModelLedgerState(keyId, modelName);
  
  // 1. Check RPM (rolling 60s)
  if (state.rpmWindow.length >= rpmLimit) {
    return false;
  }

  // 2. Check RPD limit
  const maxAllowedRatio = isCronOrBulk ? 0.5 : 0.8; // Cron restricted to 50%, normal tasks to 80%
  if (state.rpdUsed >= rpdLimit * maxAllowedRatio) {
    return false;
  }

  return true;
}

/**
 * Persist quota ledger snapshot to Firestore
 */
export async function persistQuotaLedger(): Promise<void> {
  try {
    const snapshot: Record<string, Record<string, any>> = {};
    for (const [keyId, keyMap] of GLOBAL_QUOTA_LEDGER.entries()) {
      snapshot[keyId] = {};
      for (const [model, state] of keyMap.entries()) {
        snapshot[keyId][model] = {
          rpmWindowCount: state.rpmWindow.length,
          tpmUsed: state.tpmUsed,
          rpdUsed: state.rpdUsed,
          lastResetPT: state.lastResetPT,
        };
      }
    }

    await safeSave('system_state', {
      id: 'quota_ledger_snapshot',
      updatedAt: new Date().toISOString(),
      snapshot,
    });
  } catch (err: any) {
    logger.warn('[QuotaLedger] Failed persisting quota ledger snapshot:', err?.message || err);
  }
}

/**
 * Load quota ledger snapshot from Firestore on boot
 */
export async function loadQuotaLedger(): Promise<void> {
  try {
    const docs = await safeGet('system_state');
    const record = docs.find((d: any) => d.id === 'quota_ledger_snapshot');
    if (record && record.snapshot) {
      const todayPT = getPacificDateString();
      for (const [keyId, models] of Object.entries(record.snapshot)) {
        if (!GLOBAL_QUOTA_LEDGER.has(keyId)) {
          GLOBAL_QUOTA_LEDGER.set(keyId, new Map());
        }
        const keyMap = GLOBAL_QUOTA_LEDGER.get(keyId)!;
        for (const [model, stateData]: [string, any] of Object.entries(models as any)) {
          if (stateData.lastResetPT === todayPT) {
            keyMap.set(model, {
              rpmWindow: [], // reset rolling window on boot for freshness
              tpmUsed: stateData.tpmUsed || 0,
              rpdUsed: stateData.rpdUsed || 0,
              lastResetPT: todayPT,
            });
          }
        }
      }
      logger.info('[QuotaLedger] Successfully loaded quota ledger snapshot from Firestore.');
    }
  } catch (err: any) {
    logger.warn('[QuotaLedger] Note loading quota ledger snapshot:', err?.message || err);
  }
}

/**
 * Daily Pacific Time Midnight Reset Cron Job wrapper
 */
export async function runPacificMidnightResetCron() {
  return wrapCronJob('pacific_midnight_quota_reset', async () => {
    const todayPT = getPacificDateString();
    let resetCount = 0;

    for (const [keyId, keyMap] of GLOBAL_QUOTA_LEDGER.entries()) {
      for (const [model, state] of keyMap.entries()) {
        if (state.lastResetPT !== todayPT) {
          state.rpdUsed = 0;
          state.tpmUsed = 0;
          state.rpmWindow = [];
          state.lastResetPT = todayPT;
          resetCount++;
        }
      }
    }
    logger.info(`[QuotaLedger] Pacific midnight reset executed for ${resetCount} model state entries. New PT date: ${todayPT}`);
  });
}

export function getGlobalLedgerSnapshot() {
  const result: Record<string, any> = {};
  for (const [keyId, keyMap] of GLOBAL_QUOTA_LEDGER.entries()) {
    result[keyId] = {};
    for (const [model, state] of keyMap.entries()) {
      result[keyId][model] = {
        rpdUsed: state.rpdUsed,
        tpmUsed: state.tpmUsed,
        rpmCurrent: state.rpmWindow.length,
        lastResetPT: state.lastResetPT,
      };
    }
  }
  return result;
}

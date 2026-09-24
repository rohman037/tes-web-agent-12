import cron from 'node-cron';
import { dbGetApiKeys, dbGetClients, dbSaveClient, dbGetTransactions, dbGetGrowthState, dbDeleteAccessCode, dbGetAccessCodes, dbAddAuditLog } from '@/src/db/dbService';
import { runAutoAgentFactory } from '@/server/core/intelligence/agentAutoAgentFactory';
import { analyzeUserGrowth } from '@/server/core/intelligence/agentUserGrowthAnalyst';
import { optimizeCostAndTiers } from '@/server/core/intelligence/agentCostTierOptimizer';
import { broadcastLiveEvent } from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';
import { wrapCronJob } from '@/server/core/observability/sentry';

let cronInitialized = false;

/**
 * Scan all registered clients and automatically expire/deactivate codes
 * that have passed their 30-day or custom validity period.
 */
export async function runClientExpiryAndQuotaCleanup() {
  return wrapCronJob('client_expiry_cleanup', async () => {
    const clients = await dbGetClients();
    const now = Date.now();
    let hasChanges = false;

    for (const client of clients) {
      if (client.status === 'suspended') continue;

      const expiry = client.expiryDate ? new Date(client.expiryDate).getTime() : 0;
      if (expiry > 0 && expiry <= now && client.status !== 'expired') {
        client.status = 'expired';
        await dbSaveClient(client);
        hasChanges = true;

        if (client.accessCode) {
          await dbDeleteAccessCode(client.accessCode);
        }

        await dbAddAuditLog({
          id: `audit_exp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          adminName: 'Sistem Auto-Expiry 24/7',
          action: 'Masa Aktif Klien Kedaluwarsa',
          details: `Masa aktif akun ${client.name || 'Klien'} (${client.accessCode}) telah habis pada ${new Date(client.expiryDate).toLocaleDateString('id-ID')}. Kode otomatis dinonaktifkan oleh sistem.`,
          timestamp: new Date().toISOString(),
          category: 'client',
        });

        logger.info(`[Auto-Expiry] Client "${client.name}" (${client.accessCode}) expired. Code revoked.`);
      }
    }

    if (hasChanges) {
      broadcastLiveEvent({ type: 'clients_updated', clients: await dbGetClients() });
      broadcastLiveEvent({ type: 'access_codes_updated', accessCodes: await dbGetAccessCodes() });
    }
  });
}

export function initBackgroundSchedulers() {
  if (cronInitialized) return;
  cronInitialized = true;

  logger.info('[Server Schedulers] Initializing 24/7 autonomous agents cron jobs...');

  // Run initial expiry cleanup on server startup
  runClientExpiryAndQuotaCleanup();

  // 1. Client Expiry & Quota Watcher (Every 10 minutes)
  cron.schedule('*/10 * * * *', async () => {
    await runClientExpiryAndQuotaCleanup();
  });

  // 2. Hourly Cost & Model Tier Optimizer (At minute 0)
  cron.schedule('0 * * * *', async () => {
    await wrapCronJob('hourly_cost_tier_optimizer', async () => {
      const keysArr = await dbGetApiKeys();
      await optimizeCostAndTiers(keysArr);
    });
  });

  // 3. Daily User Growth Analyst Cron (00:00)
  cron.schedule('0 0 * * *', async () => {
    logger.info('[Server Cron 24/7] Running Daily User Growth Analyst...');
    await wrapCronJob('daily_user_growth_analyst', async () => {
      const clients = await dbGetClients();
      const transactions = await dbGetTransactions();
      await analyzeUserGrowth(clients, transactions);
    });
  });

  // 4. Daily Meta-Agent Auto-Factory Cron (00:05)
  cron.schedule('5 0 * * *', async () => {
    logger.info('[Server Cron 24/7] Running Daily Meta-Agent Auto-Factory...');
    await wrapCronJob('daily_meta_agent_factory', async () => {
      const clients = await dbGetClients();
      const transactions = await dbGetTransactions();
      const factoryResult = await runAutoAgentFactory(clients, transactions);
      if (factoryResult?.scalingDecisions && factoryResult.scalingDecisions.length > 0) {
        broadcastLiveEvent({
          type: 'growth_scaling_updated',
          growthState: await dbGetGrowthState(),
        });
      }
    });
  });
}

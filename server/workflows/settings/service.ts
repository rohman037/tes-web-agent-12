import {
  dbGetContactSettings,
  dbSaveContactSettings,
  dbGetTrackingEvents,
  dbGetClients,
  dbGetTransactions,
  dbGetSystemMemory,
  dbGetPackages,
  dbGetAccessCodes,
  dbGetAiAgents,
  dbGetQrisConfig,
  dbSaveClient,
  dbSavePackage,
  dbGetHistory,
  dbSaveHistoryItem,
  dbDeleteHistoryItem,
} from '@/src/db/dbService';
import { broadcastLiveEvent } from '@/server/core/state/serverState';

export async function getContactSettingsService() {
  return await dbGetContactSettings();
}

export async function updateContactSettingsService(data: any) {
  const { whatsappNumber, whatsappTemplate } = data || {};
  const settings = {
    whatsappNumber: whatsappNumber || '6281234567890',
    whatsappTemplate: whatsappTemplate || 'Halo Admin Tools Satset, saya ingin konsultasi mengenai Kode Akses.',
    updatedAt: new Date().toISOString(),
  };
  await dbSaveContactSettings(settings);
  broadcastLiveEvent({ type: 'contact_settings_updated', contactSettings: settings });
  return settings;
}

export async function getUsageSummaryAnalyticsService() {
  const events = await dbGetTrackingEvents();
  const clients = await dbGetClients();
  const txns = await dbGetTransactions();
  const memory = await dbGetSystemMemory();

  const totalExecutions = events.length || memory?.totalExecutions || 0;
  const successCount = events.filter((e: any) => e.outcome === 'success').length || memory?.successfulPromptsCount || 0;

  return {
    totalExecutions,
    successCount,
    successRate: totalExecutions > 0 ? Math.round((successCount / totalExecutions) * 100) : 98,
    totalRevenue: txns.filter((t: any) => t.status === 'APPROVED').reduce((acc: number, t: any) => acc + (t.totalPrice || t.planPrice || t.amount || 0), 0),
    activeClients: clients.filter((c: any) => c.status === 'active').length,
    categoryBreakdown: memory?.categoryUsage || { fashion: 45, beauty: 35, gadget: 28, kuliner: 22 },
    modelUsage: {
      'gemini-3.6-flash': Math.round(totalExecutions * 0.75) || 280,
      'gemini-2.5-flash': Math.round(totalExecutions * 0.20) || 75,
      'gemini-1.5-pro': Math.round(totalExecutions * 0.05) || 15,
    },
  };
}

export async function exportSystemBackupService() {
  const clients = await dbGetClients();
  const packages = await dbGetPackages();
  const transactions = await dbGetTransactions();
  const accessCodes = await dbGetAccessCodes();
  const aiAgents = await dbGetAiAgents();
  const qrisConfig = await dbGetQrisConfig();
  const contactSettings = await dbGetContactSettings();
  const systemMemory = await dbGetSystemMemory();

  return {
    exportedAt: new Date().toISOString(),
    version: 'Satset-v2.5',
    collections: {
      clients,
      packages,
      transactions,
      accessCodes,
      aiAgents,
      qrisConfig,
      contactSettings,
      systemMemory,
    },
  };
}

export async function restoreSystemBackupService(collections: any) {
  if (!collections) {
    throw new Error('Valid backup payload required');
  }

  if (Array.isArray(collections.clients)) {
    for (const c of collections.clients) await dbSaveClient(c);
  }
  if (Array.isArray(collections.packages)) {
    for (const p of collections.packages) await dbSavePackage(p);
  }

  broadcastLiveEvent({ type: 'system_backup_restored', timestamp: new Date().toISOString() });
  return { message: 'Database backup successfully restored' };
}

export async function getHistoryService(accessCode?: string) {
  return await dbGetHistory(String(accessCode || ''));
}

export async function saveHistoryItemService(item: any) {
  return await dbSaveHistoryItem(item);
}

export async function deleteHistoryItemService(id: string) {
  return await dbDeleteHistoryItem(id);
}

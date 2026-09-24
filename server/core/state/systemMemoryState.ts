import { dbGetSystemMemory, dbSaveSystemMemory } from '@/src/db/dbService';
import { dispatchRealtimeBroadcast } from '@/server/core/intelligence/agentRealtimeBroadcastDispatcher';
import { registerExecutionUpgradeHandler } from './serverState';
import { logger } from '@/server/core/utils/logger';

export interface SystemMemory {
  totalExecutions: number;
  successfulPromptsCount: number;
  learnedKnowledgeBase: string[];
  viralHookPatterns: string[];
  categoryUsage: {
    videoPrompt: number;
    contentIdeas: number;
    photoPrompt: number;
  };
  formulas?: any[];
  lastUpdated: string;
}

export const MEMORY_FILE_PATH = 'system_memory.json';

export let systemMemory: SystemMemory = {
  totalExecutions: 350,
  successfulPromptsCount: 342,
  learnedKnowledgeBase: ['Hook visual di 3 detik pertama meningkatkan retention rate hingga 68%.'],
  viralHookPatterns: ['Jangan beli [produk] sebelum tau 3 hal ini!'],
  categoryUsage: { videoPrompt: 120, contentIdeas: 90, photoPrompt: 40 },
  formulas: ['Hook BLUFF + 3 Adegan Visual + CTA Spesifik'],
  lastUpdated: new Date().toISOString(),
};

let isMemoryDirty = false;
let memorySaveTimer: NodeJS.Timeout | null = null;

export async function loadSystemMemory(): Promise<SystemMemory> {
  try {
    let mem = await dbGetSystemMemory();
    if (!mem || Object.keys(mem).length === 0) {
      mem = {
        totalExecutions: 350,
        successfulPromptsCount: 342,
        learnedKnowledgeBase: ['Hook visual di 3 detik pertama meningkatkan retention rate hingga 68%.'],
        viralHookPatterns: ['Jangan beli [produk] sebelum tau 3 hal ini!'],
        categoryUsage: { videoPrompt: 120, contentIdeas: 90, photoPrompt: 40 },
        formulas: ['Hook BLUFF + 3 Adegan Visual + CTA Spesifik'],
        lastUpdated: new Date().toISOString(),
      };
    }
    if (!mem.learnedKnowledgeBase) mem.learnedKnowledgeBase = [];
    if (!mem.viralHookPatterns) mem.viralHookPatterns = [];
    if (!mem.categoryUsage) mem.categoryUsage = {};
    if (!mem.formulas) mem.formulas = [];
    systemMemory = mem;
    return mem;
  } catch (err) {
    logger.warn('[System Memory] Unable to load systemMemory from DB on startup, using default fallback:', err);
    return systemMemory;
  }
}

export async function saveSystemMemoryAsync() {
  try {
    systemMemory.lastUpdated = new Date().toISOString();
    await dbSaveSystemMemory(systemMemory);
    await dispatchRealtimeBroadcast('system_memory_updated', systemMemory);
    isMemoryDirty = false;
  } catch (e) {
    logger.warn('[System Memory] Failed to save memory to DB:', e);
  }
}

export function saveSystemMemory(forceImmediate = false) {
  isMemoryDirty = true;
  if (forceImmediate) {
    if (memorySaveTimer) clearTimeout(memorySaveTimer);
    memorySaveTimer = null;
    saveSystemMemoryAsync().catch((err) => logger.warn('[System Memory Force Save Error]', err));
    return;
  }
  if (!memorySaveTimer) {
    memorySaveTimer = setTimeout(() => {
      memorySaveTimer = null;
      if (isMemoryDirty) {
        saveSystemMemoryAsync().catch((err) => logger.warn('[System Memory Debounced Save Error]', err));
      }
    }, 30000);
  }
}

export function recordExecutionAndUpgrade(type: 'videoPrompt' | 'contentIdeas' | 'photoPrompt', keyInsight?: string) {
  if (!systemMemory.categoryUsage) {
    systemMemory.categoryUsage = { videoPrompt: 0, contentIdeas: 0, photoPrompt: 0 };
  }
  if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
    systemMemory.learnedKnowledgeBase = [];
  }
  if (!Array.isArray(systemMemory.viralHookPatterns)) {
    systemMemory.viralHookPatterns = [];
  }
  if (!Array.isArray(systemMemory.formulas)) {
    systemMemory.formulas = [];
  }

  systemMemory.totalExecutions = (systemMemory.totalExecutions || 0) + 1;
  systemMemory.successfulPromptsCount = (systemMemory.successfulPromptsCount || 0) + 1;
  systemMemory.categoryUsage[type] = (systemMemory.categoryUsage[type] || 0) + 1;

  if (keyInsight && !systemMemory.learnedKnowledgeBase.includes(keyInsight)) {
    systemMemory.learnedKnowledgeBase.push(keyInsight);
  }

  saveSystemMemory(false);
}

// Auto-register upgrade handler
registerExecutionUpgradeHandler(recordExecutionAndUpgrade);

export function getSystemIntelligenceLevel() {
  if (!Array.isArray(systemMemory.learnedKnowledgeBase)) {
    systemMemory.learnedKnowledgeBase = [];
  }
  if (!Array.isArray(systemMemory.viralHookPatterns)) {
    systemMemory.viralHookPatterns = [];
  }
  if (!Array.isArray(systemMemory.formulas)) {
    systemMemory.formulas = [];
  }

  const totalExecs = systemMemory.totalExecutions || 0;
  const level = Math.floor(totalExecs / 5) + 1;
  let title = 'Pengenal Algoritma Pemula';
  if (level >= 5) title = 'Analis Konten Viral Pro';
  if (level >= 10) title = 'Master TikTok Strategist & FYP Engineer';
  if (level >= 20) title = 'Algorithmic Super-Intelligence AI';
  if (level >= 50) title = 'Autonomous Supreme Content Engine';

  return {
    level,
    title,
    totalExecutions: totalExecs,
    knowledgeCount: systemMemory.learnedKnowledgeBase.length,
    formulasCount: systemMemory.formulas.length || systemMemory.learnedKnowledgeBase.length,
    learnedWisdom: systemMemory.learnedKnowledgeBase.slice(-10),
    viralHooks: systemMemory.viralHookPatterns,
  };
}

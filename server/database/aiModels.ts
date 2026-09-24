import { safeGet, safeGetOne, safeSave, safeDelete } from '@/src/db/dbService';
import { logger } from '@/server/core/utils/logger';

export interface AiModel {
  id: string;
  api_key_id: string;
  model_name: string;
  task_type: 'video_analysis' | 'prompt_generation' | 'general';
  priority: number; // 1 = highest
  status: 'active' | 'degraded' | 'disabled';
}

const COLLECTION_NAME = 'ai_models';

/**
 * Default model cascades according to specification
 */
export const DEFAULT_KEY_MODELS: Record<string, string[]> = {
  ai_key_pool_1: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash',
    'gemini-3.5-flash-lite',
  ],
  ai_key_pool_2: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-3.6-flash',
    'gemini-3.5-flash-lite',
  ],
  ai_key_pool_3: [
    'gemini-3.8-flash',
    'gemini-3.7-flash',
    'gemini-flash-lite',
  ],
};

export async function seedDefaultAiModelsIfEmpty(): Promise<AiModel[]> {
  try {
    const existing = await safeGet(COLLECTION_NAME);
    if (existing && existing.length > 0) {
      return existing as AiModel[];
    }

    const defaultModels: AiModel[] = [];

    for (const [keyId, modelList] of Object.entries(DEFAULT_KEY_MODELS)) {
      modelList.forEach((modelName, index) => {
        defaultModels.push({
          id: `model_${keyId}_${index + 1}`,
          api_key_id: keyId,
          model_name: modelName,
          task_type: 'video_analysis',
          priority: index + 1,
          status: 'active',
        });
        defaultModels.push({
          id: `model_pg_${keyId}_${index + 1}`,
          api_key_id: keyId,
          model_name: modelName,
          task_type: 'prompt_generation',
          priority: index + 1,
          status: 'active',
        });
      });
    }

    for (const model of defaultModels) {
      await safeSave(COLLECTION_NAME, model);
    }
    logger.info('[aiModels] Default AI models catalog seeded successfully.');
    return defaultModels;
  } catch (error) {
    logger.error('[aiModels] Error seeding default AI models:', error);
    return [];
  }
}

export async function getAiModels(apiKeyId?: string): Promise<AiModel[]> {
  try {
    let models = (await safeGet(COLLECTION_NAME)) as AiModel[];
    if (!models || models.length === 0) {
      models = await seedDefaultAiModelsIfEmpty();
    }
    if (apiKeyId) {
      models = models.filter((m) => m.api_key_id === apiKeyId);
    }
    return models.sort((a, b) => (a.priority || 99) - (b.priority || 99));
  } catch (err) {
    logger.error('[aiModels] Error getting AI models:', err);
    return [];
  }
}

export async function getAiModelsForTask(apiKeyId: string, taskType: string): Promise<AiModel[]> {
  const models = await getAiModels(apiKeyId);
  const matched = models.filter(
    (m) =>
      (m.task_type === taskType || m.task_type === 'general') &&
      m.status === 'active'
  );
  if (matched.length > 0) return matched;
  // If specific task type has no records, fallback to any active model for this key
  return models.filter((m) => m.status === 'active');
}

export async function createAiModel(data: Partial<AiModel>): Promise<AiModel> {
  const newModel: AiModel = {
    id: data.id || `model_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    api_key_id: data.api_key_id || 'ai_key_pool_1',
    model_name: data.model_name || 'gemini-3.8-flash',
    task_type: data.task_type || 'general',
    priority: data.priority !== undefined ? data.priority : 1,
    status: data.status || 'active',
  };
  await safeSave(COLLECTION_NAME, newModel);
  return newModel;
}

export async function updateAiModel(id: string, updates: Partial<AiModel>): Promise<AiModel | null> {
  const existing = (await safeGetOne(COLLECTION_NAME, id)) as AiModel | null;
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  await safeSave(COLLECTION_NAME, updated);
  return updated;
}

export async function deleteAiModel(id: string): Promise<boolean> {
  try {
    await safeDelete(COLLECTION_NAME, id);
    return true;
  } catch (err) {
    logger.error(`[aiModels] Error deleting model ${id}:`, err);
    return false;
  }
}

import { Request, Response } from 'express';
import {
  extractClientAccessCode,
  activeGenerationsMap,
  broadcastLiveEvent,
} from '@/server/core/state/serverState';
import {
  runOrchestrateService,
  generateAEOService,
  runAllAgentsBenchmarkService,
} from './service';
import { logger } from '@/server/core/utils/logger';

export async function orchestrateController(req: Request, res: Response) {
  try {
    const { event, contentText } = req.body || {};
    const { mockEvent, result } = await runOrchestrateService(event, contentText);

    if (mockEvent.id && activeGenerationsMap.has(mockEvent.id)) {
      const item = activeGenerationsMap.get(mockEvent.id);
      item.status = 'completed';
      item.orchestrationResult = result;
      item.updatedAt = Date.now();
      activeGenerationsMap.set(mockEvent.id, item);
    }

    broadcastLiveEvent({
      type: 'agent_orchestrated',
      eventId: mockEvent.id,
      result,
      activeGenerations: Array.from(activeGenerationsMap.values()),
    });

    return res.json({
      success: true,
      pipeline: {
        orchestratorTier: 'Tier 2 (gemini-3.6-flash)',
        subAgents: ['Metadata + Caption SEO', 'Overlay + Voice-over SEO', 'Query / Trend Agent'],
        auditor: 'Relevance Auditor (Visual vs Caption vs Audio)',
        systemMemoryUpdated: result.systemMemoryInjected,
      },
      result,
    });
  } catch (e: any) {
    logger.warn('[Server Orchestrator] Execution notice:', e);
    return res.status(500).json({
      success: false,
      error: e.message || 'Gagal menjalankan Orchestrator Pipeline',
    });
  }
}

export async function aeoGenerateController(req: Request, res: Response) {
  try {
    const { topic, category = 'umum', model } = req.body;
    if (!topic) {
      return res.status(400).json({ error: 'Topik konten diperlukan' });
    }

    const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;
    const clientAccessCode = extractClientAccessCode(req);

    const result = await generateAEOService({
      topic,
      category,
      customApiKey,
      clientAccessCode,
      model,
    });

    return res.json(result);
  } catch (e: any) {
    logger.error('[AEO Generate Error]', e);
    const statusCode = e.statusCode || 500;
    return res.status(statusCode).json({ error: e.message || 'Gagal memproses AEO Pipeline' });
  }
}

export async function runAllAgentsController(req: Request, res: Response) {
  try {
    const results = await runAllAgentsBenchmarkService();
    return res.json(results);
  } catch (e: any) {
    logger.error('[Agents Run All Error]', e);
    return res.status(500).json({ error: e.message || 'Gagal menjalankan seluruh agen' });
  }
}

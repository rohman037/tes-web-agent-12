import { Request, Response } from 'express';
import { handleApiError } from '@/server/core/utils/errorHandler';
import {
  getSystemMemoryService,
  getGrowthStateService,
  evaluateGrowthService,
  rollbackGrowthService,
  toggleAutoModeService,
  getAiAgentsService,
  updateAiAgentsService,
  toggleAgentStatusService,
  getLearningQueueService,
} from './service';

export async function getSystemMemoryController(req: Request, res: Response) {
  try {
    const mem = await getSystemMemoryService();
    return res.json(mem);
  } catch (e: any) {
    return res.status(500).json({ error: e.message || 'Gagal mengambil memory' });
  }
}

export async function getGrowthStateController(req: Request, res: Response) {
  try {
    const state = await getGrowthStateService();
    return res.json(state);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function evaluateGrowthController(req: Request, res: Response) {
  try {
    const { result, growthState } = await evaluateGrowthService();
    return res.json({ success: true, result, growthState });
  } catch (e: any) {
    return handleApiError(res, e);
  }
}

export async function rollbackGrowthController(req: Request, res: Response) {
  try {
    const { targetVersion } = req.body;
    const newState = await rollbackGrowthService(targetVersion);
    return res.json({ success: true, growthState: newState });
  } catch (e: any) {
    return handleApiError(res, e);
  }
}

export async function toggleAutoModeController(req: Request, res: Response) {
  try {
    const { enabled } = req.body;
    const newState = await toggleAutoModeService(Boolean(enabled));
    return res.json({ success: true, growthState: newState });
  } catch (e: any) {
    return handleApiError(res, e);
  }
}

export async function getAiAgentsController(req: Request, res: Response) {
  try {
    const agents = await getAiAgentsService();
    return res.json(agents);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updateAiAgentsController(req: Request, res: Response) {
  try {
    const rawAgents = Array.isArray(req.body) ? req.body : (req.body?.agents || []);
    const agents = await updateAiAgentsService(rawAgents);
    return res.json({ success: true, agents });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function toggleAgentStatusController(req: Request, res: Response) {
  try {
    const { id } = req.params;
    const result = await toggleAgentStatusService(id);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getLearningQueueController(req: Request, res: Response) {
  try {
    const queue = await getLearningQueueService();
    return res.json(queue);
  } catch (err) {
    return handleApiError(res, err);
  }
}

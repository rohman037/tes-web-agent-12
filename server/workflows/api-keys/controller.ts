import { Request, Response } from 'express';
import { handleApiError } from '@/server/core/utils/errorHandler';
import {
  getApiKeysService,
  updateApiKeysService,
  getApiKeyLogsService,
  addApiKeyLogService,
  getModelPrioritiesService,
  updateModelPrioritiesService,
  getLlmGatewayMetricsService,
  getLlmGatewayHealthService,
  testGeminiKeyService,
  pollAllApiKeysService,
  getQuotaSummaryService,
} from './service';


export async function getApiKeysController(req: Request, res: Response) {
  try {
    const keys = await getApiKeysService();
    return res.json(keys);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updateApiKeysController(req: Request, res: Response) {
  try {
    const rawKeys = Array.isArray(req.body) ? req.body : (req.body?.keys || []);
    const keys = await updateApiKeysService(rawKeys);
    return res.json({ success: true, keys, count: keys.length });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getApiKeyLogsController(req: Request, res: Response) {
  try {
    const logs = await getApiKeyLogsService();
    return res.json(logs);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function addApiKeyLogController(req: Request, res: Response) {
  try {
    const log = await addApiKeyLogService(req.body);
    return res.json({ success: true, log });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getModelPrioritiesController(req: Request, res: Response) {
  try {
    const priorities = await getModelPrioritiesService();
    return res.json(priorities);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updateModelPrioritiesController(req: Request, res: Response) {
  try {
    const priorities = await updateModelPrioritiesService(req.body);
    return res.json({ success: true, priorities });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export function getLlmGatewayMetricsController(req: Request, res: Response) {
  try {
    const metrics = getLlmGatewayMetricsService();
    return res.json({ success: true, metrics });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export function getLlmGatewayHealthController(req: Request, res: Response) {
  try {
    const health = getLlmGatewayHealthService();
    return res.json({ success: true, ...health });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function testGeminiKeyController(req: Request, res: Response) {
  try {
    const { apiKey, keyId } = req.body;
    const result = await testGeminiKeyService(apiKey, keyId);
    return res.json(result);
  } catch (err: any) {
    return res.json({ success: false, error: err?.message || 'Key invalid atau rate limit' });
  }
}

export async function pollAllApiKeysController(req: Request, res: Response) {
  try {
    const keys = req.body?.keys;
    const result = await pollAllApiKeysService(keys);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ success: false, error: err?.message || 'Gagal melakukan polling pool API Key' });
  }
}

export async function getQuotaSummaryController(req: Request, res: Response) {
  try {
    const summary = await getQuotaSummaryService();
    return res.json(summary);
  } catch (err: any) {
    return handleApiError(res, err);
  }
}


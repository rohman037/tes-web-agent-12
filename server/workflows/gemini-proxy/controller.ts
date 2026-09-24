import { Request, Response } from 'express';
import { extractClientAccessCode } from '@/server/core/state/serverState';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { logger } from '@/server/core/utils/logger';

export async function geminiGenerateController(req: Request, res: Response) {
  const startTime = Date.now();
  try {
    const {
      contents,
      model = 'gemini-3.8-flash',
      systemInstruction,
      responseMimeType,
      enableSearchGrounding,
      enableHighThinking,
      temperature,
      endpointName = '/api/gemini/generate',
      toolName = 'Gemini Secure Proxy',
    } = req.body || {};

    if (!contents) {
      return res.status(400).json({ success: false, error: 'Parameter "contents" diperlukan.' });
    }

    const clientAccessCode = extractClientAccessCode(req) || req.body.clientAccessCode;
    const customApiKey = (req.headers['x-custom-api-key'] as string) || req.body.customApiKey;

    const normalizedModel = normalizeGeminiModel(model);

    const requestConfig: any = {};
    if (systemInstruction) {
      requestConfig.systemInstruction = systemInstruction;
    }
    if (responseMimeType) {
      requestConfig.responseMimeType = responseMimeType;
    }
    if (typeof temperature === 'number') {
      requestConfig.temperature = temperature;
    }
    if (enableHighThinking && (normalizedModel.includes('pro') || normalizedModel.includes('3.1'))) {
      requestConfig.thinkingConfig = { thinkingLevel: 'HIGH' };
    }
    if (enableSearchGrounding) {
      requestConfig.tools = [{ googleSearch: {} }];
    }

    const proxyTargetTier = (req.body?.targetTier as 'flagship' | 'tier2' | 'tier3' | 'user_key') || 'tier2';
    const proxyToolName = toolName || 'Gemini Secure Proxy';

    const result = await callGeminiWithFallback(
      normalizedModel,
      {
        contents,
        config: requestConfig,
      },
      customApiKey,
      clientAccessCode,
      proxyTargetTier,
      proxyToolName
    );

    return res.json({
      success: true,
      text: result.text,
      modelUsed: result.modelUsed,
      tierUsed: result.tierUsed,
      latencyMs: result.latencyMs || (Date.now() - startTime),
    });
  } catch (error: any) {
    logger.error('Gemini proxy error:', error);
    const statusCode = error?.status || error?.statusCode || 500;
    return res.status(statusCode >= 400 && statusCode < 600 ? statusCode : 500).json({
      success: false,
      error: error.message || 'Gagal memproses permintaan AI Gemini.',
    });
  }
}

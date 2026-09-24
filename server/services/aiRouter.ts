import { GoogleGenAI } from '@google/genai';
import { logger } from '@/server/core/utils/logger';
import { getAvailableApiKeys, resolveRawKey, handleKeyRateLimited, handleKeyDisabled, handleKeySuccess } from './apiKeyPool';
import { getModelsForApiKeyAndTask } from './modelSelector';
import { recordAiUsageLog } from '@/server/database/aiUsageLogs';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { withLlmSpan } from '@/server/core/observability/tracing';
import { captureLlmError } from '@/server/core/observability/sentry';

export interface AiTaskRequest {
  taskType:
    | 'viral_product_analysis'
    | 'adaptation_script_generation'
    | 'video_prompt_seo_generation'
    | 'video_analysis'
    | 'prompt_generation'
    | 'general'
    | string;
  contents: any;
  config?: any;
  preferredModel?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  timeoutMs?: number;
}

export interface AiTaskResponse {
  text: string;
  modelUsed: string;
  apiKeyIdUsed: string;
  latencyMs: number;
  retries: number;
}

const clientCache = new Map<string, GoogleGenAI>();

function getGenAIClient(apiKey: string): GoogleGenAI {
  let client = clientCache.get(apiKey);
  if (!client) {
    client = new GoogleGenAI({ apiKey });
    clientCache.set(apiKey, client);
  }
  return client;
}

/**
 * Execute AI Task with complete Multi-Key & Multi-Model Auto Fallback
 */
export async function executeAiTask(req: AiTaskRequest): Promise<AiTaskResponse> {
  const rawPrompt = typeof req.contents === 'string' ? req.contents : JSON.stringify(req.contents || '');
  return withLlmSpan(
    `llm.${req.taskType || 'task'}`,
    {
      provider: 'google-gemini',
      model: req.preferredModel || 'gemini-2.5-flash',
      workflowName: `workflow_${req.taskType || 'general'}`,
      rawPrompt,
    },
    async () => {
      const startTime = Date.now();
      const { taskType, contents, config = {}, preferredModel, customApiKey, clientAccessCode, timeoutMs = 60000 } = req;

  // PRIORITY 1: Execute via the battle-tested LLM Gateway with instant fast-failover across all tiers and keys
  try {
    const gatewayRes = await callGeminiWithFallback(
      preferredModel,
      { contents, config },
      customApiKey,
      clientAccessCode,
      'tier2',
      `video_${taskType}`,
      Boolean(preferredModel)
    );

    const latencyMs = gatewayRes.latencyMs || (Date.now() - startTime);

    await recordAiUsageLog({
      api_key_id: gatewayRes.keyMasked || 'llm_gateway_pool',
      model_name: gatewayRes.modelUsed,
      task_type: taskType,
      status: 'success',
      http_status: 200,
      latency_ms: latencyMs,
    });

    return {
      text: gatewayRes.text,
      modelUsed: gatewayRes.modelUsed,
      apiKeyIdUsed: gatewayRes.keyMasked || 'llm_gateway_pool',
      latencyMs,
      retries: 0,
    };
  } catch (gatewayErr: any) {
    logger.warn(`[aiRouter] Gateway primary pass returned warning: ${gatewayErr?.message}. Falling back to internal direct pool...`);
  }

  // If user provided custom API Key, try that first
  const keysToTry = await getAvailableApiKeys();

  if (customApiKey && customApiKey.trim().length > 10) {
    keysToTry.unshift({
      id: 'custom_user_key',
      provider: 'gemini',
      encrypted_key: customApiKey.trim(),
      status: 'active',
      priority: 0,
      rpm_limit: 60,
      tpm_limit: 1000000,
      daily_limit: 1500,
      usage_count: 0,
      error_count: 0,
      last_used: new Date().toISOString(),
      created_at: new Date().toISOString(),
      alias: 'User Custom Key',
    });
  }

  if (keysToTry.length === 0) {
    // If no keys available, fallback to process.env.GEMINI_API_KEY
    keysToTry.push({
      id: 'env_fallback_key',
      provider: 'gemini',
      encrypted_key: process.env.GEMINI_API_KEY || '',
      status: 'active',
      priority: 99,
      rpm_limit: 60,
      tpm_limit: 1000000,
      daily_limit: 1500,
      usage_count: 0,
      error_count: 0,
      last_used: new Date().toISOString(),
      created_at: new Date().toISOString(),
      alias: 'System Environment Key',
    });
  }

  let totalRetries = 0;
  let lastError: any = null;

  // STEP: Iterate through API KEY POOL (API KEY 1 -> API KEY 2 -> API KEY 3 ...)
  for (let keyIdx = 0; keyIdx < keysToTry.length; keyIdx++) {
    const currentKeyObj = keysToTry[keyIdx];
    const rawKey = resolveRawKey(currentKeyObj);

    if (!rawKey) {
      continue;
    }

    const aiClient = getGenAIClient(rawKey);

    // Get models catalog for this key and taskType
    const candidateModels = await getModelsForApiKeyAndTask(currentKeyObj.id, taskType);

    // If preferred model is given, try it first
    let modelSequence = [...candidateModels];
    if (preferredModel && !modelSequence.includes(preferredModel)) {
      modelSequence.unshift(preferredModel);
    } else if (preferredModel) {
      modelSequence = [preferredModel, ...modelSequence.filter((m) => m !== preferredModel)];
    }

    logger.info(
      `[aiRouter] Routing task "${taskType}" to Key #${keyIdx + 1} (${currentKeyObj.alias || currentKeyObj.id}) with models: [${modelSequence.join(', ')}]`
    );

    // STEP: Try models in sequence for this key (e.g. 3.8 Flash -> 3.7 Flash -> 3.6 Flash...)
    for (let mIdx = 0; mIdx < modelSequence.length; mIdx++) {
      const targetModel = modelSequence[mIdx];
      const modelStartTime = Date.now();

      // Retry loop for 500 errors (up to 2 attempts per model)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          logger.info(`[aiRouter] Attempting model: ${targetModel} on Key ${currentKeyObj.id} (Attempt ${attempt}/2)...`);

          const generatePromise = aiClient.models.generateContent({
            model: targetModel,
            contents: contents,
            config: config,
          });

          // Timeout promise protection
          const timeoutPromise = new Promise<never>((_, reject) => {
            const timer = setTimeout(() => {
              reject(new Error(`LLM_TIMEOUT: Model ${targetModel} exceeded timeout of ${timeoutMs}ms`));
            }, timeoutMs);
            generatePromise.then(() => clearTimeout(timer), () => clearTimeout(timer));
          });

          const response = await Promise.race([generatePromise, timeoutPromise]);
          const responseText = response.text || '';

          if (!responseText) {
            throw new Error(`Empty response returned from model ${targetModel}`);
          }

          const latencyMs = Date.now() - modelStartTime;

          // Success: Record usage and reset key errors
          await handleKeySuccess(currentKeyObj.id);
          await recordAiUsageLog({
            api_key_id: currentKeyObj.id,
            model_name: targetModel,
            task_type: taskType,
            status: 'success',
            http_status: 200,
            latency_ms: latencyMs,
          });

          logger.info(
            `[aiRouter] Task "${taskType}" SUCCEEDED via ${targetModel} on Key ${currentKeyObj.id} in ${latencyMs}ms`
          );

          return {
            text: responseText,
            modelUsed: targetModel,
            apiKeyIdUsed: currentKeyObj.id,
            latencyMs,
            retries: totalRetries,
          };
        } catch (err: any) {
          totalRetries++;
          lastError = err;
          const errMsg = err?.message || String(err);
          const rawStatus = (err as any)?.status || (err as any)?.statusCode;

          // BUG FIX 6: Detailed and distinct error classification rather than blindly defaulting to 500
          let statusCode: number | 'UNKNOWN' = 'UNKNOWN';
          if (typeof rawStatus === 'number') {
            statusCode = rawStatus;
          } else if (errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota') || errMsg.includes('limit: 0')) {
            statusCode = 429;
          } else if (errMsg.includes('401') || errMsg.includes('API_KEY_INVALID') || errMsg.includes('UNAUTHENTICATED')) {
            statusCode = 401;
          } else if (errMsg.includes('403') || errMsg.includes('PERMISSION_DENIED')) {
            statusCode = 403;
          } else if (errMsg.includes('404') || errMsg.includes('NOT_FOUND') || errMsg.includes('not found')) {
            statusCode = 404;
          } else if (errMsg.includes('503') || errMsg.includes('UNAVAILABLE') || errMsg.includes('high demand') || errMsg.includes('overloaded')) {
            statusCode = 503;
          } else if (errMsg.includes('500') || errMsg.includes('Internal error')) {
            statusCode = 500;
          }

          // Full, non-obfuscated diagnostic logging for post-mortem analysis
          logger.warn(
            `[aiRouter] Error with model ${targetModel} on Key ${currentKeyObj.id} (Status: ${statusCode}): "${errMsg}". Full error:`,
            err
          );

          // 401/403 Unauthorized -> Disable API Key permanently and break to next key
          if (statusCode === 401 || statusCode === 403 || errMsg.includes('API_KEY_INVALID') || errMsg.includes('PERMISSION_DENIED')) {
            await handleKeyDisabled(currentKeyObj.id, errMsg);
            await recordAiUsageLog({
              api_key_id: currentKeyObj.id,
              model_name: targetModel,
              task_type: taskType,
              status: 'error',
              http_status: typeof statusCode === 'number' ? statusCode : 401,
              error_message: errMsg,
            });
            break; // Skip rest of models on this invalid key
          }

          // 429 Rate Limit / Quota Exceeded -> Fallback to next model
          if (statusCode === 429 || errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED') || errMsg.includes('quota')) {
            await recordAiUsageLog({
              api_key_id: currentKeyObj.id,
              model_name: targetModel,
              task_type: taskType,
              status: 'rate_limited',
              http_status: 429,
              error_message: errMsg,
            });

            // If this is the last model on this key, mark key rate limited
            if (mIdx === modelSequence.length - 1) {
              await handleKeyRateLimited(currentKeyObj.id);
            }
            break; // Switch to next model in sequence
          }

          // 503 High Demand / Unavailable -> Skip remaining attempts for this model and cascade immediately to next model in 0ms!
          if (statusCode === 503 || errMsg.includes('503') || errMsg.includes('high demand') || errMsg.includes('overloaded')) {
            logger.warn(`[aiRouter] Model ${targetModel} on Key ${currentKeyObj.id} is overloaded (503). Instantly cascading to next model in hierarchy...`);
            await recordAiUsageLog({
              api_key_id: currentKeyObj.id,
              model_name: targetModel,
              task_type: taskType,
              status: 'overloaded_503',
              http_status: 503,
              error_message: errMsg,
            });
            break; // Immediate cascade!
          }

          // 500 Internal Error -> Wait briefly with jitter on attempt 1, then switch model on attempt 2
          if (attempt === 1 && statusCode === 500) {
            logger.info(`[aiRouter] Retrying ${targetModel} once after brief backoff...`);
            await new Promise((r) => setTimeout(r, 600 + Math.random() * 400));
            continue;
          }

          // Otherwise record error log and try next model
          await recordAiUsageLog({
            api_key_id: currentKeyObj.id,
            model_name: targetModel,
            task_type: taskType,
            status: 'error',
            http_status: typeof statusCode === 'number' ? statusCode : 0,
            error_message: errMsg,
          });
          break; // Switch to next model in sequence
        }
      }
    }
  }

  const elapsedMs = Date.now() - startTime;
  logger.error(`[aiRouter] All models across all API keys failed for task "${taskType}" after ${elapsedMs}ms`);
  
  const finalError = new Error(
    `Semua model AI dan API Key di pool sedang sibuk atau mengalami kendala: ${lastError?.message || 'Gagal memproses request'}. Silakan coba beberapa saat lagi.`
  );

  captureLlmError(finalError, {
    provider: 'google-gemini',
    model: req.preferredModel || 'pool-fallback',
    workflowName: `workflow_${req.taskType || 'general'}`,
    promptHash: typeof req.contents === 'string' ? undefined : undefined,
    status: 503,
  });

  throw finalError;
    }
  );
}

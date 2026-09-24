import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';
import type { Express } from 'express';
import {
  observabilityConfig,
  sentryBeforeSendHook,
  sentryBeforeBreadcrumbHook,
  sanitizeString,
} from '../../../config/observability';
import { logger } from '../utils/logger';

let isSentryInitialized = false;

/**
 * Initializes Sentry for the Node.js / Express backend with Profiling & Performance Tracing
 */
export function initBackendSentry(app?: Express) {
  if (isSentryInitialized) return;

  const dsn = observabilityConfig.sentry.backendDsn;
  if (!dsn) {
    logger.info('[Observability] SENTRY_DSN_BACKEND not configured. Operating in zero-telemetry standby mode.');
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: observabilityConfig.sentry.environment,
      release: observabilityConfig.sentry.release,
      tracesSampleRate: observabilityConfig.sentry.tracesSampleRate,
      profilesSampleRate: observabilityConfig.sentry.profilesSampleRate,
      integrations: [
        nodeProfilingIntegration(),
      ],
      beforeSend: sentryBeforeSendHook,
      beforeBreadcrumb: sentryBeforeBreadcrumbHook,
    });

    isSentryInitialized = true;
    logger.info(`[Observability] Sentry Backend Initialized (env: ${observabilityConfig.sentry.environment}, release: ${observabilityConfig.sentry.release})`);
  } catch (err: any) {
    logger.warn('[Observability] Failed initializing backend Sentry:', err?.message || err);
  }
}

/**
 * Records key rotation events as structured breadcrumbs in Sentry
 */
export function recordKeyRotationBreadcrumb(params: {
  keyId: string;
  reason: 'rate_limited' | 'revoked' | 'fallback_tier' | 'recovered';
  details?: string;
  model?: string;
}) {
  try {
    Sentry.addBreadcrumb({
      category: 'llm.key_rotation',
      message: `API Key ${params.keyId.slice(0, 8)}... rotated: ${params.reason}`,
      level: params.reason === 'revoked' ? 'error' : 'warning',
      data: {
        keyIdPrefix: params.keyId.slice(0, 8),
        reason: params.reason,
        details: params.details ? sanitizeString(params.details) : undefined,
        model: params.model,
        timestamp: new Date().toISOString(),
      },
    });
  } catch {}
}

/**
 * Captures LLM Gateway errors with enriched contextual tags
 */
export function captureLlmError(error: any, context: {
  provider: string;
  model: string;
  workflowName: string;
  promptHash?: string;
  status?: number;
}) {
  try {
    Sentry.withScope((scope) => {
      scope.setTag('llm.provider', context.provider);
      scope.setTag('llm.model', context.model);
      scope.setTag('workflow.name', context.workflowName);
      if (context.status) scope.setTag('http.status_code', String(context.status));
      if (context.promptHash) scope.setExtra('prompt_sha256', context.promptHash);

      Sentry.captureException(error);
    });
  } catch {}
}

/**
 * Wraps background cron executions with Sentry monitoring & auto-reporting
 */
export async function wrapCronJob<T>(jobName: string, fn: () => Promise<T>): Promise<T | null> {
  const startTime = Date.now();
  try {
    logger.info(`[Cron Monitor] Executing job: ${jobName}`);
    const result = await fn();
    const duration = Date.now() - startTime;
    Sentry.addBreadcrumb({
      category: 'cron.job',
      message: `Job ${jobName} completed in ${duration}ms`,
      level: 'info',
    });
    return result;
  } catch (error: any) {
    const duration = Date.now() - startTime;
    logger.error(`[Cron Monitor] Job ${jobName} failed after ${duration}ms:`, error);
    Sentry.withScope((scope) => {
      scope.setTag('cron.job_name', jobName);
      scope.setExtra('duration_ms', duration);
      Sentry.captureException(error);
    });
    return null;
  }
}

export { Sentry };

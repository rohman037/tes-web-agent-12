import { trace, context, SpanStatusCode, Tracer } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { observabilityConfig, hashPrompt } from '../../../config/observability';
import { logger } from '../utils/logger';

let sdk: NodeSDK | null = null;
let tracer: Tracer | null = null;

/**
 * Initializes the OpenTelemetry SDK with OTLP Trace Exporter
 */
export function initOpenTelemetry() {
  if (sdk) return;

  const endpoint = observabilityConfig.otel.exporterEndpoint;

  try {
    const resource = resourceFromAttributes({
      [ATTR_SERVICE_NAME]: observabilityConfig.otel.serviceName,
      [ATTR_SERVICE_VERSION]: observabilityConfig.otel.serviceVersion,
    });

    const traceExporter = new OTLPTraceExporter({
      url: endpoint,
    });

    sdk = new NodeSDK({
      resource,
      traceExporter,
    });

    sdk.start();
    tracer = trace.getTracer(observabilityConfig.otel.serviceName, observabilityConfig.otel.serviceVersion);
    logger.info(`[Observability] OpenTelemetry SDK initialized (endpoint: ${endpoint})`);
  } catch (err: any) {
    logger.warn('[Observability] OpenTelemetry initialization note:', err?.message || err);
    tracer = trace.getTracer('creator-ai-workspace-backend-fallback');
  }
}

export function getTracer(): Tracer {
  if (!tracer) {
    tracer = trace.getTracer('creator-ai-workspace-backend');
  }
  return tracer;
}

export interface LlmSpanAttributes {
  provider?: string;
  model: string;
  workflowName: string;
  rawPrompt?: string;
  promptHash?: string;
}

/**
 * Wraps an LLM call inside an OpenTelemetry Span with latency, token estimation & cost calculation
 */
export async function withLlmSpan<T>(
  spanName: string,
  attrs: LlmSpanAttributes,
  fn: () => Promise<T>
): Promise<T> {
  const currentTracer = getTracer();
  const span = currentTracer.startSpan(spanName);

  const promptHash = attrs.promptHash || (attrs.rawPrompt ? hashPrompt(attrs.rawPrompt) : 'empty_prompt');
  const startTime = Date.now();

  span.setAttribute('llm.provider', attrs.provider || 'google-gemini');
  span.setAttribute('llm.model', attrs.model);
  span.setAttribute('llm.prompt_hash', promptHash);
  span.setAttribute('workflow.name', attrs.workflowName);

  try {
    const result = await fn();
    const latencyMs = Date.now() - startTime;
    span.setAttribute('llm.latency_ms', latencyMs);

    // Approximate token counts and cost for Gemini Flash / Pro models
    const estimatedPromptTokens = attrs.rawPrompt ? Math.ceil(attrs.rawPrompt.length / 4) : 100;
    const estimatedCompletionTokens = 300;
    const estimatedCostUsd = (estimatedPromptTokens * 0.000000075) + (estimatedCompletionTokens * 0.0000003);

    span.setAttribute('llm.tokens.prompt', estimatedPromptTokens);
    span.setAttribute('llm.tokens.completion', estimatedCompletionTokens);
    span.setAttribute('llm.estimated_cost_usd', Number(estimatedCostUsd.toFixed(6)));
    span.setStatus({ code: SpanStatusCode.OK });

    return result;
  } catch (error: any) {
    const latencyMs = Date.now() - startTime;
    span.setAttribute('llm.latency_ms', latencyMs);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error?.message || 'LLM execution failed',
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Traces Firestore queries and logs slow queries (>500ms) as warning telemetry
 */
export async function withFirestoreSpan<T>(
  operation: 'get' | 'save' | 'delete' | 'query',
  collection: string,
  fn: () => Promise<T>
): Promise<T> {
  const currentTracer = getTracer();
  const span = currentTracer.startSpan(`firestore.${operation}`);
  const startTime = Date.now();

  span.setAttribute('db.system', 'firestore');
  span.setAttribute('db.operation', operation);
  span.setAttribute('db.collection', collection);

  try {
    const result = await fn();
    const durationMs = Date.now() - startTime;
    span.setAttribute('db.duration_ms', durationMs);

    if (durationMs > 500) {
      logger.warn(`[Firestore Performance] Slow query detected on '${collection}' (${operation}): ${durationMs}ms`);
      span.setAttribute('db.slow_query', true);
    }

    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error: any) {
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: error?.message || 'Firestore operation failed',
    });
    span.recordException(error);
    throw error;
  } finally {
    span.end();
  }
}

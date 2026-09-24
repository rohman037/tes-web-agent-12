import { describe, it, expect, vi } from 'vitest';
import {
  sanitizeString,
  sanitizeObject,
  hashPrompt,
  sentryBeforeSendHook,
  sentryBeforeBreadcrumbHook,
} from '../../config/observability';
import { withLlmSpan, withFirestoreSpan } from '../../server/core/observability/tracing';
import { recordKeyRotationBreadcrumb, captureLlmError, wrapCronJob } from '../../server/core/observability/sentry';

describe('Observability & Privacy Compliance Unit Tests', () => {
  describe('Privacy Sanitizer & Redactor', () => {
    it('should mask Google and OpenAI API Keys with regex replace', () => {
      const geminiKey = 'AIzaSyDb123456789012345678901234567890';
      const masked = sanitizeString(`Error connecting with key: ${geminiKey}`);
      expect(masked).not.toContain(geminiKey);
      expect(masked).toContain('AIza...[MASKED_KEY]');
    });

    it('should redact sensitive user emails and phone numbers', () => {
      const rawText = 'Contact user john.doe@agency.com at 081234567890 for billing';
      const sanitized = sanitizeString(rawText);
      expect(sanitized).toContain('[REDACTED_EMAIL]');
      expect(sanitized).toContain('[REDACTED_PHONE]');
      expect(sanitized).not.toContain('john.doe@agency.com');
      expect(sanitized).not.toContain('081234567890');
    });

    it('should deeply redact sensitive object fields (passwords, tokens, raw prompts)', () => {
      const sensitivePayload = {
        user: {
          name: 'Budi Santoso',
          email: 'budi@gmail.com',
          password: 'superSecretPassword123!',
        },
        rawPrompt: 'Generate a script for secret product launch',
        apiKey: 'AIzaSyAABBCCDDEEFFGG123456789012345678',
      };

      const sanitized = sanitizeObject(sensitivePayload);
      expect(sanitized.user.password).toBe('[REDACTED_SECRET]');
      expect(sanitized.rawPrompt).toBe('[REDACTED_SECRET]');
      expect(sanitized.apiKey).toBe('[REDACTED_SECRET]');
      expect(sanitized.user.email).toBe('[REDACTED_EMAIL]');
    });

    it('should generate deterministic 64-character SHA-256 hash for raw prompts', () => {
      const prompt = 'Prompt ide konten tiktok viral 2026';
      const hash1 = hashPrompt(prompt);
      const hash2 = hashPrompt(prompt);

      expect(hash1).toBe(hash2);
      expect(hash1).toHaveLength(64);
      expect(hashPrompt('')).toBe('empty_prompt');
    });
  });

  describe('Sentry Privacy Hooks', () => {
    it('should clean headers and user context in sentryBeforeSendHook', () => {
      const mockEvent = {
        request: {
          headers: {
            authorization: 'Bearer secret_token',
            cookie: 'session=12345',
            'x-client-access-code': 'SATSET-999',
            'content-type': 'application/json',
          },
          data: {
            apiKey: 'AIzaSySecretKey1234567890123456789012',
          },
        },
        user: {
          id: 'user_123',
          email: 'admin@studio.com',
        },
      };

      const processed = sentryBeforeSendHook(mockEvent);
      expect(processed.request.headers.authorization).toBeUndefined();
      expect(processed.request.headers.cookie).toBeUndefined();
      expect(processed.request.headers['x-client-access-code']).toBeUndefined();
      expect(processed.request.headers['content-type']).toBe('application/json');
      expect(processed.user.email).toBeUndefined();
    });

    it('should sanitize console messages in sentryBeforeBreadcrumbHook', () => {
      const breadcrumb = {
        category: 'console',
        message: 'Loaded user budi@example.com with key AIzaSyTestKey12345678901234567890123',
      };

      const result = sentryBeforeBreadcrumbHook(breadcrumb);
      expect(result.message).toContain('[REDACTED_EMAIL]');
      expect(result.message).toContain('AIza...[MASKED_KEY]');
    });
  });

  describe('Telemetry Execution Wrappers', () => {
    it('should execute withLlmSpan and record metadata', async () => {
      const result = await withLlmSpan(
        'llm.test_task',
        {
          model: 'gemini-2.5-flash',
          workflowName: 'workflow_test',
          rawPrompt: 'Test prompt data',
        },
        async () => {
          return { generated: 'Viral script output' };
        }
      );

      expect(result.generated).toBe('Viral script output');
    });

    it('should execute withFirestoreSpan without altering return value', async () => {
      const data = await withFirestoreSpan('get', 'clients', async () => {
        return [{ id: 'cli_1', name: 'Client 1' }];
      });

      expect(data).toHaveLength(1);
      expect(data[0].id).toBe('cli_1');
    });

    it('should wrap cron jobs cleanly without throwing unhandled exceptions', async () => {
      const executed = await wrapCronJob('test_cleanup_job', async () => {
        return 42;
      });

      expect(executed).toBe(42);
    });

    it('should catch and isolate failing cron jobs without crashing caller', async () => {
      const result = await wrapCronJob('failing_cron_job', async () => {
        throw new Error('Simulated cron database timeout');
      });

      expect(result).toBeNull();
    });

    it('should record key rotation breadcrumbs and LLM errors safely', () => {
      expect(() => {
        recordKeyRotationBreadcrumb({
          keyId: 'key_abc_123',
          reason: 'rate_limited',
          details: '429 Resource Exhausted',
        });

        captureLlmError(new Error('LLM Quota Exceeded'), {
          provider: 'google-gemini',
          model: 'gemini-2.5-flash',
          workflowName: 'workflow_content_ideas',
          status: 429,
        });
      }).not.toThrow();
    });
  });
});

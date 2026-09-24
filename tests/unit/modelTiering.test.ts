import { describe, it, expect } from 'vitest';
import { getFallbackChainForTask, validateModelName } from '../../config/modelTiering';

describe('Model Tiering & Guardrails Unit Tests', () => {
  it('should return correct fallback chains for tasks', () => {
    const valChain = getFallbackChainForTask('validation');
    expect(valChain).toContain('flash-lite-3.5');

    const draftChain = getFallbackChainForTask('draft');
    expect(draftChain).toContain('gemma-4-26b');

    const finalChain = getFallbackChainForTask('generate-final');
    expect(finalChain[0]).toBe('gemini-3.8-flash');
  });

  it('should enforce hard guardrails against forbidden models (Veo / Nano Banana)', () => {
    expect(() => validateModelName('veo-3-cinematic')).toThrowError(/Hard Guardrail Violation/);
    expect(() => validateModelName('nano-banana-v1')).toThrowError(/Hard Guardrail Violation/);
    expect(() => validateModelName('gemini-3.8-flash')).not.toThrow();
  });
});

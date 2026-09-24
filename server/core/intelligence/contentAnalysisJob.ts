import { GenerationEvent } from '@/src/events/generationEvent';

/**
 * Background Content Analysis & Multi-Agent Orchestration Job:
 * Triggered asynchronously after generation_event.
 * Delegates to the secure backend orchestrator endpoint (/api/orchestrate).
 */
export async function runContentAnalysisJob(
  event: GenerationEvent,
  generatedContentText?: string
): Promise<void> {
  setTimeout(async () => {
    try {
      const textToAnalyze = generatedContentText || event.category || '';
      await fetch('/api/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event,
          contentText: textToAnalyze,
        }),
      });
    } catch (e) {
      console.warn('[ContentAnalysisJob] Background orchestration notification:', e);
    }
  }, 100);
}

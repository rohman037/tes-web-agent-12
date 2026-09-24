import { runOrchestratorPipeline } from '@/server/core/intelligence/orchestratorAgent';
import { buildAEOPipelinePrompt, AEOPipelineResult } from '@/server/core/intelligence/aeoAgentPipeline';
import { governAEOPipelineExecution } from '@/server/core/intelligence/agentAeoPipelineGovernor';
import { monitorAndValidateIngestion } from '@/server/core/intelligence/agentIngestionMonitor';
import { extractMultiModalSignals } from '@/server/core/intelligence/agentSignalExtractor';
import { calculateMultimodalFusionScore } from '@/server/core/intelligence/agentMultimodalFusion';
import { classifyContentCategory } from '@/server/core/intelligence/agentCategoryClassifier';
import { proposeNewCategoryTaxonomy } from '@/server/core/intelligence/agentTaxonomyProposer';
import { updateHookPatternSystemMemory } from '@/server/core/intelligence/agentHookPatternUpdater';
import { superviseMetaAutoBuild } from '@/server/core/intelligence/agentMetaAutoBuildSupervisor';
import { auditPaymentAndClientHardening } from '@/server/core/intelligence/agentPaymentClientHardeningAuditor';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { sanitizeCaptionsAndHashtags } from '@/server/core/utils/sanitizer';
import { logger } from '@/server/core/utils/logger';

export async function runOrchestrateService(event: any, contentText?: string) {
  const mockEvent = event || {
    id: `evt_api_${Date.now()}`,
    timestamp: new Date().toISOString(),
    clientId: 'client_api',
    accessCode: 'API-REQUEST',
    packageTier: 'PRO',
    tool: 'idea_konten',
    category: 'umum',
    modelUsed: 'gemini-3.6-flash',
    tierUsed: 'Tier 2 (Server Key)',
    isUserApiKey: false,
    outcome: 'success',
  };

  const result = await runOrchestratorPipeline(mockEvent, contentText || '');
  return { mockEvent, result };
}

export async function generateAEOService(options: {
  topic: string;
  category?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  model?: string;
}) {
  const { topic, category = 'umum', customApiKey, clientAccessCode, model } = options;

  if (!topic) {
    throw new Error('Topik konten diperlukan');
  }

  const aeoPrompt = buildAEOPipelinePrompt(topic, category);
  const requestedModel = model ? normalizeGeminiModel(model) : undefined;

  const geminiResult = await callGeminiWithFallback(
    requestedModel,
    {
      contents: [{ parts: [{ text: aeoPrompt }] }],
    },
    customApiKey,
    clientAccessCode,
    'tier2',
    'AEO Pipeline'
  );

  const responseText = geminiResult.text || '';

  let rawResult: AEOPipelineResult | undefined;
  try {
    const jsonMatch = responseText.match(/```json\n([\s\S]*?)\n```/) || responseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      rawResult = JSON.parse(jsonMatch[1] || jsonMatch[0]);
    }
  } catch (e) {
    logger.warn('[AEO Parse Warning] Output is not valid JSON, returning formatted markdown text');
  }

  const governorResult = await governAEOPipelineExecution(topic, rawResult);
  const cleanResponseText = sanitizeCaptionsAndHashtags(responseText);

  return {
    success: true,
    topic,
    category,
    governor: governorResult,
    rawResult,
    responseText: cleanResponseText,
  };
}

export async function runAllAgentsBenchmarkService() {
  const ingestion = await monitorAndValidateIngestion('https://www.tiktok.com/@sample/video/123456');
  const signals = await extractMultiModalSignals({ caption: 'Rekomendasi baju murah berkualitas #fashion #fyp #viral' });
  const fusion = await calculateMultimodalFusionScore(signals);
  const category = await classifyContentCategory('Fashion & Aksesoris wanita murah');
  const proposal = await proposeNewCategoryTaxonomy('Konten niche baru herbal alami', 55);
  const hookUpdate = await updateHookPatternSystemMemory('Rahasia besar yang disembunyikan toko sebelah!', 'fashion');
  const supervisor = await superviseMetaAutoBuild(23, false);
  const audit = await auditPaymentAndClientHardening();

  return {
    success: true,
    timestamp: new Date().toISOString(),
    agentsRun: 10,
    results: {
      ingestion,
      signals,
      fusion,
      category,
      proposal,
      hookUpdate,
      supervisor,
      audit,
    },
  };
}

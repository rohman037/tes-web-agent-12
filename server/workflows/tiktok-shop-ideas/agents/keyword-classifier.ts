import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';
import { buildKeywordClassifierPrompt } from '../prompts/keyword-intent';
import { KeywordClassifierInput, KeywordClassifierOutput, KeywordSeed, IdeaHookAssignment } from '../types';

const fallbackHookTypes: ('Result-first' | 'Pain-point' | 'Suspense-thinking' | 'Conflict-contrast')[] = [
  'Result-first',
  'Pain-point',
  'Suspense-thinking',
  'Conflict-contrast',
  'Result-first',
];

export async function classifyKeywordIntent(input: KeywordClassifierInput | any): Promise<KeywordClassifierOutput> {
  const derivedProductName = input.derivedProductName || input.enrichedProductName || 'Produk TikTok Shop';
  const productDetails = input.productDetails || '';
  const enrichedInfo = typeof input.enrichedInfo === 'string' ? input.enrichedInfo : (input.enrichedInfo?.enrichedInfo || '');
  const totalIdeas = input.totalIdeas || 5;
  const model = input.model;
  const customApiKey = input.customApiKey;
  const clientAccessCode = input.clientAccessCode;

  let classifiedKeywords: KeywordSeed[] = [];
  let ideasHookAssignments: IdeaHookAssignment[] = [];

  try {
    logger.info('[keyword-classifier] Classifying keyword intent & hook assignments | tier=tier3');
    const prompt = buildKeywordClassifierPrompt(derivedProductName, productDetails, enrichedInfo, totalIdeas);
    const keywordPayload = {
      contents: {
        parts: [{ text: prompt }],
      },
    };

    const keywordResult = await callGeminiWithFallback(
      model ? normalizeGeminiModel(model) : 'gemini-2.5-flash',
      keywordPayload,
      customApiKey,
      clientAccessCode,
      'tier3',
      'TikTok Shop Keyword Intent'
    );

    const rawJsonText = keywordResult?.text?.trim() || '';
    const jsonMatch = rawJsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed.keywords) && parsed.keywords.length >= 4) {
        classifiedKeywords = parsed.keywords;
      }
      if (Array.isArray(parsed.ideas_hook_assignment) && parsed.ideas_hook_assignment.length > 0) {
        ideasHookAssignments = parsed.ideas_hook_assignment;
      }
    }
  } catch (keywordErr) {
    logger.warn('[keyword-classifier] Keyword Intent AI failed, using fallback:', keywordErr);
  }

  if (classifiedKeywords.length < 4) {
    const baseName = derivedProductName.slice(0, 35).trim() || 'produk tiktok';
    classifiedKeywords = [
      { keyword: `rekomendasi ${baseName}`, intent: 'result' },
      { keyword: `solusi masalah dengan ${baseName}`, intent: 'problem' },
      { keyword: `review jujur ${baseName} viral`, intent: 'curiosity' },
      { keyword: `harga promo diskon ${baseName}`, intent: 'price' },
      { keyword: `${baseName} beneran bagus gak`, intent: 'curiosity' },
      { keyword: `hasil pemakaian ${baseName}`, intent: 'result' },
      { keyword: `kenapa harus beli ${baseName}`, intent: 'problem' },
      { keyword: `voucher gratis ongkir ${baseName}`, intent: 'price' },
    ];
  }

  if (ideasHookAssignments.length === 0) {
    for (let i = 1; i <= totalIdeas; i++) {
      const hook = fallbackHookTypes[(i - 1) % fallbackHookTypes.length];
      const kwObj = classifiedKeywords[(i - 1) % classifiedKeywords.length];
      ideasHookAssignments.push({
        idea_number: i,
        hook_type: hook,
        primary_keyword: kwObj?.keyword || derivedProductName,
        intent: kwObj?.intent || 'result',
      });
    }
  }

  return {
    classifiedKeywords,
    ideasHookAssignments,
  };
}

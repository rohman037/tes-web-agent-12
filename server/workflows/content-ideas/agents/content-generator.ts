import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { sanitizeCaptionsAndHashtags } from '@/server/core/utils/sanitizer';
import { logger } from '@/server/core/utils/logger';
import { CONTENT_GENERATOR_SYSTEM_PROMPT } from '../prompts/content-generator.system';
import { buildContentGeneratorUserPrompt } from '../prompts/content-generator.user';
import { ContentGeneratorInput, ContentGeneratorOutput } from '../types';

export async function generateContent(input: ContentGeneratorInput): Promise<ContentGeneratorOutput> {
  const {
    totalIdeas,
    maxSecNum,
    segSecNum,
    expectedClipsCount,
    timestampTemplateText,
    timestampGuideList,
    groundingContext,
    productContext,
    contentType,
    tone,
    queryCouncilResult,
    userSeedQueriesClean,
    model,
    customApiKey,
    clientAccessCode,
  } = input;

  logger.info(`[content-generator] Generating ${totalIdeas} viral content ideas | tier=flagship`);

  const ideaPromptTemplates: string[] = [];
  for (let i = 1; i <= totalIdeas; i++) {
    ideaPromptTemplates.push(`### 💡 IDE ${i}: [Judul Ide Konten ${i}]
- **Tipe & Angle Konten**: [Problem-Solution / POV Relatable / Unboxing Soft-Sell / Review Jujur]
- **Target Audience**: [Sebutkan audiens target spesifik]
- **AEO Query Mapping**: Short → [...], Long → [...]
- **Alasan Relevansi**: [1-2 kalimat penjelasan koneksi ke grounding & query target]
- **BLUFF Hook Pikat (0-3s)**: "[Kalimat pikat BLUFF - Langsung ke Inti Solusi/Jawaban di 3 detik pertama]"
- **Atomic Answer Summary (LLM RAG Citation Ready)**: "[1-2 kalimat fakta mandiri utuh yang siap dikutip AI Search Engine]"
- **Consensus Trigger (Tier 2 Validation)**: "[Pemicu validasi sosial / review komunitas untuk membangun konsensus LLM]"
- **Panduan Visual & Audio**: [Deskripsi gaya adegan, ekspresi, lighting, rekomendasi sound TikTok]
- **Rincian Adegan Video & Prompt AI per Segmen (${maxSecNum} Detik)**:
${timestampTemplateText}
- **AEO Caption SEO**:
"""text
[Caption Storytelling & Konversi: Kalimat 1 = Hook pikat masalah/BLUFF answer + Entitas Produk/Topik Utama; Kalimat 2-3 = Poin detail manfaat nyata & keunggulan spesifik produk; Kalimat 4-5 = Call To Action (CTA) persuasif yang mengalir natural]
"""
- **Hashtag Relevan**: '#[NamaProduk/Topik] #[KategoriSpesifik] #[Manfaat/Solusi] #[NicheAudiens] #[TargetSEOKeyword]'`);
  }
  const allIdeasTemplate = ideaPromptTemplates.join('\n\n---\n\n');

  const userPrompt = buildContentGeneratorUserPrompt({
    totalIdeas,
    maxSecNum,
    segSecNum,
    expectedClipsCount,
    allIdeasTemplate,
    timestampGuideList,
    groundingContext,
    productContext,
    contentType,
    tone,
    queryCouncilResult,
    userSeedQueriesClean,
  });

  const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;

  const payload = {
    contents: {
      parts: [
        {
          text: userPrompt,
        },
      ],
    },
    config: {
      systemInstruction: CONTENT_GENERATOR_SYSTEM_PROMPT,
    },
  };

  const result = await callGeminiWithFallback(
    userSelectedModel,
    payload,
    customApiKey,
    clientAccessCode,
    'flagship',
    'Content Ideas Stage 2'
  );

  const sanitized = sanitizeCaptionsAndHashtags(result.text);

  return {
    text: sanitized,
    modelUsed: result.modelUsed,
  };
}

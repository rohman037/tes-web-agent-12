import {
  ProductAnalysisData,
  ViralAnalysisData,
  AdaptedConceptData,
  SeoData,
  ReplicaClip,
  QualityControlResult,
  QualityControlIssue,
  QualityScoreBreakdown,
} from '@/server/types/replicaVideo.types';
import { logger } from '@/server/core/utils/logger';

export interface QualityControlInput {
  viralAnalysis: ViralAnalysisData;
  productAnalysis: ProductAnalysisData;
  adaptedConcept: AdaptedConceptData;
  seo: SeoData;
  clips: ReplicaClip[];
  targetDurationSeconds: number;
  splitDurationSeconds: number;
  referenceImageProvided?: boolean;
}

export interface QualityControlEvaluation {
  result: QualityControlResult;
  correctedSeo?: SeoData;
  correctedClips?: ReplicaClip[];
  criticalIssuesSummary: string[];
}

/**
 * Strict Banned Generic / Social Spam Hashtags
 */
const BANNED_GENERIC_TAGS = new Set([
  '#fyp', '#fypシ', '#fypviral', '#foryou', '#foryoupage', '#foru',
  '#viral', '#viralvideo', '#viraltiktok', '#trend', '#trending', '#trendingvideo',
  '#xyzbca', '#masukberanda', '#beranda', '#tiktok', '#tik_tok', '#tiktokshop',
  '#explore', '#explorepage', '#reels', '#indonesia', '#like', '#follow',
  '#videoviral', '#trendingtopic', '#fypppppppppppppp'
]);

/**
 * Irrelevant product cross-contaminants (forbidden words when product is distinct)
 */
const CROSS_PRODUCT_HALLUCINATIONS = [
  'parfum', 'perfume', 'fragrance',
  'lipstik', 'lipstick', 'lipserum',
  'sepatu', 'shoes', 'sneakers',
  'tas wanita', 'handbag', 'tote bag',
  'jam tangan', 'smartwatch',
  'kacamata', 'sunglasses'
];

/**
 * Quality Control Service:
 * Evaluates, scores, and auto-corrects outputs according to the 8 QC checks.
 */
export class QualityControlService {
  /**
   * Run comprehensive QC evaluation across 8 quality checks.
   */
  public static evaluate(input: QualityControlInput): QualityControlEvaluation {
    const {
      viralAnalysis,
      productAnalysis,
      adaptedConcept,
      targetDurationSeconds,
      splitDurationSeconds,
    } = input;

    // Working copies for auto-correction if necessary
    const seo: SeoData = {
      caption: input.seo.caption || '',
      hashtags: [...(input.seo.hashtags || [])],
      keywords_used: [...(input.seo.keywords_used || [])],
    };

    const clips: ReplicaClip[] = JSON.parse(JSON.stringify(input.clips || []));
    const issues: QualityControlIssue[] = [];

    // --- CHECK 5: KEYWORD INTELLIGENCE EXTRACTION ---
    const extractedKeywords = this.extractKeywordIntelligence(productAnalysis);

    // --- CHECK 1: PRODUCT CONSISTENCY CHECK ---
    const productConsistency = this.checkProductConsistency(
      productAnalysis,
      clips,
      seo,
      extractedKeywords
    );
    issues.push(...productConsistency.issues);

    // --- CHECK 2: VIDEO PROMPT RELEVANCE CHECK ---
    const promptRelevance = this.checkVideoPromptRelevance(
      productAnalysis,
      clips,
      extractedKeywords
    );
    issues.push(...promptRelevance.issues);
    if (promptRelevance.fixedClips) {
      promptRelevance.fixedClips.forEach((fc, idx) => {
        if (clips[idx]) clips[idx].master_prompt = fc.master_prompt;
      });
    }

    // --- CHECK 3: CAPTION RELEVANCE CHECK ---
    const captionRelevance = this.checkCaptionRelevance(
      productAnalysis,
      seo,
      extractedKeywords
    );
    issues.push(...captionRelevance.issues);
    if (captionRelevance.fixedCaption) {
      seo.caption = captionRelevance.fixedCaption;
    }
    if (captionRelevance.fixedKeywords) {
      seo.keywords_used = captionRelevance.fixedKeywords;
    }

    // --- CHECK 4: HASHTAG INTELLIGENCE FILTER ---
    const hashtagValidation = this.checkHashtagIntelligence(
      productAnalysis,
      seo.hashtags,
      extractedKeywords
    );
    issues.push(...hashtagValidation.issues);
    seo.hashtags = hashtagValidation.sanitizedHashtags;

    // --- CHECK 6: SCENE TIMING VALIDATION ---
    const timingValidation = this.checkSceneTiming(
      clips,
      targetDurationSeconds,
      splitDurationSeconds
    );
    issues.push(...timingValidation.issues);
    if (timingValidation.correctedClips) {
      timingValidation.correctedClips.forEach((tc, idx) => {
        if (clips[idx]) {
          clips[idx].start_second = tc.start_second;
          clips[idx].end_second = tc.end_second;
          clips[idx].duration_label = tc.duration_label;
          clips[idx].scenes = tc.scenes;
        }
      });
    }

    // --- CHECK 7: AUDIO RELEVANCE CHECK ---
    const audioValidation = this.checkAudioRelevance(
      productAnalysis,
      viralAnalysis,
      clips
    );
    issues.push(...audioValidation.issues);
    if (audioValidation.fixedClips) {
      audioValidation.fixedClips.forEach((fc, idx) => {
        if (clips[idx]) {
          clips[idx].scenes = fc.scenes;
        }
      });
    }

    // --- CHECK 8: VISUAL HALLUCINATION FILTER ---
    const hallucinationCheck = this.checkVisualHallucination(
      productAnalysis,
      clips,
      input.referenceImageProvided
    );
    issues.push(...hallucinationCheck.issues);

    // --- COMPUTE BREAKDOWN & TOTAL SCORES ---
    const qualityScore: QualityScoreBreakdown = {
      product_relevance: Math.max(0, Math.min(100, productConsistency.score)),
      visual_relevance: Math.max(0, Math.min(100, Math.round((promptRelevance.score + hallucinationCheck.score) / 2))),
      caption_relevance: Math.max(0, Math.min(100, captionRelevance.score)),
      hashtag_relevance: Math.max(0, Math.min(100, hashtagValidation.score)),
      audio_relevance: Math.max(0, Math.min(100, audioValidation.score)),
      scene_accuracy: Math.max(0, Math.min(100, timingValidation.score)),
    };

    // Weighted Total Score
    const totalScore = Math.round(
      qualityScore.product_relevance * 0.25 +
      qualityScore.visual_relevance * 0.20 +
      qualityScore.caption_relevance * 0.20 +
      qualityScore.hashtag_relevance * 0.15 +
      qualityScore.audio_relevance * 0.10 +
      qualityScore.scene_accuracy * 0.10
    );

    const criticalIssues = issues.filter((i) => i.severity === 'critical');
    const criticalIssuesSummary = criticalIssues.map((i) => `[${i.check_type}] ${i.message}`);

    const passed = totalScore >= 80 && criticalIssues.length === 0;

    const result: QualityControlResult = {
      passed,
      total_score: totalScore,
      quality_score: qualityScore,
      issues,
      refinement_attempted: false,
      extracted_keywords: extractedKeywords,
    };

    logger.info(
      `[QualityControlService] Evaluated output: Total Score=${totalScore}/100 (Pass=${passed}). Breakdown: Product=${qualityScore.product_relevance}, Visual=${qualityScore.visual_relevance}, Caption=${qualityScore.caption_relevance}, Hashtag=${qualityScore.hashtag_relevance}, Audio=${qualityScore.audio_relevance}, Timing=${qualityScore.scene_accuracy}`
    );

    return {
      result,
      correctedSeo: seo,
      correctedClips: clips,
      criticalIssuesSummary,
    };
  }

  // =========================================================================
  // CHECK 1: PRODUCT CONSISTENCY
  // =========================================================================
  private static checkProductConsistency(
    product: ProductAnalysisData,
    clips: ReplicaClip[],
    seo: SeoData,
    keywords: { core: string[]; related: string[] }
  ): { score: number; issues: QualityControlIssue[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;

    const productNameLower = (product.product_name || '').toLowerCase();
    const coreWords = productNameLower.split(/\s+/).filter((w) => w.length > 2);

    // Combine all generated texts
    const allPromptText = clips.map((c) => `${c.master_prompt} ${c.scenes.map((s) => `${s.visual} ${s.action}`).join(' ')}`).join(' ').toLowerCase();
    const captionLower = (seo.caption || '').toLowerCase();

    // Check if any word from product name is present in prompts
    const hasCoreWordInPrompt = coreWords.some((w) => allPromptText.includes(w)) ||
      keywords.core.some((k) => allPromptText.includes(k.toLowerCase()));

    if (!hasCoreWordInPrompt) {
      score -= 30;
      issues.push({
        check_type: 'product_consistency',
        severity: 'critical',
        message: `Master prompt video tidak memuat konsep atau nama produk "${product.product_name}".`,
        suggestion: `Pastikan subjek "${product.product_name}" menjadi titik fokus visual utama.`,
      });
    }

    // Check cross-product contamination
    for (const forbidden of CROSS_PRODUCT_HALLUCINATIONS) {
      if (!productNameLower.includes(forbidden) && (allPromptText.includes(forbidden) || captionLower.includes(forbidden))) {
        score -= 25;
        issues.push({
          check_type: 'product_consistency',
          severity: 'critical',
          message: `Terdeteksi kontaminasi produk asing tidak relevan: "${forbidden}".`,
          suggestion: `Hapus referensi "${forbidden}" karena tidak sesuai dengan produk target.`,
        });
      }
    }

    return { score: Math.max(0, score), issues };
  }

  // =========================================================================
  // CHECK 2: VIDEO PROMPT RELEVANCE
  // =========================================================================
  private static checkVideoPromptRelevance(
    product: ProductAnalysisData,
    clips: ReplicaClip[],
    keywords: { core: string[]; related: string[] }
  ): { score: number; issues: QualityControlIssue[]; fixedClips?: ReplicaClip[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;
    const fixedClips: ReplicaClip[] = [];

    clips.forEach((clip) => {
      const prompt = (clip.master_prompt || '').trim();
      const promptLower = prompt.toLowerCase();
      let clipUpdated = false;
      let newPrompt = prompt;

      // Check for hollow / generic prompts
      const isGeneric = prompt.length < 35 ||
        /^(create|generate|make)\s+(a\s+)?viral\s+video/i.test(prompt) ||
        !prompt.includes(',') ||
        (!promptLower.includes('9:16') && !promptLower.includes('vertical'));

      if (isGeneric) {
        score -= 20;
        issues.push({
          check_type: 'prompt_relevance',
          severity: 'warning',
          message: `Master prompt Klip ${clip.clip_number} terlalu pendek atau berbau generik.`,
          suggestion: 'Sertakan detail subjek, aksi interaksi produk, lingkungan, optik kamera, dan framing 9:16.',
        });

        // Auto-enrich prompt
        newPrompt = `Cinematic vertical 9:16 commercial video of ${product.product_name}, demonstrating tactile interaction and high quality texture on a clean surface. Warm natural commercial lighting, low-angle push-in camera motion at f/2.0, 8k resolution, photorealistic commercial aesthetics, smooth natural motion.`;
        clipUpdated = true;
      }

      fixedClips.push({
        ...clip,
        master_prompt: clipUpdated ? newPrompt : clip.master_prompt,
      });
    });

    return { score: Math.max(0, score), issues, fixedClips };
  }

  // =========================================================================
  // CHECK 3: CAPTION RELEVANCE
  // =========================================================================
  private static checkCaptionRelevance(
    product: ProductAnalysisData,
    seo: SeoData,
    keywords: { core: string[]; related: string[] }
  ): { score: number; issues: QualityControlIssue[]; fixedCaption?: string; fixedKeywords?: string[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;
    let fixedCaption = seo.caption;
    let fixedKeywords = seo.keywords_used;

    const captionLower = (seo.caption || '').toLowerCase();
    const productNameLower = (product.product_name || '').toLowerCase();

    // Check if caption is pure clickbait without product name
    const hasProductName = productNameLower.split(/\s+/).some((w) => w.length > 2 && captionLower.includes(w));
    const isPureClickbait = /^(barang viral|wajib beli|produk terbaik|rekomendasi viral)/i.test(seo.caption) && !hasProductName;

    if (isPureClickbait || !hasProductName) {
      score -= 25;
      issues.push({
        check_type: 'caption_relevance',
        severity: 'warning',
        message: 'Caption tidak menyebutkan nama atau kata kunci produk secara spesifik.',
        suggestion: `Sematkan "${product.product_name}" dalam narasi hook pembuka caption.`,
      });

      // Auto-inject product relevance naturally into caption
      fixedCaption = `Awalnya banyak yang penasaran, ternyata rahasia praktisnya ada di ${product.product_name}! ${product.selling_angle_primary || 'Bikin aktivitas harian jadi lebih rapi dan nyaman'}.\n\n${seo.caption}\n\nYuk coba buktikan sendiri sekarang sebelum kehabisan!`;
    }

    // Ensure keywords_used contains real core keywords
    if (!fixedKeywords || fixedKeywords.length === 0) {
      fixedKeywords = keywords.core.slice(0, 3);
    }

    return { score: Math.max(0, score), issues, fixedCaption, fixedKeywords };
  }

  // =========================================================================
  // CHECK 4: HASHTAG INTELLIGENCE FILTER
  // =========================================================================
  private static checkHashtagIntelligence(
    product: ProductAnalysisData,
    hashtags: string[],
    keywords: { core: string[]; related: string[] }
  ): { score: number; issues: QualityControlIssue[]; sanitizedHashtags: string[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;

    let sanitized: string[] = [];
    let bannedFound = 0;

    for (const tag of hashtags || []) {
      const clean = tag.startsWith('#') ? tag : `#${tag}`;
      const lower = clean.toLowerCase();

      if (BANNED_GENERIC_TAGS.has(lower)) {
        bannedFound++;
      } else if (lower.length > 2 && !sanitized.includes(clean)) {
        sanitized.push(clean);
      }
    }

    if (bannedFound > 0) {
      score -= bannedFound * 15;
      issues.push({
        check_type: 'hashtag_intelligence',
        severity: 'warning',
        message: `Ditemukan ${bannedFound} hashtag generik/spam terlarang (#fyp, #viral, dll).`,
        suggestion: 'Gantikan dengan hashtag spesifik produk, kategori, dan niche komunitas.',
      });
    }

    // If tags are too few (< 4), intelligently construct niche & intent tags
    if (sanitized.length < 4) {
      score -= 10;
      const productSlug = product.product_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      const categorySlug = (product.category || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();

      const candidateTags = [
        `#${productSlug}`,
        `#${categorySlug}`,
        ...keywords.core.map((k) => `#${k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`),
        ...keywords.related.map((k) => `#${k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`),
      ].filter((t) => t.length > 3 && !BANNED_GENERIC_TAGS.has(t));

      for (const cand of candidateTags) {
        if (!sanitized.includes(cand)) {
          sanitized.push(cand);
        }
        if (sanitized.length >= 6) break;
      }
    }

    return {
      score: Math.max(0, score),
      issues,
      sanitizedHashtags: sanitized.slice(0, 8),
    };
  }

  // =========================================================================
  // CHECK 5: KEYWORD INTELLIGENCE EXTRACTION
  // =========================================================================
  public static extractKeywordIntelligence(
    product: ProductAnalysisData
  ): { core: string[]; related: string[] } {
    const rawName = (product.product_name || '').trim();
    const rawCategory = (product.category || '').trim();

    // Generate core keywords based on product name and existing keywords
    const coreSet = new Set<string>();
    if (rawName) coreSet.add(rawName.toLowerCase());

    (product.keyword_core || []).forEach((k) => {
      if (k && k.trim()) coreSet.add(k.trim().toLowerCase());
    });

    // Fallback: tokenize product name
    const tokens = rawName.split(/\s+/).filter((t) => t.length > 2);
    if (tokens.length >= 2) {
      coreSet.add(`${tokens[0]} ${tokens[1]}`.toLowerCase());
    }

    // Generate related / niche keywords
    const relatedSet = new Set<string>();
    if (rawCategory) relatedSet.add(rawCategory.toLowerCase());

    (product.keyword_niche || []).forEach((k) => {
      if (k && k.trim()) relatedSet.add(k.trim().toLowerCase());
    });

    // Add intent search terms if applicable
    if (rawName.toLowerCase().includes('kucing')) {
      relatedSet.add('dekorasi rumah');
      relatedSet.add('rumah minimalis');
      relatedSet.add('aksesoris rumah');
    }

    return {
      core: Array.from(coreSet).slice(0, 5),
      related: Array.from(relatedSet).slice(0, 5),
    };
  }

  // =========================================================================
  // CHECK 6: SCENE TIMING VALIDATION
  // =========================================================================
  private static checkSceneTiming(
    clips: ReplicaClip[],
    targetDurationSeconds: number,
    splitDurationSeconds: number
  ): { score: number; issues: QualityControlIssue[]; correctedClips?: ReplicaClip[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;
    const correctedClips: ReplicaClip[] = [];

    const expectedClipCount = Math.ceil(targetDurationSeconds / splitDurationSeconds);
    let expectedStart = 0;

    clips.forEach((clip, idx) => {
      const clipNum = idx + 1;
      const expectedEnd = Math.min(targetDurationSeconds, expectedStart + splitDurationSeconds);
      const isStartAccurate = clip.start_second === expectedStart;
      const isEndAccurate = clip.end_second === expectedEnd;

      if (!isStartAccurate || !isEndAccurate) {
        score -= 15;
        issues.push({
          check_type: 'scene_timing',
          severity: 'warning',
          message: `Durasi Klip ${clipNum} (${clip.start_second}-${clip.end_second}s) tidak selaras dengan split ${splitDurationSeconds}s.`,
          suggestion: `Koreksi ke ${expectedStart}-${expectedEnd} detik.`,
        });
      }

      // Validate internal scenes inside this clip
      const correctedScenes = (clip.scenes || []).map((sc, sIdx) => {
        let scStart = typeof sc.start_second === 'number' ? sc.start_second : expectedStart;
        let scEnd = typeof sc.end_second === 'number' ? sc.end_second : expectedEnd;
        if (scStart < expectedStart || scStart > expectedEnd) scStart = expectedStart;
        if (scEnd > expectedEnd || scEnd <= scStart) scEnd = expectedEnd;

        return {
          ...sc,
          start_second: scStart,
          end_second: scEnd,
        };
      });

      correctedClips.push({
        ...clip,
        clip_number: clipNum,
        start_second: expectedStart,
        end_second: expectedEnd,
        duration_label: `${expectedStart}–${expectedEnd} detik`,
        scenes: correctedScenes,
      });

      expectedStart = expectedEnd;
    });

    if (clips.length !== expectedClipCount) {
      score -= 20;
      issues.push({
        check_type: 'scene_timing',
        severity: 'warning',
        message: `Jumlah klip (${clips.length}) tidak sesuai target (${expectedClipCount} klip untuk total ${targetDurationSeconds}s).`,
      });
    }

    return { score: Math.max(0, score), issues, correctedClips };
  }

  // =========================================================================
  // CHECK 7: AUDIO RELEVANCE CHECK
  // =========================================================================
  private static checkAudioRelevance(
    product: ProductAnalysisData,
    viral: ViralAnalysisData,
    clips: ReplicaClip[]
  ): { score: number; issues: QualityControlIssue[]; fixedClips?: ReplicaClip[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;
    const fixedClips: ReplicaClip[] = [];

    const productNameLower = (product.product_name || '').toLowerCase();
    const isGentleProduct = productNameLower.includes('skincare') ||
      productNameLower.includes('kucing') ||
      productNameLower.includes('serum') ||
      productNameLower.includes('keset');

    clips.forEach((clip) => {
      const updatedScenes = (clip.scenes || []).map((sc) => {
        let audioText = (sc.audio || '').trim();

        // Check if audio is empty
        if (!audioText || audioText.length < 5) {
          score -= 10;
          issues.push({
            check_type: 'audio_relevance',
            severity: 'warning',
            message: `Arahan audio pada Scene ${sc.scene_number} klip ${clip.clip_number} kosong.`,
            suggestion: 'Sertakan foley ASMR dan mood musik latar.',
          });
          audioText = `Ambient room sound, tactile ASMR texture of ${product.product_name}, soft upbeat lo-fi background music`;
        }

        // Check for jarring inappropriate sounds (e.g. explosions on soft products)
        if (isGentleProduct && /explosion|boom|gunfire|bomb|shatter/i.test(audioText)) {
          score -= 20;
          issues.push({
            check_type: 'audio_relevance',
            severity: 'critical',
            message: `Arahan audio tidak sesuai dengan sifat produk "${product.product_name}".`,
            suggestion: 'Gunakan sound design lembut, ASMR mikrofon, atau ambience ruangan.',
          });
          audioText = audioText.replace(/explosion|boom|gunfire|bomb|shatter/gi, 'soft tactile foley impact');
        }

        return {
          ...sc,
          audio: audioText,
        };
      });

      fixedClips.push({
        ...clip,
        scenes: updatedScenes,
      });
    });

    return { score: Math.max(0, score), issues, fixedClips };
  }

  // =========================================================================
  // CHECK 8: VISUAL HALLUCINATION FILTER
  // =========================================================================
  private static checkVisualHallucination(
    product: ProductAnalysisData,
    clips: ReplicaClip[],
    referenceImageProvided?: boolean
  ): { score: number; issues: QualityControlIssue[] } {
    const issues: QualityControlIssue[] = [];
    let score = 100;

    const allVisuals = clips.map((c) => c.scenes.map((s) => `${s.visual} ${s.action}`).join(' ')).join(' ').toLowerCase();

    // Check if alien objects leaked into visual scenes
    for (const forbidden of CROSS_PRODUCT_HALLUCINATIONS) {
      if (!product.product_name.toLowerCase().includes(forbidden) && allVisuals.includes(forbidden)) {
        score -= 25;
        issues.push({
          check_type: 'visual_hallucination',
          severity: 'critical',
          message: `Visual halusinasi terdeteksi: scene menampilkan "${forbidden}" padahal produk adalah "${product.product_name}".`,
          suggestion: `Ganti fokus scene ke demonstrasi fisik "${product.product_name}".`,
        });
      }
    }

    if (referenceImageProvided) {
      // Reward grounding when reference image is supplied
      score = Math.min(100, score + 5);
    }

    return { score: Math.max(0, score), issues };
  }
}

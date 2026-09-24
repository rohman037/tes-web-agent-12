import { logger } from '@/server/core/utils/logger';
import { ProductIntelligenceOutput } from '@/server/agents/productIntelligenceAgent';
import { ContentStrategyOutput } from '@/server/agents/contentStrategyAgent';
import { VideoPromptSeoOutput } from '@/server/agents/videoPromptSeoAgent';

export interface ProductVideoQualityScore {
  product_score: number;
  prompt_score: number;
  seo_score: number;
  visual_score: number;
  overall_score: number;
  passed: boolean;
  issues: string[];
  improvements_applied: string[];
}

export class ProductVideoQualityControlService {
  private static readonly BANNED_HASHTAGS = [
    '#fyp',
    '#viral',
    '#trending',
    '#foryou',
    '#foryoupage',
    '#explore',
    '#trend',
    '#xyzbca',
    '#masukberanda',
  ];

  /**
   * Evaluates and refines the generated video package deterministically (0 Gemini API calls)
   */
  public static evaluateAndRefine(
    productInfo: ProductIntelligenceOutput,
    strategy: ContentStrategyOutput,
    output: VideoPromptSeoOutput,
    hasReferenceImage: boolean = false
  ): { score: ProductVideoQualityScore; refinedOutput: VideoPromptSeoOutput } {
    const issues: string[] = [];
    const improvements: string[] = [];
    const pName = productInfo.product_identity.name.toLowerCase();
    const pCategory = productInfo.product_identity.category.toLowerCase();
    const primaryKw = productInfo.seo_keywords.primary.toLowerCase();
    const vAnchor = productInfo.visual_anchor;

    // Normalize alias properties
    const masterPrompt = output.master_video_prompt || '';
    const captionText = output.caption_seo?.caption || output.seo?.caption || '';
    const rawHashtags = output.hashtags || output.seo?.hashtags || [];
    const clipsList = output.micro_scene_breakdown || output.clips || [];

    // ------------------------------------------------------------------------
    // QC 1: PRODUCT CONSISTENCY (Weight 25%)
    // ------------------------------------------------------------------------
    let productScore = 100;
    const masterPromptLower = masterPrompt.toLowerCase();
    const captionLower = captionText.toLowerCase();

    const promptHasProduct = masterPromptLower.includes(pName) || masterPromptLower.includes(primaryKw);
    const captionHasProduct = captionLower.includes(pName) || captionLower.includes(primaryKw);

    if (!promptHasProduct) {
      productScore -= 15;
      issues.push('Master Prompt tidak secara eksplisit menyebut subjek produk spesifik');
      output.master_video_prompt = `Ultra realistic 8K commercial video featuring ${productInfo.product_identity.name} (${vAnchor.color}, ${vAnchor.material}). ${masterPrompt}`;
      improvements.push('Menyisipkan nama dan spesifikasi fisik produk ke Master Prompt');
    }

    if (!captionHasProduct) {
      productScore -= 15;
      issues.push('Caption tidak menyebutkan nama atau kata kunci produk utama');
      const updatedCaption = `${productInfo.product_identity.name} - ${captionText}`;
      if (output.caption_seo) output.caption_seo.caption = updatedCaption;
      if (output.seo) output.seo.caption = updatedCaption;
      improvements.push('Menambahkan nama produk ke bagian awal caption');
    }

    // ------------------------------------------------------------------------
    // QC 2: VISUAL CONSISTENCY (Weight 25%)
    // ------------------------------------------------------------------------
    let visualScore = 100;
    const anchorColor = (vAnchor.color || '').toLowerCase();
    const anchorMaterial = (vAnchor.material || '').toLowerCase();
    const anchorShape = (vAnchor.shape || '').toLowerCase();

    const promptHasColor = anchorColor ? masterPromptLower.includes(anchorColor) : true;
    const promptHasMaterial = anchorMaterial ? masterPromptLower.includes(anchorMaterial) : true;

    if (!promptHasColor || !promptHasMaterial) {
      visualScore -= 15;
      issues.push('Visual consistency: Konsistensi material atau warna produk pada prompt perlu dipertegas');
      output.master_video_prompt += ` Note: Maintain strict visual anchor consistency for ${vAnchor.color} color palette, ${vAnchor.material} texture, and ${vAnchor.shape} form factor across all scenes.`;
      improvements.push('Menyematkan visual anchor warna, material, dan bentuk pada Master Prompt');
    }

    // Check micro scene clips visual consistency
    clipsList.forEach((clip, idx) => {
      if (!clip.prompt || clip.prompt.length < 25) {
        clip.prompt = `Ultra realistic 8K commercial shot of ${productInfo.product_identity.name}, ${vAnchor.color} color, ${vAnchor.material} material, ${clip.visual || 'product close-up'}, 24fps.`;
        improvements.push(`Memperkuat visual prompt & anchor pada Klip #${idx + 1}`);
      }
    });

    // ------------------------------------------------------------------------
    // QC 3: PROMPT QUALITY (Weight 25%)
    // ------------------------------------------------------------------------
    let promptScore = 100;
    const requiredPromptElements = [
      { name: 'Subject', keywords: [pName, primaryKw, 'product', 'item', 'device', 'bottle'] },
      { name: 'Action', keywords: ['swirl', 'press', 'pour', 'blend', 'hold', 'operate', 'open', 'demonstrat', 'action', 'movement', 'usage'] },
      { name: 'Environment', keywords: ['kitchen', 'counter', 'studio', 'table', 'workspace', 'background', 'environment', 'room', 'marble', 'sunlit', 'outdoor'] },
      { name: 'Camera', keywords: ['camera', 'shot', 'tracking', 'angle', 'push-in', 'glide', 'orbital', 'close-up', 'macro', 'lens'] },
      { name: 'Lighting', keywords: ['lighting', 'light', 'diffused', 'studio', 'rim', 'reflection', 'soft', 'glow'] },
      { name: 'Audio', keywords: ['audio', 'sound', 'foley', 'cue', 'click', 'music', 'rhythm', 'ambient'] },
      { name: 'Motion', keywords: ['motion', 'fluid', 'physics', '24fps', 'smooth', 'cinematic'] },
    ];

    for (const elem of requiredPromptElements) {
      const hasElem = elem.keywords.some((kw) => masterPromptLower.includes(kw));
      if (!hasElem) {
        promptScore -= 5;
        issues.push(`Prompt kurang detail pada elemen sinematik: ${elem.name}`);
      }
    }

    // ------------------------------------------------------------------------
    // QC 4: SEO CONSISTENCY & HASHTAGS (Weight 25%)
    // ------------------------------------------------------------------------
    let seoScore = 100;

    // Filter banned hashtags (#fyp, #viral, #trending, #foryou, #explore)
    const cleanTags = rawHashtags.filter((tag) => {
      const t = tag.toLowerCase().trim();
      const isBanned = ProductVideoQualityControlService.BANNED_HASHTAGS.includes(t);
      if (isBanned) {
        issues.push(`Menemukan hashtag generik dilarang: ${tag}`);
      }
      return !isBanned;
    });

    if (cleanTags.length < rawHashtags.length) {
      seoScore -= 10;
      improvements.push('Mengeliminasi hashtag generik/clickbait dilarang');
    }

    // Build exactly 5 high-relevance ranked hashtags:
    // 40% (2) Product keyword, 30% (1) Category, 20% (1) Audience, 10% (1) Search intent
    const rankedHashtags: string[] = [];
    rankedHashtags.push(`#${productInfo.product_identity.name.replace(/[^a-zA-Z0-9]/g, '')}`);
    if (productInfo.seo_keywords.primary) {
      rankedHashtags.push(`#${productInfo.seo_keywords.primary.replace(/[^a-zA-Z0-9]/g, '')}`);
    }
    if (productInfo.product_identity.category) {
      rankedHashtags.push(`#${productInfo.product_identity.category.replace(/[^a-zA-Z0-9]/g, '')}`);
    }
    if (productInfo.seo_keywords.category) {
      rankedHashtags.push(`#${productInfo.seo_keywords.category.replace(/[^a-zA-Z0-9]/g, '')}`);
    }
    if (productInfo.seo_keywords.buying_intent) {
      rankedHashtags.push(`#${productInfo.seo_keywords.buying_intent.replace(/[^a-zA-Z0-9]/g, '')}`);
    }

    const finalTagsMap = new Map<string, string>();
    for (const tag of [...cleanTags, ...rankedHashtags]) {
      const formatted = tag.startsWith('#') ? tag : `#${tag}`;
      if (formatted.length > 2 && !finalTagsMap.has(formatted.toLowerCase())) {
        finalTagsMap.set(formatted.toLowerCase(), formatted);
      }
      if (finalTagsMap.size >= 5) break;
    }

    const finalHashtagsList = Array.from(finalTagsMap.values());
    output.hashtags = finalHashtagsList;
    if (output.seo) output.seo.hashtags = finalHashtagsList;

    // ------------------------------------------------------------------------
    // QC 5: SEMANTIC CONSISTENCY (Domain Context Alignment)
    // ------------------------------------------------------------------------
    // Detect severe semantic context drift (e.g., Product is Laptop, but Caption talks about skincare)
    const productDomainKeywords = [pName, pCategory, primaryKw, ...productInfo.product_identity.features.map(f => f.toLowerCase())];
    let semanticMatches = 0;
    for (const kw of productDomainKeywords) {
      if (kw && kw.length > 3 && captionLower.includes(kw)) {
        semanticMatches++;
      }
    }

    if (semanticMatches === 0 && productDomainKeywords.length > 0) {
      productScore -= 20;
      seoScore -= 20;
      issues.push('Semantic drift: Konteks caption tidak selaras dengan domain produk');
      const fixedCap = `${productInfo.product_identity.name} - ${productInfo.selling_angle}. ${captionText}`;
      if (output.caption_seo) output.caption_seo.caption = fixedCap;
      if (output.seo) output.seo.caption = fixedCap;
      improvements.push('Menyelaraskan domain semantic caption dengan identity produk');
    }

    // Clamp sub-scores between 75 and 100
    productScore = Math.max(75, Math.min(100, productScore));
    visualScore = Math.max(75, Math.min(100, visualScore));
    promptScore = Math.max(75, Math.min(100, promptScore));
    seoScore = Math.max(75, Math.min(100, seoScore));

    const overallScore = Math.round(
      (productScore * 0.25) + (visualScore * 0.25) + (promptScore * 0.25) + (seoScore * 0.25)
    );

    const passed = overallScore >= 85;

    // Sync alias outputs
    output.micro_scene_breakdown = clipsList;
    output.clips = clipsList;
    if (!output.caption_seo) {
      output.caption_seo = {
        caption: output.seo?.caption || '',
        keyword_used: [primaryKw, productInfo.seo_keywords.secondary],
      };
    }

    logger.info(
      `[ProductVideoQualityControl V2] Score evaluated: Overall ${overallScore} (Product: ${productScore}, Visual: ${visualScore}, Prompt: ${promptScore}, SEO: ${seoScore}), Passed: ${passed}`
    );

    return {
      score: {
        product_score: productScore,
        prompt_score: promptScore,
        seo_score: seoScore,
        visual_score: visualScore,
        overall_score: overallScore,
        passed,
        issues,
        improvements_applied: improvements,
      },
      refinedOutput: output,
    };
  }
}

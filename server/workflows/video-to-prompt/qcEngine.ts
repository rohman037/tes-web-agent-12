import { logger } from '@/server/core/utils/logger';
import { VideoClipOutput } from './types';
import { VideoAnalyzerOutput } from '@/server/agents/videoAnalyzerAgent';
import {
  cleanSubjectTitle,
  cleanInlineHashtagsFromSentence,
  generateProductRelevantHashtags,
  BANNED_SPAM_TAGS,
} from '@/server/core/utils/sanitizer';

export interface VideoToPromptQcResult {
  passed: boolean;
  total_score: number;
  breakdown: {
    product_consistency: number;
    prompt_quality: number;
    caption_match: number;
    hashtag_validation: number;
    scene_timing: number;
    audio_visual_match: number;
  };
  issues: string[];
}

export class VideoToPromptQcEngine {
  /**
   * Run 6 quality control checks:
   * 1. Product Consistency
   * 2. Prompt Quality
   * 3. Caption Match
   * 4. Hashtag Validation
   * 5. Scene Timing
   * 6. Audio-Visual Match
   *
   * Threshold: 85/100
   */
  public static evaluate(params: {
    productOrSubject: string;
    clips: VideoClipOutput[];
    caption: string;
    hashtags: string[];
    analysisList: VideoAnalyzerOutput[];
    splitDuration: number;
  }): {
    qcResult: VideoToPromptQcResult;
    correctedCaption: string;
    correctedHashtags: string[];
    correctedClips: VideoClipOutput[];
  } {
    const { productOrSubject, clips, caption, hashtags, analysisList, splitDuration } = params;
    const issues: string[] = [];

    const cleanTitle = cleanSubjectTitle(productOrSubject);

    // --- CHECK 1: Product Consistency ---
    let productScore = 100;
    const subjectWords = cleanTitle
      .toLowerCase()
      .split(/[\s,._-]+/)
      .filter((w) => w.length > 2);

    const allPrompts = clips.map((c) => c.master_prompt.toLowerCase()).join(' ');
    const hasSubjectMention = subjectWords.length === 0 || subjectWords.some((w) => allPrompts.includes(w));

    if (!hasSubjectMention && cleanTitle.trim().length > 0) {
      productScore -= 25;
      issues.push(`Product Consistency: Subjek/produk "${cleanTitle}" tidak terrefleksi secara eksplisit di master prompt.`);
    }

    // --- CHECK 2: Prompt Quality (Structure, Lens, Lighting, Motion, Style) ---
    let promptScore = 100;
    const requiredElements = ['lens', 'lighting', 'cinematic', 'shot', 'camera'];
    clips.forEach((c, idx) => {
      const p = c.master_prompt.toLowerCase();
      const missing = requiredElements.filter((elem) => !p.includes(elem) && !p.includes('35mm') && !p.includes('8k'));
      if (missing.length >= 3) {
        promptScore -= 10;
        issues.push(`Prompt Quality Clip #${idx + 1}: Prompt kurang mendetail pada elemen sinematik (${missing.join(', ')}).`);
      }
      if (c.master_prompt.length < 80) {
        promptScore -= 15;
        issues.push(`Prompt Quality Clip #${idx + 1}: Master prompt terlalu singkat (${c.master_prompt.length} karakter).`);
      }
    });
    promptScore = Math.max(50, promptScore);

    // --- CHECK 3: Caption Match ---
    let captionScore = 100;
    let correctedCaption = cleanInlineHashtagsFromSentence(caption || '').trim();

    if (!correctedCaption || correctedCaption.length < 40) {
      captionScore -= 30;
      issues.push('Caption Match: Caption terlalu pendek atau belum teroptimasi untuk engagement media sosial.');
    }
    const captionLower = correctedCaption.toLowerCase();
    const hasCaptionRelevance = subjectWords.length === 0 || subjectWords.some((w) => captionLower.includes(w));
    if (!hasCaptionRelevance && cleanTitle.trim().length > 0) {
      captionScore -= 20;
      issues.push(`Caption Match: Caption tidak menyebutkan konteks/subjek utama "${cleanTitle}".`);
    }

    // --- CHECK 4: Hashtag Validation ---
    let hashtagScore = 100;
    let validatedTags = [...hashtags];

    // Filter generic hashtags
    const genericFound = validatedTags.filter((t) => BANNED_SPAM_TAGS.has(t.replace(/^#/, '').toLowerCase()));
    if (genericFound.length > 0) {
      hashtagScore -= genericFound.length * 10;
      issues.push(`Hashtag Validation: Ditemukan hashtag generik dilarang (${genericFound.join(', ')}).`);
      // Auto-correct: strip generic tags
      validatedTags = validatedTags.filter((t) => !BANNED_SPAM_TAGS.has(t.replace(/^#/, '').toLowerCase()));
    }

    // Ensure tags start with #
    validatedTags = validatedTags.map((t) => (t.startsWith('#') ? t : `#${t}`));

    // If less than 5 tags after filtering, synthesize relevant niche tags
    if (validatedTags.length < 5) {
      const generated = generateProductRelevantHashtags(cleanTitle);
      for (const genTag of generated) {
        if (!validatedTags.some((t) => t.toLowerCase() === genTag.toLowerCase())) {
          validatedTags.push(genTag);
        }
        if (validatedTags.length >= 5) break;
      }
    }
    validatedTags = validatedTags.slice(0, 5);

    // --- CHECK 5: Scene Timing ---
    let timingScore = 100;
    clips.forEach((c) => {
      const dur = c.end_time - c.start_time;
      if (dur > splitDuration + 3 || dur < Math.max(1, splitDuration - 3)) {
        timingScore -= 10;
        issues.push(`Scene Timing Clip #${c.clip_number}: Durasi klip (${dur}s) melenceng dari pilihan pecah (${splitDuration}s).`);
      }
      if (!c.scenes || c.scenes.length === 0) {
        timingScore -= 15;
        issues.push(`Scene Timing Clip #${c.clip_number}: Tidak ada breakdown micro-scene.`);
      }
    });
    timingScore = Math.max(60, timingScore);

    // --- CHECK 6: Audio-Visual Match ---
    let audioScore = 100;
    const hasAudioCues = clips.some((c) => c.scenes.some((s) => Boolean(s.subtitle && s.subtitle.trim().length > 0)));
    const analysisHasAudio = analysisList.some((a) => Boolean(a.dna?.audio_dna?.dialogue || a.dna?.audio_dna?.voice_over));
    if (!hasAudioCues && analysisHasAudio) {
      audioScore -= 15;
      issues.push('Audio-Visual Match: Audio dialog / voiceover tidak tersemat ke micro-scenes.');
    }

    // --- Calculate Total Weighted Score ---
    const totalScore = Math.round(
      productScore * 0.25 +
      promptScore * 0.25 +
      captionScore * 0.15 +
      hashtagScore * 0.15 +
      timingScore * 0.10 +
      audioScore * 0.10
    );

    const passed = totalScore >= 85;

    logger.info(
      `[VideoToPromptQcEngine] Evaluated QC: Total Score = ${totalScore}/100 (Passed: ${passed}). Breakdown: Product=${productScore}, Prompt=${promptScore}, Caption=${captionScore}, Hashtags=${hashtagScore}, Timing=${timingScore}, Audio=${audioScore}`
    );

    // Auto-correct clips if prompt was too bare
    const correctedClips = clips.map((c) => {
      let mp = c.master_prompt;
      if (!mp.toLowerCase().includes('35mm') && !mp.toLowerCase().includes('lens')) {
        mp = `${mp}, shot on 35mm anamorphic prime lens, f/1.8 shallow depth of field, master cinematography, photorealistic 8K UHD`;
      }
      return {
        ...c,
        master_prompt: mp,
      };
    });

    // Auto-correct caption if missing subject (use cleanTitle, clean text without #)
    if (cleanTitle.trim().length > 0 && !hasCaptionRelevance) {
      correctedCaption = `${cleanTitle} — ${correctedCaption}`;
    }

    correctedCaption = cleanInlineHashtagsFromSentence(correctedCaption);

    return {
      qcResult: {
        passed,
        total_score: totalScore,
        breakdown: {
          product_consistency: Math.min(100, Math.max(0, productScore)),
          prompt_quality: Math.min(100, Math.max(0, promptScore)),
          caption_match: Math.min(100, Math.max(0, captionScore)),
          hashtag_validation: Math.min(100, Math.max(0, hashtagScore)),
          scene_timing: Math.min(100, Math.max(0, timingScore)),
          audio_visual_match: Math.min(100, Math.max(0, audioScore)),
        },
        issues,
      },
      correctedCaption,
      correctedHashtags: validatedTags,
      correctedClips,
    };
  }
}

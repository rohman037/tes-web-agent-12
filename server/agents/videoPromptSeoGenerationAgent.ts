import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';
import {
  ViralAnalysisData,
  ProductAnalysisData,
  AdaptedConceptData,
  ReplicaClip,
  SeoData,
} from '@/server/types/replicaVideo.types';
import { RawClipData } from './adaptationScriptGenerationAgent';
import fs from 'fs';
import path from 'path';

export interface VideoPromptSeoInput {
  viralAnalysis: ViralAnalysisData;
  productAnalysis: ProductAnalysisData;
  adaptedConcept: AdaptedConceptData;
  storyboard: {
    total_duration_seconds: number;
    split_duration_seconds: number;
    clips: RawClipData[];
  };
  targetAI?: string;
  enableTextOverlay: boolean;
  customApiKey?: string;
  clientAccessCode?: string;
  preferredModel?: string;
  qcRefinementDirectives?: string;
}

export interface VideoPromptSeoOutput {
  seo: SeoData;
  clips: ReplicaClip[];
  modelUsed: string;
}

let cachedSkillText = '';
function getSkillPrompt(): string {
  if (cachedSkillText) return cachedSkillText;
  try {
    const skillPath = path.join(process.cwd(), 'server', 'ai', 'skills', 'video-prompt-seo-generation.skill.md');
    if (fs.existsSync(skillPath)) {
      cachedSkillText = fs.readFileSync(skillPath, 'utf8');
      return cachedSkillText;
    }
  } catch (err) {
    logger.warn('[VideoPromptSeoAgent] Could not read skill file from disk, using fallback prompt');
  }
  return `Anda adalah AI Prompt Engineer dan Social Video SEO Strategist. Hasilkan master prompt AI video per klip, detail prompt scene, caption relevan, dan hashtag produk spesifik (DILARANG #fyp). Output WAJIB JSON murni {"seo": {...}, "clips": [...]}.`;
}

export async function runVideoPromptSeoGenerationAgent(
  input: VideoPromptSeoInput
): Promise<VideoPromptSeoOutput> {
  const {
    viralAnalysis,
    productAnalysis,
    adaptedConcept,
    storyboard,
    targetAI = 'general',
    enableTextOverlay,
  } = input;

  logger.info(
    `[VideoPromptSeoAgent] Starting Agent 3: Video Prompt & SEO Generation for ${storyboard.clips.length} clips...`
  );

  const skillPrompt = getSkillPrompt();

  const promptText = `${skillPrompt}

=== DATA INPUT DARI AGENT 1 & 2 ===
VIRAL DNA:
- Visual Style: ${viralAnalysis.visual_style}
- Camera Style: ${viralAnalysis.camera_style}
- Audio Style: ${viralAnalysis.audio_style}
- Hook Formula: ${viralAnalysis.hook}

PRODUCT DNA:
- Nama Produk: ${productAnalysis.product_name}
- Kategori: ${productAnalysis.category}
- Target Audiens: ${productAnalysis.target_audience}
- Selling Angle Utama: ${productAnalysis.selling_angle_primary}
- Keyword Inti: ${productAnalysis.keyword_core.join(', ')}
- Keyword Niche: ${productAnalysis.keyword_niche.join(', ')}
- Value Proposition: ${productAnalysis.value_proposition}

ADAPTED CONCEPT:
- Judul Konsep: ${adaptedConcept.concept_title}
- Ringkasan Konsep: ${adaptedConcept.concept_summary}
- Hook Strategy: ${adaptedConcept.hook_strategy}
- CTA Strategy: ${adaptedConcept.cta_strategy}

STORYBOARD KLIP & SCENE DARI AGENT 2:
${JSON.stringify(storyboard.clips, null, 2)}

=== PARAMETER GENERASI ===
- Target AI Video Generator: ${targetAI.toUpperCase()} (e.g. Veo 2, Runway Gen-3, Sora, Kling)
- Text Overlay Aktif: ${enableTextOverlay ? 'YA' : 'TIDAK'}

ATURAN WAJIB:
1. HASHTAG: Berikan 5–8 hashtag yang 100% RELEVAN DENGAN PRODUK & NICHE (contoh jika produk keset kucing: #kesetkucing #pecintakucing #dekorasirumah #alaskaki). DILARANG KERAS menggunakan #fyp, #viral, #foryou, #trending, #tiktok, #explore, #masukberanda!
2. CAPTION: Buat caption storytelling 3–5 paragraf pendek berbahasa Indonesia yang sangat natural, ramah, mengalir persuasif (bukan hard-selling kaku), menyentuh masalah audiens, dan menyisipkan 2-3 kata kunci produk secara organik dengan CTA halus di akhir.
3. MASTER PROMPT KLIP: Buat master prompt bahasa Inggris tingkat sinematik profesional 40–80 kata per klip untuk generator ${targetAI.toUpperCase()}. Wajib spesifik: subjek produk & aksinya, tekstur material, pencahayaan (studio/natural volumetric), sudut & pergerakan kamera, dan framing 9:16 vertical 8k photorealistic.
4. SCENE BREAKDOWN & COPY TEXT: Setiap klip wajib memiliki rincian scene lengkap dengan arahan Visual nyata, Aksi fisik presisi, Kamera optik, Audio ASMR/Sound design, Text Overlay (jika aktif), dan Dialogue VO. Buat field copy_text_scene dan copy_text_full siap salin rapi.
5. Kembalikan HANYA JSON valid sesuai struktur yang diminta.${
  input.qcRefinementDirectives
    ? `\n\n=== ⚠️ PERBAIKAN DARI QUALITY CONTROL (WAJIB DIPERBAIKI) ===\n${input.qcRefinementDirectives}`
    : ''
}`;

  const response = await executeAiTask({
    taskType: 'video_prompt_seo_generation',
    contents: [{ text: promptText }],
    config: {
      temperature: 0.35,
      responseMimeType: 'application/json',
    },
    preferredModel: input.preferredModel,
    customApiKey: input.customApiKey,
    clientAccessCode: input.clientAccessCode,
  });

  let rawJson = response.text.trim();
  rawJson = rawJson.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

  let parsed: any;
  try {
    parsed = JSON.parse(rawJson);
  } catch (err) {
    logger.warn('[VideoPromptSeoAgent] JSON.parse failed, attempting JSON extraction regex...', err);
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Gagal membaca respons prompt & SEO Agent 3: Format JSON tidak valid`);
    }
  }

  // Comprehensive ban list for generic / spam social hashtags
  const BANNED_GENERIC_TAGS = new Set([
    '#fyp', '#fypシ', '#fypviral', '#foryou', '#foryoupage', '#foru',
    '#viral', '#viralvideo', '#viraltiktok', '#trend', '#trending', '#trendingvideo',
    '#xyzbca', '#masukberanda', '#beranda', '#tiktok', '#tik_tok', '#tiktokshop',
    '#explore', '#explorepage', '#reels', '#indonesia', '#like', '#follow',
    '#videoviral', '#trendingtopic', '#fypppppppppppppp'
  ]);

  const rawHashtags: string[] = Array.isArray(parsed?.seo?.hashtags)
    ? parsed.seo.hashtags
    : [];
  
  let cleanHashtags = rawHashtags
    .map((tag: string) => {
      let t = String(tag).trim();
      if (!t.startsWith('#')) t = `#${t}`;
      return t;
    })
    .filter((tag: string) => {
      const lower = tag.toLowerCase();
      return !BANNED_GENERIC_TAGS.has(lower) && lower.length > 2;
    });

  // If filtered hashtags are empty or fewer than 4, generate niche-specific ones from product & niche keywords
  if (cleanHashtags.length < 4) {
    const productTag = `#${productAnalysis.product_name.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    const categoryTag = `#${productAnalysis.category.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`;
    const coreTags = (productAnalysis.keyword_core || []).map(
      (k) => `#${k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
    );
    const nicheTags = (productAnalysis.keyword_niche || []).map(
      (k) => `#${k.replace(/[^a-zA-Z0-9]/g, '').toLowerCase()}`
    );

    const candidates = [productTag, categoryTag, ...coreTags, ...nicheTags];
    for (const cand of candidates) {
      if (cand.length > 3 && !BANNED_GENERIC_TAGS.has(cand) && !cleanHashtags.includes(cand)) {
        cleanHashtags.push(cand);
      }
      if (cleanHashtags.length >= 6) break;
    }
  }

  const seoData: SeoData = {
    caption:
      parsed?.seo?.caption ||
      `Rahasia yang bikin ${productAnalysis.product_name} jadi andalan banyak orang! Ternyata ${productAnalysis.selling_angle_primary.toLowerCase()}. Yuk buktikan sendiri sekarang sebelum kehabisan!`,
    hashtags: cleanHashtags.slice(0, 8),
    keywords_used: Array.isArray(parsed?.seo?.keywords_used) && parsed.seo.keywords_used.length > 0
      ? parsed.seo.keywords_used
      : productAnalysis.keyword_core.slice(0, 5),
  };

  const generatedClips: ReplicaClip[] = [];
  const rawClipsList = Array.isArray(parsed?.clips) ? parsed.clips : [];

  storyboard.clips.forEach((sbClip, idx) => {
    const genClip = rawClipsList[idx] || rawClipsList.find((c: any) => c.clip_number === sbClip.clip_number) || {};
    
    const startSec = sbClip.start_second;
    const endSec = sbClip.end_second;
    const durationLabel = `${startSec}–${endSec} detik`;

    const scenes = (Array.isArray(genClip.scenes) && genClip.scenes.length > 0 ? genClip.scenes : sbClip.scenes).map(
      (sc: any, sIdx: number) => {
        const scNum = sIdx + 1;
        const visual = sc.visual || sc.visual_direction || `Visual ${productAnalysis.product_name}`;
        const action = sc.action || sc.action_direction || `Aksi pada klip ${sbClip.clip_number}`;
        const camera = sc.camera || sc.camera_direction || viralAnalysis.camera_style || 'Cinematic tracking';
        const audio = sc.audio || sc.audio_direction || viralAnalysis.audio_style || 'Texture ASMR';
        const textOverlay = enableTextOverlay ? (sc.text_overlay || '') : '';
        const dialogue = sc.dialogue_or_subtitle || '';
        const goal = sc.scene_goal || '';

        const copyTextScene = sc.copy_text_scene || [
          `[Scene ${scNum} (${sc.start_second ?? startSec}-${sc.end_second ?? endSec}s)]`,
          `Visual: ${visual}`,
          `Aksi: ${action}`,
          `Kamera: ${camera}`,
          `Audio: ${audio}`,
          textOverlay ? `Text Overlay: "${textOverlay}"` : '',
          dialogue ? `Voice Over: "${dialogue}"` : '',
        ].filter(Boolean).join('\n');

        return {
          scene_number: scNum,
          start_second: typeof sc.start_second === 'number' ? sc.start_second : startSec,
          end_second: typeof sc.end_second === 'number' ? sc.end_second : endSec,
          visual,
          action,
          camera,
          audio,
          text_overlay: textOverlay,
          dialogue_or_subtitle: dialogue,
          scene_goal: goal,
          copy_text_scene: copyTextScene,
        };
      }
    );

    const masterPrompt =
      genClip.master_prompt ||
      `Cinematic vertical 9:16 commercial video of ${productAnalysis.product_name}, featuring tactile interaction and authentic product demonstration. Detailed product materials with realistic reflections, ${viralAnalysis.visual_style || 'crisp studio lighting with natural daylight highlights'}, ${viralAnalysis.camera_style || 'smooth dynamic tracking push-in shot at f/2.0'}, high-end commercial color grading, 8k resolution, photorealistic cinematic realism, clean composition.`;

    const copyTextFull = genClip.copy_text_full || [
      `=== SEGMENT PROMPT KLIP ${sbClip.clip_number} (${durationLabel}) ===`,
      `[Master Prompt AI Video (${targetAI.toUpperCase()})]:`,
      masterPrompt,
      `\n[Breakdown Scene]:`,
      ...scenes.map((s: any) => s.copy_text_scene),
    ].join('\n');

    generatedClips.push({
      clip_number: sbClip.clip_number,
      start_second: startSec,
      end_second: endSec,
      duration_label: durationLabel,
      master_prompt: masterPrompt,
      copy_text_full: copyTextFull,
      scenes,
    });
  });

  return {
    seo: seoData,
    clips: generatedClips,
    modelUsed: response.modelUsed,
  };
}

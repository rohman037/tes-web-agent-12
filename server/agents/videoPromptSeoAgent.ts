import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';
import { ProductIntelligenceOutput } from './productIntelligenceAgent';
import { ContentStrategyOutput } from './contentStrategyAgent';

export interface MicroSceneClip {
  clip_number: number;
  duration: string;
  start_time?: number;
  end_time?: number;
  stage_label?: string;
  visual: string;
  action: string;
  camera: string;
  lens: string;
  lighting: string;
  audio: string;
  text_overlay: string;
  voice_over?: string;
  prompt: string;
}

export interface CaptionSeoOutput {
  caption: string;
  keyword_used: string[];
}

export interface VideoPromptSeoOutput {
  master_video_prompt: string;
  negative_prompt: string;
  micro_scene_breakdown: MicroSceneClip[];
  clips: MicroSceneClip[]; // alias for compatibility
  caption_seo: CaptionSeoOutput;
  hashtags: string[];
  seo: {
    caption: string;
    hashtags: string[];
    keywords: string[];
  };
}

export interface VideoPromptSeoInput {
  productIntelligence: ProductIntelligenceOutput;
  contentStrategy: ContentStrategyOutput;
  totalDurationSeconds?: number;
  splitDurationSeconds?: number; // 5, 8, 10, 15, or totalDuration
  targetAI?: string; // SORA, KLING, RUNWAY, VEO, GENERAL
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  preferredModel?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

const SYSTEM_INSTRUCTION = `Anda adalah "Agent 3: Video Prompt + SEO Agent V2" dari sistem AI PRODUCT COMMERCIAL GENERATOR V2.
Tugas Anda adalah memproduksi output siap produksi yang meliputi:
1. MASTER VIDEO PROMPT (Sinematik 11 Elemen Standar Internasional mengunci visual_anchor produk)
2. MICRO SCENE BREAKDOWN (Pecahan klip berdurasi presisi sesuai split duration user)
3. CAPTION SEO (Natural, berkonversi tinggi, kaya keyword, tanpa klaim murahan/clickbait)
4. HASHTAG INTELLIGENCE ENGINE (Maksimal dan Tepat 5 Hashtag dengan formula ranking)

PEDOMAN KHUSUS SETIAP BAGIAN:

========================================
1. MASTER VIDEO PROMPT (Bahasa Inggris)
========================================
Wajib mengikuti susunan formula 11 elemen sinematik yang mengunci VISUAL ANCHOR produk:
[VIDEO STYLE] + [SUBJECT] + [PRODUCT DETAIL] + [ENVIRONMENT] + [ACTION] + [CAMERA] + [LENS] + [LIGHTING] + [AUDIO] + [MOTION] + [QUALITY DETAIL]

- Subject & Product Detail WAJIB merujuk pada visual_anchor (shape, color, material, texture, unique_detail) dari Agent 1 agar warna dan model produk TIDAK PERNAH BERGESER.
- DILARANG KERAS menggunakan frasa generik seperti "create viral video", "make it attractive", atau "high quality video".

========================================
2. MICRO SCENE BREAKDOWN
========================================
Pecah total durasi menjadi sejumlah klip sesuai interval split yang diminta.
Setiap klip WAJIB menyertakan:
- clip_number (1, 2, 3...)
- duration (misal "0-10s", "10-20s")
- visual (deskripsi adegan visual)
- action (aksi fisik produk & model)
- camera (tipe shot & gerakan kamera)
- lens (spesifikasi lensa)
- lighting (pencahayaan studio)
- audio (sound effect foley)
- text_overlay (teks singkat di layar)
- prompt (Prompt AI Video Bahasa Inggris berstruktur lengkap untuk Sora, Kling, Runway, Veo)

========================================
3. CAPTION SEO (Bahasa Indonesia)
========================================
- Menjelaskan value nyata dan menjawab kenapa konsumen butuh produk ini.
- Memuat Primary Product Keyword & Secondary Keyword secara alami.
- DILARANG KERAS menggunakan kata murahan/clickbait seperti "produk viral banget", "wajib beli guys", "auto FYP".

========================================
4. HASHTAG INTELLIGENCE ENGINE (Tepat 5 Hashtag)
========================================
Gunakan formula ranking relevansi pencarian:
- 40% (2 Tag): Product Keyword (e.g. #PortableBlender, #BlenderMini)
- 30% (1 Tag): Category Keyword (e.g. #PeralatanDapur)
- 20% (1 Tag): Audience Keyword (e.g. #AnakKosSehat atau #GymLifestyle)
- 10% (1 Tag): Search Intent Keyword (e.g. #TipsJusPraktis)

BANNED HASHTAGS (STRICTLY PROHIBITED):
#fyp, #viral, #trending, #foryou, #foryoupage, #explore, #trend, #xyzbca, #masukberanda.

WAJIB MENGEMBALIKAN FORMAT JSON MURNI:
{
  "master_video_prompt": "string",
  "negative_prompt": "blurry, low quality, deformed, distorted, watermark, oversaturated, amateur footage, glitch",
  "micro_scene_breakdown": [
    {
      "clip_number": 1,
      "duration": "0-10s",
      "visual": "string",
      "action": "string",
      "camera": "string",
      "lens": "string",
      "lighting": "string",
      "audio": "string",
      "text_overlay": "string",
      "prompt": "string"
    }
  ],
  "caption_seo": {
    "caption": "string",
    "keyword_used": ["string"]
  },
  "hashtags": ["#Tag1", "#Tag2", "#Tag3", "#Tag4", "#Tag5"]
}`;

export async function runVideoPromptSeoAgent(
  input: VideoPromptSeoInput
): Promise<VideoPromptSeoOutput> {
  logger.info('[VideoPromptSeoAgent] Running Video Prompt + SEO Agent V2 (Agent 3)...');

  const {
    productIntelligence,
    contentStrategy,
    totalDurationSeconds = 60,
    splitDurationSeconds = 10,
    targetAI = 'GENERAL',
  } = input;

  const pIdentity = productIntelligence.product_identity;
  const vAnchor = productIntelligence.visual_anchor;
  const pSeo = productIntelligence.seo_keywords;
  const cFormula = contentStrategy.content_formula;
  const rIntel = contentStrategy.retention_intelligence;
  const cScript = contentStrategy.script;

  const expectedClipCount = Math.max(1, Math.ceil(totalDurationSeconds / splitDurationSeconds));

  const userPrompt = `Hasilkan Master Video Prompt V2, Micro Scene Breakdown (${expectedClipCount} klip dengan interval split ~${splitDurationSeconds}s), Caption SEO, dan 5 Hashtag Relevansi Tinggi untuk produk berikut:

[DATA & VISUAL ANCHOR PRODUK]:
- Nama: ${pIdentity.name}
- Kategori: ${pIdentity.category}
- Brand: ${pIdentity.brand}
- Visual Anchor Wajib: Shape: "${vAnchor.shape}", Color: "${vAnchor.color}", Material: "${vAnchor.material}", Texture: "${vAnchor.texture}", Unique Detail: "${vAnchor.unique_detail}"
- Fitur Kunci: ${pIdentity.features.join(', ')}
- Keuntungan (Benefits): ${productIntelligence.features_and_benefits.benefits.join(', ')}

[STRATEGI & SCRIPT V2]:
- Formula Konten: ${cFormula.formula} (${cFormula.reason})
- Hook (0-3s): "${rIntel.hook}" | Trigger: ${rIntel.retention_trigger}
- Story Structure: ${JSON.stringify(contentStrategy.story_structure)}
- Full Voice Over: ${cScript.voice_over}
- CTA: ${cScript.cta}
- Audio Mood: ${cScript.audio_mood}

[PARAMETER TEKNIS]:
- Total Durasi: ${totalDurationSeconds} detik
- Interval Split Per Klip: ${splitDurationSeconds} detik (Hasilkan tepat ${expectedClipCount} klip)
- Target Generator AI: ${targetAI} (Optimalkan prompt visual dalam Bahasa Inggris untuk generator ini)
- Target Keywords: Primary: "${pSeo.primary}", Secondary: "${pSeo.secondary}", Category: "${pSeo.category}", Problem: "${pSeo.problem}", Intent: "${pSeo.buying_intent}"

Hasilkan output JSON murni lengkap.`;

  const contents: any[] = [];

  if (input.referenceImageBase64) {
    const cleanBase64 = input.referenceImageBase64.replace(/^data:[^;]+;base64,/, '');
    contents.push({
      inlineData: {
        mimeType: input.referenceImageMimeType || 'image/jpeg',
        data: cleanBase64,
      },
    });
  }

  contents.push(userPrompt);

  const response = await executeAiTask({
    taskType: 'video_prompt_seo',
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.25,
      responseMimeType: 'application/json',
    },
    preferredModel: input.preferredModel,
    customApiKey: input.customApiKey,
    clientAccessCode: input.clientAccessCode,
  });

  try {
    let cleanJson = response.text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/, '').replace(/```\s*$/, '');
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/, '').replace(/```\s*$/, '');
    }

    const parsed: any = JSON.parse(cleanJson);

    // Extract hashtags & sanitize against banned tags
    let rawTags: string[] = [];
    if (Array.isArray(parsed.hashtags)) {
      rawTags = parsed.hashtags;
    } else if (Array.isArray(parsed.seo?.hashtags)) {
      rawTags = parsed.seo.hashtags;
    }

    let sanitizedHashtags = rawTags
      .map((tag) => (tag.startsWith('#') ? tag : `#${tag}`))
      .filter((tag) => {
        const lower = tag.toLowerCase();
        return !['#fyp', '#viral', '#trending', '#foryou', '#foryoupage', '#explore', '#trend', '#xyzbca', '#masukberanda'].includes(lower);
      })
      .slice(0, 5);

    // Backfill if less than 5 hashtags
    const fallbackNicheTags = [
      `#${pIdentity.name.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#${pSeo.primary.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#${pIdentity.category.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#Rekomendasi${pIdentity.name.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#${pSeo.buying_intent.replace(/[^a-zA-Z0-9]/g, '')}`,
    ].filter(Boolean);

    for (const tag of fallbackNicheTags) {
      if (sanitizedHashtags.length >= 5) break;
      if (!sanitizedHashtags.some((t) => t.toLowerCase() === tag.toLowerCase())) {
        sanitizedHashtags.push(tag);
      }
    }

    // Process micro scene clips
    const rawClips = Array.isArray(parsed.micro_scene_breakdown)
      ? parsed.micro_scene_breakdown
      : Array.isArray(parsed.clips)
      ? parsed.clips
      : [];

    const normalizedClips: MicroSceneClip[] = rawClips.length > 0
      ? rawClips.map((c: any, i: number) => {
          const sTime = typeof c.start_time === 'number' ? c.start_time : i * splitDurationSeconds;
          const eTime = typeof c.end_time === 'number' ? c.end_time : Math.min((i + 1) * splitDurationSeconds, totalDurationSeconds);
          return {
            clip_number: c.clip_number || i + 1,
            duration: c.duration || `${sTime}-${eTime}s`,
            start_time: sTime,
            end_time: eTime,
            stage_label: c.stage_label || (i === 0 ? 'HOOK' : i === rawClips.length - 1 ? 'CTA' : 'DEMO'),
            visual: c.visual || `Visual adegan klip ${i + 1} memperlihatkan ${pIdentity.name} dengan warna ${vAnchor.color}`,
            action: c.action || `Aksi penggunaan ${pIdentity.name}`,
            camera: c.camera || 'Medium Close-Up Tracking Push-in',
            lens: c.lens || '35mm Prime Lens f/1.8',
            lighting: c.lighting || 'Soft Commercial Studio Lighting',
            audio: c.audio || 'Crisp tactile foley sound effect',
            text_overlay: c.text_overlay || pIdentity.name,
            voice_over: c.voice_over || cScript.voice_over.slice(0, 80),
            prompt: c.prompt || `Ultra realistic 8K cinematic video clip of ${pIdentity.name}, ${vAnchor.color} color, ${vAnchor.material} material, commercial lighting.`,
          };
        })
      : [
          {
            clip_number: 1,
            duration: `0-${Math.min(splitDurationSeconds, totalDurationSeconds)}s`,
            start_time: 0,
            end_time: Math.min(splitDurationSeconds, totalDurationSeconds),
            stage_label: 'HOOK',
            visual: `Dynamic macro close-up shot of ${pIdentity.name} in ${vAnchor.color} ${vAnchor.material}`,
            action: `Introducing ${pIdentity.name} with instant visual impact`,
            camera: 'Macro Close-Up Orbital Push-in',
            lens: '35mm f/1.8 Anamorphic',
            lighting: 'Commercial studio soft light with rim highlight',
            audio: 'Punchy whoosh and tactile foley click',
            text_overlay: rIntel.hook.slice(0, 45),
            voice_over: rIntel.hook,
            prompt: `Ultra realistic 8K cinematic commercial hook shot of ${pIdentity.name}, ${vAnchor.color} ${vAnchor.material}, dramatic lighting, smooth motion.`,
          },
        ];

    const masterPromptFallback = `Ultra realistic 8K commercial product advertisement video, master cinematography. Subject: ${pIdentity.name}, constructed from ${vAnchor.material} in ${vAnchor.color} finish, featuring ${vAnchor.shape} form factor and ${vAnchor.unique_detail}. Environment: sunlit modern luxury marble kitchen counter. Action: elegant demonstration of ${pIdentity.name} in seamless operation. Camera: dynamic orbital tracking push-in. Lens: 35mm anamorphic prime lens f/1.8, shallow depth of field. Lighting: soft diffused 3-point studio lighting with golden rim highlight. Audio: crisp tactile foley sound cues and modern lo-fi acoustic rhythm. Motion: smooth 24fps fluid physics. Quality: photorealistic UHD 8K, ray-traced reflections.`;

    const captionText = parsed.caption_seo?.caption || parsed.seo?.caption || `Bikin rutinitas harian kamu jauh lebih praktis dengan ${pIdentity.name}! Desain ringkas, material ${vAnchor.material}, dan mudah dipakai kapan saja. Cek produk originalnya di keranjang sekarang!`;

    const keywordsUsed = Array.isArray(parsed.caption_seo?.keyword_used)
      ? parsed.caption_seo.keyword_used
      : Array.isArray(parsed.seo?.keywords)
      ? parsed.seo.keywords
      : [pSeo.primary, pSeo.secondary];

    return {
      master_video_prompt: parsed.master_video_prompt || masterPromptFallback,
      negative_prompt: parsed.negative_prompt || 'blurry, low quality, deformed, distorted, watermark, oversaturated, amateur footage, glitch, low resolution',
      micro_scene_breakdown: normalizedClips,
      clips: normalizedClips,
      caption_seo: {
        caption: captionText,
        keyword_used: keywordsUsed,
      },
      hashtags: sanitizedHashtags.slice(0, 5),
      seo: {
        caption: captionText,
        hashtags: sanitizedHashtags.slice(0, 5),
        keywords: keywordsUsed,
      },
    };
  } catch (err: any) {
    logger.error(`[VideoPromptSeoAgent] JSON parse error: ${err.message}. Raw text: ${response.text.slice(0, 200)}`);
    const fallbackHashtags = [
      `#${pIdentity.name.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#${pSeo.primary.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#${pIdentity.category.replace(/[^a-zA-Z0-9]/g, '')}`,
      `#RekomendasiProduk`,
      `#AlatPraktis`,
    ];
    const fallbackClips: MicroSceneClip[] = [
      {
        clip_number: 1,
        duration: `0-${splitDurationSeconds}s`,
        start_time: 0,
        end_time: splitDurationSeconds,
        stage_label: 'HOOK',
        visual: `Macro close-up shot of ${pIdentity.name}`,
        action: `Demonstrating ${pIdentity.name}`,
        camera: 'Medium Close-up Tracking',
        lens: '35mm f/1.8',
        lighting: 'Soft commercial daylight',
        audio: 'Crisp click sound',
        text_overlay: pIdentity.name,
        voice_over: rIntel.hook,
        prompt: `Cinematic 8K commercial shot of ${pIdentity.name}, ${vAnchor.color} color, photorealistic, studio lighting.`,
      },
    ];
    const fallbackCaption = `Bikin hari kamu jauh lebih praktis dengan ${pIdentity.name}. Desain ringkas, awet, dan serbaguna harian. Dapatkan produk originalnya di keranjang sekarang!`;

    return {
      master_video_prompt: `Ultra realistic 8K commercial product advertisement video of ${pIdentity.name}. Subject: ${pIdentity.name} in ${vAnchor.color} color, ${vAnchor.material} material. Environment: modern clean lifestyle aesthetic. Action: smooth product usage demonstration. Camera: cinematic slow glide tracking. Lens: 35mm f/1.8. Lighting: soft commercial studio illumination. Audio: crisp foley cues. Motion: 24fps film cadence. Quality: photorealistic 8K UHD.`,
      negative_prompt: 'blurry, low quality, deformed, distorted, watermark, amateur footage',
      micro_scene_breakdown: fallbackClips,
      clips: fallbackClips,
      caption_seo: {
        caption: fallbackCaption,
        keyword_used: [pSeo.primary, pSeo.secondary],
      },
      hashtags: fallbackHashtags,
      seo: {
        caption: fallbackCaption,
        hashtags: fallbackHashtags,
        keywords: [pSeo.primary, pSeo.secondary],
      },
    };
  }
}

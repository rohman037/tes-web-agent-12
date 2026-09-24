import crypto from 'crypto';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { promptResponseCache, PROMPT_CACHE_TTL_MS } from '@/server/core/state/serverState';
import { logger } from '@/server/core/utils/logger';
import {
  cleanSubjectTitle,
  cleanInlineHashtagsFromSentence,
  generateProductRelevantHashtags,
} from '@/server/core/utils/sanitizer';
import { runVideoToPromptPipeline } from '@/server/workflows/video-to-prompt/service';

export const VIDEO_PROMPT_SYSTEM_INSTRUCTION = `Analyze the supplied video once as a professional video reverse-engineering system.
You MUST output ONLY valid JSON matching the specified schema.
Do not output any markdown code blocks, introductory text, explanations, or commentary outside the JSON object.

CORE RULES:
1. FACTUAL OBSERVATION: Describe strictly what is visibly and audibly present in the video. Do not hallucinate fictitious brand names, imaginary actions, or unobserved events.
2. TIMELINE & CONTINUITY: Accurately trace the chronological timeline from 0.0s to the end of the video. Identify natural shot boundaries based on visual cuts or scene transitions.
3. IDENTITY CONSISTENCY: Define global subject identity (appearance, attire) and product identity once in the "global" section. In individual shots, only describe real observable changes and actions.
4. CAMERA & LIGHTING: Note real camera framing (e.g. close-up, medium shot, wide shot), real movement (static, slow pan, handheld, push-in), and actual lighting conditions.
5. AUDIO & DIALOGUE: Transcribe spoken words verbatim. If no clear voice is heard, leave dialogue empty or note "tidak terdengar suara dialog". Do not invent fictitious dialogue.
6. GENERATION PROMPT: For each shot, provide a concise, high-fidelity prompt ready for AI video generators (Runway, Sora, Kling, Luma, Hailuo) capturing the essence of the shot.`;

export interface StructuredShot {
  startSec: number;
  endSec: number;
  scene?: string;
  subject?: string;
  product?: string;
  actions?: string[];
  dialogue?: string;
  voiceTiming?: string;
  onScreenText?: string;
  cameraChange?: string;
  lightingChange?: string;
  transition?: string;
  continuity?: string;
  generationPrompt?: string;
}

export interface StructuredVideoAnalysis {
  global: {
    style: string;
    visualAesthetic: string;
    mood: string;
    aspectRatio?: string;
    subjectIdentity?: string;
    productIdentity?: string;
    environment?: string;
  };
  cinematography: {
    camera: string;
    framing: string;
    lens?: string;
    cameraMovement: string;
    focus?: string;
    lighting: string;
    color: string;
  };
  audio: {
    music?: string;
    dialogue?: string;
    voiceOver?: string;
    soundEffects?: string;
  };
  shots: StructuredShot[];
  caption?: string;
  hashtags?: string;
}

export function buildVideoPromptCacheKey(options: {
  mimeType: string;
  base64Data: string;
  model?: string;
  analysisMode?: string;
  targetAI?: string;
  segmentDuration?: string;
  cinematicStyle?: string;
  includeActions?: boolean;
  includeVoiceOver?: boolean;
  includeCinematics?: boolean;
  sourceCaption?: string;
}): string {
  const contentHash = crypto.createHash('sha256').update(options.base64Data).digest('hex').slice(0, 32);
  const schemaVersion = 'video-prompt-v4';
  const rawKey = [
    schemaVersion,
    options.mimeType,
    options.base64Data.length,
    contentHash,
    options.model || 'auto',
    options.analysisMode || 'deep',
    options.targetAI || 'general',
    options.segmentDuration || '5',
    options.cinematicStyle || 'cinematic',
    options.includeActions !== false ? '1' : '0',
    options.includeVoiceOver !== false ? '1' : '0',
    options.includeCinematics !== false ? '1' : '0',
    (options.sourceCaption || '').slice(0, 50),
  ].join('::');
  return crypto.createHash('sha256').update(rawKey).digest('hex');
}

export function cleanTimelineOutput(text: string): string {
  if (!text) return '';
  let cleaned = text.trim();
  // Strip code fences if wrapped in ```json or ```markdown
  cleaned = cleaned.replace(/^```(?:json|markdown|text)?\n?/i, '').replace(/\n?```$/i, '').trim();

  // Strip trailing notes if any
  const noteMatch = cleaned.search(/(?:\n\s*##\s*Catatan|\n\s*Demikian|\n\s*Semoga bermanfaat)/i);
  if (noteMatch > 0) {
    cleaned = cleaned.slice(0, noteMatch).trim();
  }

  return cleaned;
}

export interface GeneratePromptOptions {
  mimeType: string;
  base64Data: string;
  model?: string;
  analysisMode?: 'fast' | 'deep';
  targetAI?: string;
  segmentDuration?: string;
  cinematicStyle?: string;
  includeActions?: boolean;
  includeVoiceOver?: boolean;
  includeCinematics?: boolean;
  sourceCaption?: string;
  sourceUrl?: string;
  actualDuration?: number;
  customApiKey?: string;
  clientAccessCode?: string;
  useCache?: boolean;
}

/**
 * Local TypeScript Partitioner & Formatter:
 * Partitions natural shots into requested intervals (5s, 8s, 10s, 15s, or 'auto' natural boundaries)
 * WITHOUT forcing AI to hallucinate artificial actions.
 */
export function partitionAndFormatStructuredAnalysis(
  analysis: StructuredVideoAnalysis,
  options: {
    segmentDuration: string;
    actualDuration?: number;
    targetAI?: string;
    includeActions?: boolean;
    includeVoiceOver?: boolean;
    includeCinematics?: boolean;
  }
): { formattedPrompt: string; finalStructured: StructuredVideoAnalysis } {
  const isAuto = options.segmentDuration === 'auto';
  const bucketSec = isAuto ? 0 : parseInt(options.segmentDuration, 10) || 5;

  let totalDuration = 0;
  if (options.actualDuration && options.actualDuration > 0) {
    totalDuration = Math.round(options.actualDuration);
  } else if (Array.isArray(analysis.shots) && analysis.shots.length > 0) {
    totalDuration = Math.max(...analysis.shots.map((s) => s.endSec || 0));
  }
  if (totalDuration <= 0) totalDuration = 30; // sensible fallback

  let partitionedShots: StructuredShot[] = [];

  if (isAuto || bucketSec <= 0) {
    // Preserve natural shots
    partitionedShots = (analysis.shots || []).map((s, idx) => ({
      ...s,
      startSec: s.startSec ?? idx * 5,
      endSec: s.endSec ?? (idx + 1) * 5,
    }));
  } else {
    // Partition timeline into regular buckets of bucketSec
    const numBuckets = Math.max(1, Math.ceil(totalDuration / bucketSec));
    for (let i = 0; i < numBuckets; i++) {
      const bStart = i * bucketSec;
      const bEnd = Math.min(totalDuration, (i + 1) * bucketSec);
      if (bStart >= totalDuration) break;

      // Find overlapping shots from raw analysis
      const overlapping = (analysis.shots || []).filter(
        (s) => (s.startSec < bEnd && s.endSec > bStart) || (s.startSec >= bStart && s.startSec < bEnd)
      );

      const combinedScene = overlapping.map((s) => s.scene).filter(Boolean).join(' ') || analysis.global?.style || 'Adegan video';
      const combinedSubject = overlapping.map((s) => s.subject).filter(Boolean)[0] || analysis.global?.subjectIdentity || '';
      const combinedProduct = overlapping.map((s) => s.product).filter(Boolean)[0] || analysis.global?.productIdentity || '';

      const actionsList: string[] = [];
      if (options.includeActions !== false) {
        for (const s of overlapping) {
          if (Array.isArray(s.actions)) {
            actionsList.push(...s.actions);
          } else if (typeof s.actions === 'string' && s.actions) {
            actionsList.push(s.actions);
          }
        }
      }

      const dialogueList: string[] = [];
      if (options.includeVoiceOver !== false) {
        for (const s of overlapping) {
          if (s.dialogue && !dialogueList.includes(s.dialogue)) {
            dialogueList.push(s.dialogue);
          }
        }
      }

      const onScreenTextList = overlapping.map((s) => s.onScreenText).filter(Boolean);

      const genPrompt = overlapping.map((s) => s.generationPrompt).filter(Boolean)[0] ||
        `${analysis.global?.style || 'Cinematic video'}, ${combinedScene}, ${actionsList.slice(0, 2).join(', ')}`;

      partitionedShots.push({
        startSec: bStart,
        endSec: bEnd,
        scene: combinedScene,
        subject: combinedSubject,
        product: combinedProduct,
        actions: Array.from(new Set(actionsList)),
        dialogue: dialogueList.join(' ') || '',
        onScreenText: onScreenTextList.join(' ') || '',
        generationPrompt: genPrompt,
      });
    }
  }

  // Format into pristine human-readable Markdown
  const lines: string[] = [];

  // Global Style
  lines.push('### 🎬 Style & Visual');
  if (analysis.global?.style) lines.push(`**Style:** ${analysis.global.style}`);
  if (analysis.global?.visualAesthetic) lines.push(`**Aesthetic:** ${analysis.global.visualAesthetic}`);
  if (analysis.global?.mood) lines.push(`**Mood:** ${analysis.global.mood}`);
  if (analysis.global?.subjectIdentity) lines.push(`**Subject:** ${analysis.global.subjectIdentity}`);
  if (analysis.global?.productIdentity) lines.push(`**Product:** ${analysis.global.productIdentity}`);
  if (analysis.global?.environment) lines.push(`**Environment:** ${analysis.global.environment}`);
  lines.push('');

  // Cinematography (if enabled)
  if (options.includeCinematics !== false && analysis.cinematography) {
    lines.push('### 🎥 Cinematography');
    if (analysis.cinematography.camera) lines.push(`- **Camera:** ${analysis.cinematography.camera}`);
    if (analysis.cinematography.framing) lines.push(`- **Framing:** ${analysis.cinematography.framing}`);
    if (analysis.cinematography.lens) lines.push(`- **Lens:** ${analysis.cinematography.lens}`);
    if (analysis.cinematography.cameraMovement) lines.push(`- **Movement:** ${analysis.cinematography.cameraMovement}`);
    if (analysis.cinematography.lighting) lines.push(`- **Lighting:** ${analysis.cinematography.lighting}`);
    if (analysis.cinematography.color) lines.push(`- **Color:** ${analysis.cinematography.color}`);
    lines.push('');
  }

  // Timeline Shots
  lines.push('### ⏱️ Rincian Segmen Klip');
  for (const shot of partitionedShots) {
    lines.push(`${shot.startSec}–${shot.endSec} detik`);

    const visualDesc = shot.scene || shot.subject || analysis.global?.style || 'Visual adegan sinematik';
    lines.push(`Visual: ${visualDesc}`);

    if (options.includeActions !== false) {
      const actionsText = Array.isArray(shot.actions) && shot.actions.length > 0
        ? shot.actions.join('. ')
        : (typeof shot.actions === 'string' && shot.actions ? shot.actions : 'Subjek melakukan pergerakan adegan dengan natural');
      lines.push(`Aksi: ${actionsText}`);
    }

    if (options.includeVoiceOver !== false) {
      if (shot.dialogue && shot.dialogue.trim()) {
        lines.push(`voice over: ${shot.dialogue}`);
      } else if (shot.onScreenText && shot.onScreenText.trim()) {
        lines.push(`Subteks: ${shot.onScreenText}`);
      } else {
        lines.push(`voice over: (musik latar instrumental / tanpa dialog)`);
      }
    } else if (shot.onScreenText && shot.onScreenText.trim()) {
      lines.push(`Subteks: ${shot.onScreenText}`);
    }

    lines.push('');
  }

  // Caption & Hashtags (High Relevance Engine)
  const rawSubject = analysis.global?.productIdentity || analysis.global?.subjectIdentity || analysis.global?.style || 'Produk Pilihan';
  const cleanSubject = cleanSubjectTitle(rawSubject);
  const cleanCaption = cleanInlineHashtagsFromSentence(
    analysis.caption ||
      `Temukan solusi terbaik dengan ${cleanSubject}! Desain fungsional dengan kualitas optimal yang siap melengkapi kebutuhan harianmu. Simak detail lengkapnya dan dapatkan sekarang sebelum kehabisan.`
  );
  const relevantTags = generateProductRelevantHashtags(cleanSubject, analysis.global?.setting);
  const hashtagsString = analysis.hashtags ? cleanInlineHashtagsFromSentence(analysis.hashtags) : relevantTags.join(' ');

  lines.push('### 📱 CAPTION & HASHTAG');
  lines.push('**Caption SEO:**');
  lines.push(cleanCaption);
  lines.push('');
  lines.push('**Hashtags:**');
  lines.push(hashtagsString);
  lines.push('');

  const finalStructured: StructuredVideoAnalysis = {
    ...analysis,
    shots: partitionedShots,
  };

  // Embed structured data comment at bottom for pristine client parsing
  lines.push(`<!-- STRUCTURED_DATA:\n${JSON.stringify(finalStructured)}\n-->`);

  return {
    formattedPrompt: lines.join('\n'),
    finalStructured,
  };
}

export async function generateVideoPromptService(options: GeneratePromptOptions) {
  const {
    mimeType,
    base64Data,
    model,
    analysisMode = 'deep',
    targetAI = 'general',
    segmentDuration = '5',
    cinematicStyle = 'cinematic',
    includeActions = true,
    includeVoiceOver = true,
    includeCinematics = true,
    sourceCaption = '',
    sourceUrl = '',
    actualDuration,
    customApiKey,
    clientAccessCode,
    useCache = true,
  } = options;

  if (!base64Data || !mimeType) {
    throw new Error('Data video dan tipe MIME diperlukan');
  }

  // 1. Build unified cache key (consistent for both READ and WRITE)
  const cacheKey = buildVideoPromptCacheKey({
    mimeType,
    base64Data,
    model,
    analysisMode,
    targetAI,
    segmentDuration,
    cinematicStyle,
    includeActions,
    includeVoiceOver,
    includeCinematics,
    sourceCaption,
  });

  // Check Cache (0 AI requests on cache hit)
  if (useCache) {
    const cached = promptResponseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
      logger.info(`[Video Prompt Cache Hit - 0 AI Requests Made] key=${cacheKey}`);
      return {
        prompt: cached.text,
        structuredAnalysis: (cached as any).structuredAnalysis,
        modelUsed: cached.modelUsed,
        cached: true,
        requestCount: 0,
      };
    }
  }

  // 2. Select optimal high-performance model
  let userSelectedModel = model;
  if (!userSelectedModel || userSelectedModel === 'gemini-3.1-pro-preview') {
    userSelectedModel = 'gemini-3.8-flash';
  }

  // 3. Execute Unified Video to Prompt Pipeline
  const pipelineResult = await runVideoToPromptPipeline({
    videoFile: base64Data,
    mimeType,
    videoUrl: sourceUrl,
    sourceTitle: sourceCaption,
    videoDuration: actualDuration,
    segmentDuration: segmentDuration === 'auto' ? 'full' : (Number(segmentDuration) || 10),
    targetAi: targetAI,
    aspectRatio: '9:16',
    analysisDepth: analysisMode,
    model: userSelectedModel,
    customApiKey,
    clientAccessCode,
    useCache,
  });

  const output = {
    prompt: pipelineResult.markdown,
    markdown: pipelineResult.markdown,
    structuredAnalysis: pipelineResult.segments,
    modelUsed: pipelineResult.meta.modelUsed,
    tierUsed: pipelineResult.meta.tierUsed,
    cached: false,
    requestCount: pipelineResult.meta.apiCallsUsed,
    caption: pipelineResult.caption,
    hashtags: pipelineResult.hashtags,
    split_duration: pipelineResult.split_duration,
    metadata: pipelineResult.metadata,
    clips: pipelineResult.clips,
    segments: pipelineResult.segments,
    masterPrompt: pipelineResult.masterPrompt,
    negativePrompt: pipelineResult.negativePrompt,
    validation: pipelineResult.validation,
  };

  // 4. Save to Cache with exact matching cacheKey
  if (useCache) {
    promptResponseCache.set(cacheKey, {
      timestamp: Date.now(),
      text: pipelineResult.markdown,
      modelUsed: pipelineResult.meta.modelUsed,
      structuredAnalysis: pipelineResult.segments,
    } as any);
    logger.info(`[Video Prompt Cache Saved] key=${cacheKey}`);
  }

  return output;
}

export async function oldGenerateVideoPromptService_Deprecated(options: GeneratePromptOptions) {
  const targetAiInstruction = `Target AI Generator: ${targetAI.toUpperCase()}. Format each shot's generationPrompt so it is directly usable in ${targetAI}.`;
  const actionsInstruction = includeActions
    ? 'Detail the specific sequential physical movements and camera actions in each shot.'
    : 'Keep actions concise and high-level.';
  const voiceInstruction = includeVoiceOver
    ? 'Transcribe all spoken words and voice-over accurately in dialogue. If no speech is present, indicate so.'
    : 'Do not focus on voice-over.';
  const cinematicsInstruction = includeCinematics
    ? 'Analyze camera framing, lens focal estimate, camera trajectory, lighting setup, and color grade.'
    : 'Provide essential framing only.';

  const tiktokContext = sourceUrl || sourceCaption
    ? `\nSUPPLEMENTARY CONTEXT (Provided by user/TikTok metadata - verify against visible video evidence, do not invent unobserved facts):\nSource URL: ${sourceUrl || 'N/A'}\nUser/TikTok Caption: ${sourceCaption || 'N/A'}`
    : '';

  const promptText = `Conduct a comprehensive, single-pass reverse-engineering video analysis.
${tiktokContext}

REQUIREMENTS:
- ${targetAiInstruction}
- ${actionsInstruction}
- ${voiceInstruction}
- ${cinematicsInstruction}
- Style theme: ${cinematicStyle}

You MUST return a JSON object with this EXACT structure:
{
  "global": {
    "style": "Overall video style description",
    "visualAesthetic": "Visual aesthetic details",
    "mood": "Tone and emotional mood",
    "aspectRatio": "e.g. 9:16 or 16:9",
    "subjectIdentity": "Clear subject description (face, hair, attire) for visual consistency",
    "productIdentity": "Product branding, color, shape, materials (if any)",
    "environment": "Location, setting, backdrop details"
  },
  "cinematography": {
    "camera": "Camera type or look",
    "framing": "Shot framing (Close-up, Medium, Wide, etc.)",
    "lens": "Estimated focal length (e.g. 35mm, 50mm, 85mm)",
    "cameraMovement": "Camera motion (Static tripod, Handheld, Slow push-in, Pan, Orbit)",
    "focus": "Focus type (Deep focus, Shallow DOF, Rack focus)",
    "lighting": "Lighting setup (Soft daylight, Studio key+fill, Moody neon, Golden hour)",
    "color": "Color grading palette and saturation"
  },
  "audio": {
    "music": "Background music style / genre / tempo",
    "dialogue": "Verbatim transcript of speech / voice-over (or note if instrumental)",
    "voiceOver": "Voice tone and delivery style",
    "soundEffects": "Observable SFX"
  },
  "shots": [
    {
      "startSec": 0.0,
      "endSec": 5.0,
      "scene": "Concise scene summary",
      "subject": "Subject appearance / positioning in this shot",
      "product": "Product positioning in this shot",
      "actions": ["Specific physical action 1", "Action 2"],
      "dialogue": "Spoken words in this exact shot (or empty string)",
      "voiceTiming": "e.g. 0.5s - 3.2s",
      "onScreenText": "Any graphic overlays or text on screen",
      "cameraChange": "Camera motion specific to this shot",
      "lightingChange": "Any lighting shift in this shot",
      "transition": "Cut, fade, whip pan, or dissolve",
      "continuity": "Notes to preserve seamless continuity with subsequent shots",
      "generationPrompt": "Ready-to-use generative AI video prompt for ${targetAI}"
    }
  ],
  "caption": "Catchy, high-engagement TikTok/Reels caption with natural hook and CTA",
  "hashtags": "#tag1 #tag2 #tag3 #tag4 #tag5"
}`;

  let promptPayload: any;
  if (mimeType === 'text/plain') {
    const rawUserText = Buffer.from(base64Data, 'base64').toString('utf-8');
    promptPayload = {
      contents: {
        parts: [
          {
            text: `USER SCRIPT / STORYBOARD INPUT:\n"""\n${rawUserText}\n"""\n\n${promptText}`,
          },
        ],
      },
      config: {
        systemInstruction: VIDEO_PROMPT_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    };
  } else {
    promptPayload = {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Data,
            },
          },
          {
            text: promptText,
          },
        ],
      },
      config: {
        systemInstruction: VIDEO_PROMPT_SYSTEM_INSTRUCTION,
        responseMimeType: 'application/json',
      },
    };
  }

  const isDeepAnalysis = analysisMode === 'deep';
  const videoTargetTier = isDeepAnalysis ? 'flagship' : 'tier2';
  const videoToolName = 'video_to_prompt';

  // 4. Multi-Model Cascade with Auto-Failover through Gateway (Gemini 3.8 -> 3.7 -> 3.6 -> 3.5 -> 3.1)
  logger.info(`[Video to Prompt] Initiating AI video breakdown request with model: ${userSelectedModel || 'gemini-3.8-flash'}`);
  const result = await callGeminiWithFallback(
    userSelectedModel,
    promptPayload,
    customApiKey,
    clientAccessCode,
    videoTargetTier,
    videoToolName,
    Boolean(userSelectedModel), // isUserExplicitChoice
    '/api/generate-prompt',
    false // isSingleRequestMode: false to enable full multi-model cascading fallback across pool
  );

  // 5. Parse Structured JSON with Multi-Layer Sanitizer
  let structuredData: StructuredVideoAnalysis;
  const rawResponseText = result.text || '';
  try {
    const cleanedJsonText = cleanTimelineOutput(rawResponseText);
    structuredData = JSON.parse(cleanedJsonText);
  } catch (parseErr) {
    logger.warn('[Video to Prompt] Direct JSON parse failed, attempting regex extraction...', parseErr);
    const jsonMatch = rawResponseText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        const sanitized = jsonMatch[0]
          .replace(/,\s*([}\]])/g, '$1') // remove trailing commas
          .replace(/[\u0000-\u001F]+/g, ' '); // remove control chars
        structuredData = JSON.parse(sanitized);
      } catch (innerErr) {
        logger.warn('[Video to Prompt] Sanitized JSON parse failed, constructing fallback structure...', innerErr);
        structuredData = {
          timelineSegments: [
            {
              startSec: 0.0,
              endSec: actualDuration,
              scene: 'Analisis visual video utama',
              subject: 'Karakter / produk utama dalam video',
              product: 'Produk / objek fokus',
              actions: ['Menampilkan produk secara interaktif'],
              dialogue: '',
              voiceTiming: `0.0s - ${actualDuration}s`,
              onScreenText: '',
              cameraChange: 'Cinematic eye-level steady camera shot',
              lightingChange: 'Natural bright lighting',
              transition: 'Cut',
              continuity: 'Seamless natural flow',
              generationPrompt: `Cinematic vertical 9:16 high definition video shot of the subject and product, vivid colors, photorealistic, commercial style --ar 9:16`,
            },
          ],
          caption: 'Tonton inspirasi video komersial viral ini! Link di bio.',
          hashtags: '#rekomendasi #produk #viralvideo',
        };
      }
    } else {
      structuredData = {
        timelineSegments: [
          {
            startSec: 0.0,
            endSec: actualDuration,
            scene: 'Analisis adegan visual',
            subject: 'Subjek utama video',
            product: 'Objek produk',
            actions: ['Presentasi produk'],
            dialogue: '',
            voiceTiming: `0.0s - ${actualDuration}s`,
            onScreenText: '',
            cameraChange: 'Cinematic vertical shot',
            lightingChange: 'Studio lighting',
            transition: 'Cut',
            continuity: 'Consistent scene',
            generationPrompt: `Professional vertical 9:16 promotional commercial shot, high quality, crisp details --ar 9:16`,
          },
        ],
        caption: 'Ide konten video viral produk.',
        hashtags: '#rekomendasi #videoprompt',
      };
    }
  }

  // 6. Partition & Format Output locally in TypeScript
  const { formattedPrompt, finalStructured } = partitionAndFormatStructuredAnalysis(structuredData, {
    segmentDuration,
    actualDuration,
    targetAI,
    includeActions,
    includeVoiceOver,
    includeCinematics,
  });

  // 7. Save to Cache with exact matching cacheKey
  if (useCache) {
    promptResponseCache.set(cacheKey, {
      timestamp: Date.now(),
      text: formattedPrompt,
      modelUsed: result.modelUsed,
      structuredAnalysis: finalStructured,
    } as any);
    logger.info(`[Video Prompt Cache Saved] key=${cacheKey}`);
  }

  return {
    prompt: formattedPrompt,
    structuredAnalysis: finalStructured,
    modelUsed: result.modelUsed,
    cached: false,
    requestCount: 1,
  };
}

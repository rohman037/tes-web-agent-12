import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';

export interface VideoDnaAnalysis {
  visual_dna: {
    composition: string;
    lighting: string;
    color_palette: string;
    lens: string;
    style: string;
  };
  viral_dna: {
    hook_type: string;
    hook_visual: string;
    hook_text: string;
    retention_trigger: string;
    curiosity_gap: string;
  };
  emotional_dna: {
    opening_emotion: string;
    climax_emotion: string;
    ending_emotion: string;
    audience_reaction: string;
  };
  retention_tactics: {
    pacing: string;
    visual_changes: string;
    sound_cues: string;
  };
  content_structure: {
    hook: string;
    body: string;
    climax: string;
    cta: string;
  };
  audio_dna: {
    dialogue: string;
    voice_over: string;
    music_vibe: string;
    sound_effects: string;
  };
  camera_dna: {
    framing: string;
    movement: string;
    shot_sequence: string;
  };
}

export interface VideoAnalyzerOutput {
  // Legacy & core fields for prompts
  scene: string;
  subject: string;
  action: string;
  environment: string;
  camera: {
    shot: string;
    angle: string;
    movement: string;
  };
  lens: string;
  lighting: string;
  color: string;
  style: string;
  motion: string;

  // AI CONTENT CLONE ENGINE - 7 DNA Pillars
  dna: VideoDnaAnalysis;

  // Scene micro breakdown
  scenes?: Array<{
    start: string;
    end: string;
    visual: string;
    action: string;
    camera: string;
    subject: string;
    subtitle: string;
  }>;
}

export interface VideoAnalyzerInput {
  base64Data?: string;
  mimeType?: string;
  videoUrl?: string;
  clipNumber: number;
  startTime: number;
  endTime: number;
  durationLabel: string;
  sourceCaption?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  preferredModel?: string;
  overallContext?: string;
}

const SYSTEM_INSTRUCTION = `Anda adalah "Agent 1: Viral & Video DNA Analyst" dari "AI CONTENT CLONE ENGINE", seorang pakar Viral Content Engineering dan Lead Cinematographer kelas dunia.
Tugas utama Anda BUKAN hanya mendeskripsikan video biasa atau copy visual mentah.
Anda HARUS membedah dan memahami "MENGAPA VIDEO TERSEBUT BISA MENARIK / VIRAL" dan mengekstrak DNA video secara holistik ke dalam 7 PILAR ANALISIS:

1. VISUAL DNA: Komposisi visual, pencahayaan, palet warna, tipe lensa kamera, gaya estetika (cinematic 8k, lo-fi smartphone aesthetic, filmic grain, studio commercial).
2. VIRAL DNA: Jenis hook (Shock Hook, Problem Hook, Curiosity Hook, Visual ASMR Hook), visual hook detik awal, teks hook, retention trigger, curiosity gap.
3. EMOTIONAL DNA: Emosi pembuka (penasaran, terkejut, frustrasi), emosi klimaks (satisfaction, relief, terinspirasi), emosi penutup, target reaksi audiens.
4. RETENTION TACTICS: Pacing ritme adegan, frekuensi perubahan visual tiap 1-2 detik, sound cues & sync point.
5. CONTENT STRUCTURE: Alur Hook (detik awal), Body (demonstrasi/cerita), Climax (momen wow/solusi), CTA (ajakan interaksi).
6. AUDIO DNA: Dialog/voiceover natural, musik pengiring & vibe (lo-fi beat, suspense crescendo, energetic upbeat), sound effects (foley, swoosh, pop).
7. CAMERA DNA: Framing (extreme close-up macro, POV, low angle), movement (handheld dynamic, smooth tracking, quick push-in), shot sequence.

Kembalikan output DALAM FORMAT JSON MURNI TANPA MARKDOWN QUOTE:
{
  "scene": "deskripsi detail lokasi dan atmosfer adegan",
  "subject": "subjek utama spesifik (orang, ekspresi, busana, produk, atau objek)",
  "action": "aksi fisik spesifik yang terjadi secara kronologis",
  "environment": "lingkungan sekitar, tekstur, latar belakang",
  "camera": {
    "shot": "tipe shot (misal: Extreme Macro Close-Up, Low-Angle Dynamic)",
    "angle": "sudut kamera (misal: Eye Level, 45-degree Top Down)",
    "movement": "pergerakan kamera (misal: Smooth forward push-in, subtle handheld float)"
  },
  "lens": "spesifikasi lensa (misal: 35mm anamorphic, f/1.8 shallow depth of field)",
  "lighting": "skema pencahayaan (misal: soft diffused directional key light, subtle warm rim)",
  "color": "color grade (misal: clean neutral tones, high dynamic range, crisp contrast)",
  "style": "gaya estetika video",
  "motion": "tempo dan dinamika gerak",
  "dna": {
    "visual_dna": {
      "composition": "komposisi framing visual",
      "lighting": "pencahayaan",
      "color_palette": "palet warna",
      "lens": "karakteristik lensa",
      "style": "gaya visual"
    },
    "viral_dna": {
      "hook_type": "tipe hook (Shock, Problem, Curiosity, ASMR, dll)",
      "hook_visual": "visual hook yang memicu perhatian instan",
      "hook_text": "teks/kalimat hook utama",
      "retention_trigger": "elemen penahan agar penonton tidak swipe away",
      "curiosity_gap": "pertanyaan tak terucap yang bikin penasaran"
    },
    "emotional_dna": {
      "opening_emotion": "emosi di detik awal",
      "climax_emotion": "emosi saat puncak adegan",
      "ending_emotion": "emosi di akhir",
      "audience_reaction": "reaksi psikologis audiens"
    },
    "retention_tactics": {
      "pacing": "kecepatan pacing adegan",
      "visual_changes": "pola transisi visual",
      "sound_cues": "efek suara pengunci atensi"
    },
    "content_structure": {
      "hook": "elemen hook",
      "body": "alur penjelasan/demo",
      "climax": "titik kepuasan/solusi",
      "cta": "arahan aksi/penutup"
    },
    "audio_dna": {
      "dialogue": "dialog atau kata-kata kunci",
      "voice_over": "gaya narasi suara",
      "music_vibe": "vibe dan genre musik",
      "sound_effects": "efek suara foley penting"
    },
    "camera_dna": {
      "framing": "framing utama",
      "movement": "gerakan kamera",
      "shot_sequence": "urutan pergantian shot"
    }
  },
  "micro_scenes": [
    {
      "start": "0s",
      "end": "2s",
      "visual": "visual adegan pertama",
      "action": "aksi detail",
      "camera": "pergerakan kamera",
      "subject": "subjek fokus",
      "subtitle": "dialog atau suara pendukung"
    }
  ]
}`;

export async function runVideoAnalyzerAgent(input: VideoAnalyzerInput): Promise<VideoAnalyzerOutput> {
  logger.info(`[Video Analyzer Agent] Analyzing Clip #${input.clipNumber} (${input.durationLabel})...`);

  const userPrompt = `Analisis segmen video berikut:
- Klip #${input.clipNumber} (${input.durationLabel})
- Rentang Detik: ${input.startTime}s sampai ${input.endTime}s
${input.sourceCaption ? `- Konteks/Caption Asli: "${input.sourceCaption}"` : ''}
${input.overallContext ? `- Konteks Keseluruhan Video: ${input.overallContext}` : ''}

Ekstrak Video DNA (Visual, Viral, Emotional, Retention, Structure, Audio, Camera) serta detail scene, subjek, lighting, dan micro-scenes secara mendalam. Kembalikan format JSON murni.`;

  const contents: any[] = [];

  // If video data is available, pass it in contents
  if (input.base64Data && input.mimeType) {
    if (input.mimeType.startsWith('video/')) {
      contents.push({
        inlineData: {
          mimeType: input.mimeType,
          data: input.base64Data,
        },
      });
    } else {
      try {
        const textDecoded = Buffer.from(input.base64Data, 'base64').toString('utf-8');
        contents.push({
          text: `KONSEP / TEKS PROMPT ASLI:\n${textDecoded}`,
        });
      } catch {
        // fallback
      }
    }
  }

  contents.push({
    text: userPrompt,
  });

  const response = await executeAiTask({
    taskType: 'video_analysis',
    contents,
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.2, // Precise analysis
      responseMimeType: 'application/json',
    },
    preferredModel: input.preferredModel || 'gemini-3.8-flash',
    customApiKey: input.customApiKey,
    clientAccessCode: input.clientAccessCode,
    timeoutMs: 65000,
  });

  try {
    let cleanJson = response.text.trim();
    if (cleanJson.startsWith('```json')) {
      cleanJson = cleanJson.replace(/^```json\s*/i, '').replace(/```$/i, '').trim();
    } else if (cleanJson.startsWith('```')) {
      cleanJson = cleanJson.replace(/^```\s*/i, '').replace(/```$/i, '').trim();
    }

    const parsed = JSON.parse(cleanJson);
    const d = parsed.dna || {};

    const dnaResult: VideoDnaAnalysis = {
      visual_dna: {
        composition: d.visual_dna?.composition || parsed.camera?.shot || 'Framing presisi terpusat dengan depth of field sinematik',
        lighting: d.visual_dna?.lighting || parsed.lighting || 'Pencahayaan terarah dengan kontras lembut',
        color_palette: d.visual_dna?.color_palette || parsed.color || 'Palet warna sinematik jernih',
        lens: d.visual_dna?.lens || parsed.lens || '35mm anamorphic prime lens',
        style: d.visual_dna?.style || parsed.style || 'Ultra-realistic modern commercial aesthetic',
      },
      viral_dna: {
        hook_type: d.viral_dna?.hook_type || 'Visual Problem & Curiosity Hook',
        hook_visual: d.viral_dna?.hook_visual || parsed.action || 'Visual kontras tinggi yang menangkap atensi instan',
        hook_text: d.viral_dna?.hook_text || input.sourceCaption || 'Hook relevan dengan solusi masalah audiens',
        retention_trigger: d.viral_dna?.retention_trigger || 'Pacing cepat dengan transisi dinamis',
        curiosity_gap: d.viral_dna?.curiosity_gap || 'Ekspektasi hasil atau kepuasan akhir video',
      },
      emotional_dna: {
        opening_emotion: d.emotional_dna?.opening_emotion || 'Penasaran & terkejut',
        climax_emotion: d.emotional_dna?.climax_emotion || 'Puas & terkesan (Satisfaction)',
        ending_emotion: d.emotional_dna?.ending_emotion || 'Ingin mencoba atau memiliki (Desire)',
        audience_reaction: d.emotional_dna?.audience_reaction || 'Tertarik untuk menonton ulang dan menyimak produk',
      },
      retention_tactics: {
        pacing: d.retention_tactics?.pacing || 'Tempo adegan cepat 1-2 detik per pergerakan visual',
        visual_changes: d.retention_tactics?.visual_changes || 'Perubahan sudut kamera dinamis dan fokus tajam',
        sound_cues: d.retention_tactics?.sound_cues || 'Efek audio foley sinkron dengan pergerakan objek',
      },
      content_structure: {
        hook: d.content_structure?.hook || 'Detik 0-3: Visual memukau pemikat perhatian',
        body: d.content_structure?.body || 'Detik 3+: Demonstrasi fungsional dan keunggulan visual',
        climax: d.content_structure?.climax || 'Titik kepuasan visual maksimal',
        cta: d.content_structure?.cta || 'Call to action alami penutup video',
      },
      audio_dna: {
        dialogue: d.audio_dna?.dialogue || 'Dialog natural tanpa filler',
        voice_over: d.audio_dna?.voice_over || 'Gaya narasi storytelling ramah dan persuasif',
        music_vibe: d.audio_dna?.music_vibe || 'Upbeat trending rhythm dengan beat sinkron',
        sound_effects: d.audio_dna?.sound_effects || 'Sound effect renyah dan tajam pada kontak visual',
      },
      camera_dna: {
        framing: d.camera_dna?.framing || parsed.camera?.shot || 'Tight focus medium-close shot',
        movement: d.camera_dna?.movement || parsed.camera?.movement || 'Dynamic tracking forward',
        shot_sequence: d.camera_dna?.shot_sequence || 'Establishing -> Detail Macro -> Dynamic Action',
      },
    };

    return {
      scene: parsed.scene || `Adegan pada klip ${input.durationLabel}`,
      subject: parsed.subject || 'Subjek utama dalam frame adegan',
      action: parsed.action || 'Pergerakan dinamis dalam frame',
      environment: parsed.environment || parsed.scene || 'Lingkungan adegan',
      camera: {
        shot: parsed.camera?.shot || 'Medium Shot',
        angle: parsed.camera?.angle || 'Eye Level',
        movement: parsed.camera?.movement || 'Smooth tracking camera',
      },
      lens: parsed.lens || '50mm cinematic prime lens, natural depth of field',
      lighting: parsed.lighting || 'Cinematic soft studio lighting, balanced contrast',
      color: parsed.color || 'Cinematic color graded, high dynamic range',
      style: parsed.style || 'Ultra-realistic 8K cinematic footage',
      motion: parsed.motion || 'Natural fluid motion, 24fps filmic pacing',
      dna: dnaResult,
      scenes: parsed.micro_scenes || parsed.scenes || [],
    };
  } catch (parseErr) {
    logger.warn('[Video Analyzer Agent] Failed to parse strict JSON, falling back to structured defaults:', parseErr);
    return {
      scene: `Visual sinematik adegan pada ${input.durationLabel}`,
      subject: 'Subjek utama dengan ekspresi fokus dan gestur natural',
      action: 'Aksi terarah dengan pergerakan halus di dalam frame',
      environment: 'Latar sinematik dengan kedalaman ruang terisolasi',
      camera: {
        shot: 'Medium Cinematic Shot',
        angle: 'Eye Level Subtle Low Angle',
        movement: 'Slow forward dolly push',
      },
      lens: '35mm anamorphic lens, f/1.8 shallow depth of field',
      lighting: 'Warm key light with soft atmospheric fill and rim lighting',
      color: 'Rich cinematic color palette, balanced saturation',
      style: 'Ultra-photorealistic 8K cinematic footage',
      motion: 'Smooth stabilized motion cadence',
      dna: {
        visual_dna: {
          composition: 'Symmetrical cinematic composition with rule of thirds emphasis',
          lighting: 'Soft directional studio lighting with subtle rim contrast',
          color_palette: 'Rich natural tones with balanced vibrance',
          lens: '35mm anamorphic lens with creamy background bokeh',
          style: 'Modern commercial cinematic realism',
        },
        viral_dna: {
          hook_type: 'Visual Curiosity & Retention Hook',
          hook_visual: 'Opening close-up with high texture clarity',
          hook_text: input.sourceCaption || 'Hook visual atraktif penangkap atensi',
          retention_trigger: 'Continuous micro-actions every 1-2 seconds',
          curiosity_gap: 'Antisipasi hasil demonstrasi adegan',
        },
        emotional_dna: {
          opening_emotion: 'Curiosity & anticipation',
          climax_emotion: 'Visual satisfaction & clarity',
          ending_emotion: 'Engagement & purchase intent',
          audience_reaction: 'Audiens terpukau dan termotivasi mencoba produk',
        },
        retention_tactics: {
          pacing: 'Dynamic fast-cut rhythm (1-2s intervals)',
          visual_changes: 'Rapid angle switching and tight focal depth',
          sound_cues: 'Crisp foley clicks and satisfying swooshes',
        },
        content_structure: {
          hook: 'Immediate visual grab in seconds 0-2',
          body: 'Detailed showcase of action and utility',
          climax: 'Peak aesthetic satisfaction moment',
          cta: 'Clear visual call to action',
        },
        audio_dna: {
          dialogue: 'Natural, conversational, punchy delivery',
          voice_over: 'Warm, authentic creator tone',
          music_vibe: 'Modern lo-fi or trending upbeat acoustic beat',
          sound_effects: 'Tactile textured sound effects',
        },
        camera_dna: {
          framing: 'Macro to Medium close shot progression',
          movement: 'Smooth glidecam tracking push-in',
          shot_sequence: 'Hook Close-up -> Action Demonstration -> Result Framing',
        },
      },
      scenes: [],
    };
  }
}

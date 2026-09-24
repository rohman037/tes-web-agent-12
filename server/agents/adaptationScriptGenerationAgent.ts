import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';
import {
  ViralAnalysisData,
  ProductAnalysisData,
  AdaptedConceptData,
} from '@/server/types/replicaVideo.types';
import fs from 'fs';
import path from 'path';

export interface AdaptationScriptInput {
  viralAnalysis: ViralAnalysisData;
  productAnalysis: ProductAnalysisData;
  targetDurationSeconds: number;
  splitDurationSeconds: number;
  enableTextOverlay: boolean;
  targetAI?: string;
  tone?: string;
  contentType?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  preferredModel?: string;
}

export interface RawClipData {
  clip_number: number;
  start_second: number;
  end_second: number;
  clip_title?: string;
  clip_goal?: string;
  scenes: {
    scene_number: number;
    start_second: number;
    end_second: number;
    visual_direction: string;
    action_direction: string;
    camera_direction: string;
    audio_direction: string;
    text_overlay?: string;
    dialogue_or_subtitle?: string;
    scene_goal?: string;
  }[];
}

export interface AdaptationScriptOutput {
  adapted_concept: AdaptedConceptData;
  storyboard: {
    total_duration_seconds: number;
    split_duration_seconds: number;
    clips: RawClipData[];
  };
  modelUsed: string;
}

let cachedSkillText = '';
function getSkillPrompt(): string {
  if (cachedSkillText) return cachedSkillText;
  try {
    const skillPath = path.join(process.cwd(), 'server', 'ai', 'skills', 'adaptation-script-generation.skill.md');
    if (fs.existsSync(skillPath)) {
      cachedSkillText = fs.readFileSync(skillPath, 'utf8');
      return cachedSkillText;
    }
  } catch (err) {
    logger.warn('[AdaptationScriptAgent] Could not read skill file from disk, using fallback prompt');
  }
  return `Anda adalah Creative Director dan Content Adaptation Specialist. Adaptasikan formula video viral ke produk target. Output WAJIB JSON murni {"adapted_concept": {...}, "storyboard": {"clips": [...]}}.`;
}

export async function runAdaptationScriptGenerationAgent(
  input: AdaptationScriptInput
): Promise<AdaptationScriptOutput> {
  const {
    viralAnalysis,
    productAnalysis,
    targetDurationSeconds,
    splitDurationSeconds,
    enableTextOverlay,
    targetAI = 'general',
    tone = 'persuasive',
    contentType = 'affiliate',
  } = input;

  const totalClips = Math.ceil(targetDurationSeconds / splitDurationSeconds);

  logger.info(
    `[AdaptationScriptAgent] Starting Agent 2: Adaptation & Script Generation (${targetDurationSeconds}s total, split ${splitDurationSeconds}s = ${totalClips} clips)...`
  );

  const skillPrompt = getSkillPrompt();

  // Create explicit time schedule guide for the LLM
  const clipGuides: string[] = [];
  let currSec = 0;
  for (let c = 1; c <= totalClips; c++) {
    const endSec = Math.min(targetDurationSeconds, currSec + splitDurationSeconds);
    clipGuides.push(`Klip ${c}: Detik ${currSec} - ${endSec}`);
    currSec = endSec;
  }

  const promptText = `${skillPrompt}

=== DATA INPUT DARI AGENT 1 ===
VIRAL DNA:
${JSON.stringify(viralAnalysis, null, 2)}

PRODUCT DNA:
${JSON.stringify(productAnalysis, null, 2)}

=== PARAMETER STRUKTURAL KONTEN ===
- Total Durasi Target: ${targetDurationSeconds} detik
- Durasi Split per Klip: ${splitDurationSeconds} detik
- Total Klip yang Harus Dihasilkan: ${totalClips} klip
- Pembagian Klip:
${clipGuides.join('\n')}
- Text Overlay di Layar: ${enableTextOverlay ? 'WAJIB ADA (Hook teks kontras singkat)' : 'NONAKTIFKAN (kosongkan teks)'}
- Target Generator AI: ${targetAI.toUpperCase()}
- Nada Suara (Tone): ${tone}
- Tipe Konten: ${contentType}

Instruksi Khusus:
1. Adaptasikan formula viral tersebut secara spesifik ke produk "${productAnalysis.product_name}".
2. Jangan copy mentah, tapi tiru psikologi hook, ritme, dan pergerakan kamera.
3. Hasilkan tepat ${totalClips} klip sesuai durasi detik yang dijadwalkan di atas.
4. Setiap klip harus memiliki 1–3 rincian scene mendetail:
   - Visual: Deskripsi objek, material, tekstur, pencahayaan, dan setting ruangan secara nyata.
   - Aksi: Gerakan tangan/pengguna dan demonstrasi fungsi produk secara fisik.
   - Kamera: Sudut kamera optik dan pergerakan sinematik (POV, macro closeup, tracking push-in).
   - Audio: Sound design komplit bertekstur ASMR (bunyi gesekan, klik, semprotan, squish, foley) + mood musik ritmis.
   - Text Overlay: ${enableTextOverlay ? 'Hook teks kapital kontras di layar' : 'Kosongkan teks'}
5. Kembalikan HANYA JSON valid sesuai struktur yang diminta.`;

  const response = await executeAiTask({
    taskType: 'adaptation_script_generation',
    contents: [{ text: promptText }],
    config: {
      temperature: 0.4,
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
    logger.warn('[AdaptationScriptAgent] JSON.parse failed, attempting JSON extraction regex...', err);
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Gagal membaca respons storyboard Agent 2: Format JSON tidak valid`);
    }
  }

  const adaptedConcept: AdaptedConceptData = {
    concept_title: parsed?.adapted_concept?.concept_title || `Replika Viral: Rahasia ${productAnalysis.product_name}`,
    concept_summary:
      parsed?.adapted_concept?.concept_summary ||
      `Konsep video ${targetDurationSeconds} detik berfokus pada pembuktian langsung keunggulan ${productAnalysis.product_name} menggunakan formula viral yang diadaptasikan.`,
    strategy_summary:
      parsed?.adapted_concept?.strategy_summary ||
      `Menggunakan pattern interrupt di 3 detik pertama, diikuti demonstrasi solusi nyata, dan diakhiri dengan CTA tanpa kesan memaksa.`,
    hook_strategy: parsed?.adapted_concept?.hook_strategy || viralAnalysis.hook || 'Curiosity gap visual hook',
    cta_strategy: parsed?.adapted_concept?.cta_strategy || viralAnalysis.cta_pattern || 'Ajakan langsung cek link keranjang kuning',
  };

  let clips: RawClipData[] = [];
  if (Array.isArray(parsed?.storyboard?.clips) && parsed.storyboard.clips.length > 0) {
    clips = parsed.storyboard.clips;
  } else if (Array.isArray(parsed?.clips) && parsed.clips.length > 0) {
    clips = parsed.clips;
  } else {
    // Fallback if LLM generated flat structure
    clips = [];
    let start = 0;
    for (let i = 1; i <= totalClips; i++) {
      const end = Math.min(targetDurationSeconds, start + splitDurationSeconds);
      clips.push({
        clip_number: i,
        start_second: start,
        end_second: end,
        clip_title: `Klip ${i}: Fokus ${i === 1 ? 'Hook & Interupsi' : i === totalClips ? 'Klimaks & CTA' : 'Solusi & Detail Produk'}`,
        clip_goal: i === 1 ? 'Mengunci retensi 3 detik pertama' : 'Memperkuat keyakinan audiens',
        scenes: [
          {
            scene_number: 1,
            start_second: start,
            end_second: end,
            visual_direction: `Kamera menampilkan close-up ${productAnalysis.product_name} dengan estetika ${viralAnalysis.visual_style}`,
            action_direction: `Subjek mendemonstrasikan keunggulan produk secara alami`,
            camera_direction: viralAnalysis.camera_style || 'Macro close-up and smooth push-in',
            audio_direction: viralAnalysis.audio_style || 'Suara natural ASMR dan musik berirama pas',
            text_overlay: enableTextOverlay ? `Trik Rahasia ${productAnalysis.product_name}!` : '',
            dialogue_or_subtitle: `Gak nyangka ternyata produk ini beneran mempermudah hidup!`,
            scene_goal: 'Membangun trust dan ketertarikan',
          },
        ],
      });
      start = end;
    }
  }

  // Ensure clip number and time ranges are normalized
  let normStart = 0;
  clips = clips.slice(0, totalClips).map((clip, idx) => {
    const cNum = idx + 1;
    const sSec = normStart;
    const eSec = Math.min(targetDurationSeconds, normStart + splitDurationSeconds);
    normStart = eSec;

    return {
      clip_number: cNum,
      start_second: sSec,
      end_second: eSec,
      clip_title: clip.clip_title || `Klip ${cNum}`,
      clip_goal: clip.clip_goal || `Tujuan Klip ${cNum}`,
      scenes: Array.isArray(clip.scenes) && clip.scenes.length > 0
        ? clip.scenes.map((sc, sIdx) => ({
            scene_number: sIdx + 1,
            start_second: typeof sc.start_second === 'number' ? sc.start_second : sSec,
            end_second: typeof sc.end_second === 'number' ? sc.end_second : eSec,
            visual_direction: sc.visual_direction || `Visual adegan klip ${cNum}`,
            action_direction: sc.action_direction || `Aksi pada klip ${cNum}`,
            camera_direction: sc.camera_direction || viralAnalysis.camera_style || 'Eye-level cinematic tracking',
            audio_direction: sc.audio_direction || viralAnalysis.audio_style || 'Clean ASMR audio with upbeat background music',
            text_overlay: enableTextOverlay ? (sc.text_overlay || '') : '',
            dialogue_or_subtitle: sc.dialogue_or_subtitle || '',
            scene_goal: sc.scene_goal || '',
          }))
        : [
            {
              scene_number: 1,
              start_second: sSec,
              end_second: eSec,
              visual_direction: `Visual adegan ${productAnalysis.product_name}`,
              action_direction: `Aksi interaksi produk`,
              camera_direction: viralAnalysis.camera_style || 'Cinematic tracking shot',
              audio_direction: viralAnalysis.audio_style || 'ASMR sound texture',
              text_overlay: enableTextOverlay ? `Cek ${productAnalysis.product_name} Sekarang` : '',
              dialogue_or_subtitle: '',
              scene_goal: 'Retensi audiens',
            },
          ],
    };
  });

  return {
    adapted_concept: adaptedConcept,
    storyboard: {
      total_duration_seconds: targetDurationSeconds,
      split_duration_seconds: splitDurationSeconds,
      clips,
    },
    modelUsed: response.modelUsed,
  };
}

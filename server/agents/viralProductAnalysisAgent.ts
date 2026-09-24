import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';
import { ViralAnalysisData, ProductAnalysisData } from '@/server/types/replicaVideo.types';
import fs from 'fs';
import path from 'path';

export interface ViralProductAnalysisAgentInput {
  videoBase64?: string;
  videoMimeType?: string;
  sourceTitle?: string;
  tiktokUrl?: string;
  productNameOrTopic: string;
  productUrl?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  preferredModel?: string;
}

export interface ViralProductAnalysisAgentOutput {
  viral_analysis: ViralAnalysisData;
  product_analysis: ProductAnalysisData;
  modelUsed: string;
}

let cachedSkillText = '';
function getSkillPrompt(): string {
  if (cachedSkillText) return cachedSkillText;
  try {
    const skillPath = path.join(process.cwd(), 'server', 'ai', 'skills', 'viral-product-analysis.skill.md');
    if (fs.existsSync(skillPath)) {
      cachedSkillText = fs.readFileSync(skillPath, 'utf8');
      return cachedSkillText;
    }
  } catch (err) {
    logger.warn('[ViralProductAnalysisAgent] Could not read skill file from disk, using fallback prompt');
  }
  return `Anda adalah AI Reverse-Engineering dan Product Intelligence Specialist. Tugas Anda adalah membedah formula video viral dan DNA produk target user. Output WAJIB JSON murni {"viral_analysis": {...}, "product_analysis": {...}}.`;
}

export async function runViralProductAnalysisAgent(
  input: ViralProductAnalysisAgentInput
): Promise<ViralProductAnalysisAgentOutput> {
  logger.info(`[ViralProductAnalysisAgent] Starting Agent 1: Viral + Product Analysis for "${input.productNameOrTopic}"...`);

  const skillPrompt = getSkillPrompt();

  const userContextLines = [
    `=== TARGET PRODUCT / TOPIK USER ===`,
    `Nama Produk / Topik: ${input.productNameOrTopic}`,
    input.productUrl ? `Link Produk / Tokopedia / TikTok Shop: ${input.productUrl}` : '',
    input.sourceTitle ? `Judul / Konteks Video Referensi: ${input.sourceTitle}` : '',
    input.tiktokUrl ? `Link Video Referensi TikTok: ${input.tiktokUrl}` : '',
  ].filter(Boolean).join('\n');

  const contents: any[] = [];

  // If video base64 data provided
  if (input.videoBase64 && input.videoMimeType) {
    if (input.videoMimeType.startsWith('video/')) {
      contents.push({
        inlineData: {
          mimeType: input.videoMimeType,
          data: input.videoBase64,
        },
      });
    } else if (input.videoMimeType.startsWith('text/')) {
      const decodedText = Buffer.from(input.videoBase64, 'base64').toString('utf-8');
      contents.push({
        text: `[Data Referensi Video Teks]:\n${decodedText}`,
      });
    }
  }

  // If reference image provided
  if (input.referenceImageBase64 && input.referenceImageMimeType) {
    contents.push({
      inlineData: {
        mimeType: input.referenceImageMimeType,
        data: input.referenceImageBase64,
      },
    });
  }

  contents.push({
    text: `${skillPrompt}\n\n${userContextLines}\n\nLakukan analisis menyeluruh terhadap video viral dan produk ini. Kembalikan HANYA JSON valid sesuai struktur yang diminta.`,
  });

  const response = await executeAiTask({
    taskType: 'viral_product_analysis',
    contents,
    config: {
      temperature: 0.3,
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
    logger.warn('[ViralProductAnalysisAgent] JSON.parse failed, attempting JSON extraction regex...', err);
    const jsonMatch = rawJson.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      parsed = JSON.parse(jsonMatch[0]);
    } else {
      throw new Error(`Gagal membaca respons analisis Agent 1: Format JSON tidak valid`);
    }
  }

  const defaultViral: ViralAnalysisData = {
    hook: parsed?.viral_analysis?.hook || 'Visual hook dramatis dengan curiosity gap tinggi dalam 3 detik pertama',
    emotional_trigger: parsed?.viral_analysis?.emotional_trigger || 'Rasa penasaran dan solusi instan',
    retention_pattern: parsed?.viral_analysis?.retention_pattern || 'Pacing cepat dengan transisi beat per 2-3 detik',
    visual_style: parsed?.viral_analysis?.visual_style || 'Clean cinematic realism, pencahayaan terang alami',
    camera_style: parsed?.viral_analysis?.camera_style || 'Kombinasi POV first-person dan macro closeup detail',
    audio_style: parsed?.viral_analysis?.audio_style || 'Texture sound ASMR dan musik berirama energik',
    editing_pattern: parsed?.viral_analysis?.editing_pattern || 'Potongan ritmis mengikuti ketukan audio',
    cta_pattern: parsed?.viral_analysis?.cta_pattern || 'Ajakan langsung cek tautan dengan urgensi benefit',
    text_overlay_style: parsed?.viral_analysis?.text_overlay_style || 'Teks kontras tebal di area tengah/atas layar',
  };

  const defaultProduct: ProductAnalysisData = {
    product_name: parsed?.product_analysis?.product_name || input.productNameOrTopic,
    category: parsed?.product_analysis?.category || 'General Products',
    target_audience: parsed?.product_analysis?.target_audience || 'Pengguna media sosial aktif pencari solusi praktis',
    features: parsed?.product_analysis?.features || ['Desain ergonomis', 'Material premium berkualitas', 'Hasil instan terlihat'],
    benefits: parsed?.product_analysis?.benefits || ['Mempermudah rutinitas harian', 'Menghemat waktu dan biaya'],
    selling_angle_primary: parsed?.product_analysis?.selling_angle_primary || 'Solusi praktis paling efektif dengan efisiensi tinggi',
    selling_angle_secondary: parsed?.product_analysis?.selling_angle_secondary || 'Estetika premium dengan harga bersahabat',
    keyword_core: parsed?.product_analysis?.keyword_core || [input.productNameOrTopic.toLowerCase(), 'rekomendasi produk', 'viral terlaris'],
    keyword_niche: parsed?.product_analysis?.keyword_niche || ['racun belanja', 'haul review', 'tips bermanfaat'],
    value_proposition: parsed?.product_analysis?.value_proposition || 'Pilihan terbaik untuk kemudahan dan kepuasan maksimal harian',
    audience_intent: parsed?.product_analysis?.audience_intent || 'Mencari bukti nyata sebelum membeli',
    market_positioning: parsed?.product_analysis?.market_positioning || 'Produk unggulan kategori dengan kepuasan tinggi',
  };

  return {
    viral_analysis: { ...defaultViral, ...(parsed?.viral_analysis || {}) },
    product_analysis: { ...defaultProduct, ...(parsed?.product_analysis || {}) },
    modelUsed: response.modelUsed,
  };
}

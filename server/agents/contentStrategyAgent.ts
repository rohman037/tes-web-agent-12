import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';
import { ProductIntelligenceOutput } from './productIntelligenceAgent';

export interface ContentFormulaSelection {
  formula: 'Problem Solution' | 'Curiosity Hook' | 'Product Demonstration' | 'Before After' | 'Comparison' | 'Unboxing' | 'Lifestyle';
  reason: string;
}

export interface RetentionIntelligence {
  hook: string;
  retention_trigger: string;
  curiosity_gap: string;
}

export interface StoryPhase {
  phase: string;
  time_range: string;
  focus: string;
}

export interface ScriptOutput {
  voice_over: string;
  dialogue: string;
  subtitle: string[];
  cta: string;
  audio_mood: string;
}

export interface ContentStrategyOutput {
  content_formula: ContentFormulaSelection;
  retention_intelligence: RetentionIntelligence;
  story_structure: StoryPhase[];
  script: ScriptOutput;
}

export interface ContentStrategyInput {
  productIntelligence: ProductIntelligenceOutput;
  totalDurationSeconds?: number;
  userStylePreference?: string;
  preferredModel?: string;
  customApiKey?: string;
  clientAccessCode?: string;
}

const SYSTEM_INSTRUCTION = `Anda adalah "Agent 2: Content Strategy Agent V2" dari sistem AI PRODUCT COMMERCIAL GENERATOR V2.
Tugas Anda adalah mentransformasikan data Product Intelligence V2 menjadi strategi konten video komersial berkonversi tinggi.

Pedoman Strategi V2:

1. CONTENT FORMULA SELECTION:
   Pilih secara cerdas 1 formula terbaik dari daftar berikut:
   - "Problem Solution" (Menyorot masalah harian & hadirkan produk sebagai solusi)
   - "Curiosity Hook" (Memicu rasa penasaran instan sejak detik pertama)
   - "Product Demonstration" (Demonstrasi fungsionalitas & keindahan visual produk saat bekerja)
   - "Before After" (Kontras dramatis sebelum vs sesudah memakai produk)
   - "Comparison" (Membandingkan cara konvensional yang ribet vs cara baru yang praktis)
   - "Unboxing" (Sensasi kepuasan membuka & mencoba pertama kali)
   - "Lifestyle" (Integrasi produk dalam gaya hidup harian yang aspiratif)
   Berikan formula dan reason yang spesifik.

2. RETENTION INTELLIGENCE:
   Ciptakan daya tahan tontonan penonton (retention engine):
   - hook: Kalimat/klaim 3 detik pertama penghenti scroll jari penonton
   - retention_trigger: Elemen visual/naratif penahan perhatian penonton hingga akhir video
   - curiosity_gap: Celah penasaran antara masalah harian dengan pembuktian performa produk

3. PROPORTIONAL VIDEO STORY STRUCTURE:
   Rancang struktur alur cerita sesuai total durasi video (misal 60 detik):
   - 0-3s: HOOK (Penangkap atensi instan & pattern interrupt)
   - 3-15s: PROBLEM / INTRO (Menghubungkan ke frustrasi & kebutuhan konsumen)
   - 15-40s: PRODUCT DEMO (Aksi nyata produk, performa, & visual anchor)
   - 40-55s: BENEFIT (Hasil akhir memuaskan, efisiensi, & kenyamanan)
   - 55-60s: CTA (Instruksi pembelian jernih tanpa memaksa)
   *(Jika durasi lebih pendek/panjang dari 60s, sesuaikan proporsi rentang waktu secara otomatis)*.

4. SCRIPT GENERATION:
   - voice_over: Narasi suara bahasa Indonesia yang luwes, persuasif, natural, dan bernilai jual tinggi (bebas kata-kata klise murahan)
   - dialogue: Percakapan atau pesan teks singkat jika ada
   - subtitle: Baris teks subtitle untuk tampilan video tanpa suara
   - cta: Ajakan bertindak alami (e.g. "Klik keranjang sekarang untuk dapatkan promo spesial hari ini!")
   - audio_mood: Arahan musik latar & sound effect foley

WAJIB MENGEMBALIKAN FORMAT JSON MURNI:
{
  "content_formula": {
    "formula": "Problem Solution",
    "reason": "string"
  },
  "retention_intelligence": {
    "hook": "string",
    "retention_trigger": "string",
    "curiosity_gap": "string"
  },
  "story_structure": [
    {
      "phase": "HOOK",
      "time_range": "0-3s",
      "focus": "string"
    },
    {
      "phase": "PROBLEM_INTRO",
      "time_range": "3-15s",
      "focus": "string"
    },
    {
      "phase": "PRODUCT_DEMO",
      "time_range": "15-40s",
      "focus": "string"
    },
    {
      "phase": "BENEFIT",
      "time_range": "40-55s",
      "focus": "string"
    },
    {
      "phase": "CTA",
      "time_range": "55-60s",
      "focus": "string"
    }
  ],
  "script": {
    "voice_over": "string",
    "dialogue": "string",
    "subtitle": ["string"],
    "cta": "string",
    "audio_mood": "string"
  }
}`;

export async function runContentStrategyAgent(
  input: ContentStrategyInput
): Promise<ContentStrategyOutput> {
  logger.info('[ContentStrategyAgent] Running Content Strategy Agent V2 (Agent 2)...');

  const { productIntelligence, totalDurationSeconds = 60 } = input;
  const pName = productIntelligence.product_identity.name;
  const pFeatures = productIntelligence.features_and_benefits.features.join(', ');
  const pBenefits = productIntelligence.features_and_benefits.benefits.join(', ');
  const pPsych = productIntelligence.buyer_psychology;

  const userPrompt = `Rancang Content Strategy V2 berkonversi tinggi untuk produk berikut:
- Nama Produk: ${pName}
- Kategori: ${productIntelligence.product_identity.category}
- Visual Anchor: Shape: ${productIntelligence.visual_anchor.shape}, Color: ${productIntelligence.visual_anchor.color}, Material: ${productIntelligence.visual_anchor.material}, Texture: ${productIntelligence.visual_anchor.texture}
- Fitur Teknis: ${pFeatures}
- Keuntungan Nyata (Benefits): ${pBenefits}
- Buyer Psychology: Target: ${pPsych.audience}, Pain Point: ${pPsych.pain_point}, Desire: ${pPsych.desire}, Objection: ${pPsych.objection}, Trigger: ${pPsych.purchase_trigger}
- Selling Angle: ${productIntelligence.selling_angle}
- Total Durasi Video: ${totalDurationSeconds} detik
${input.userStylePreference ? `- Preferensi Gaya Konten: ${input.userStylePreference}` : ''}

Hasilkan strategi formula, retention intelligence, timeline story structure proporsional, dan naskah skrip lengkap dalam format JSON murni.`;

  const response = await executeAiTask({
    taskType: 'content_strategy',
    contents: [userPrompt],
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      temperature: 0.3,
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

    const parsed: ContentStrategyOutput = JSON.parse(cleanJson);

    // Calculate proportional timeline ranges based on totalDurationSeconds
    const hookEnd = Math.max(2, Math.min(3, Math.round(totalDurationSeconds * 0.05)));
    const probEnd = Math.max(hookEnd + 3, Math.round(totalDurationSeconds * 0.25));
    const demoEnd = Math.max(probEnd + 5, Math.round(totalDurationSeconds * 0.65));
    const benEnd = Math.max(demoEnd + 5, Math.round(totalDurationSeconds * 0.90));

    return {
      content_formula: {
        formula: parsed.content_formula?.formula || 'Problem Solution',
        reason: parsed.content_formula?.reason || 'Formula solusi masalah sangat efektif menangkap atensi audiens yang memiliki frustrasi serupa.',
      },
      retention_intelligence: {
        hook: parsed.retention_intelligence?.hook || `Capek sama cara lama yang ribet? Cobain cara baru pakai ${pName}!`,
        retention_trigger: parsed.retention_intelligence?.retention_trigger || 'Penonton penasaran ingin melihat kemudahan penggunaan instan di pertengahan video.',
        curiosity_gap: parsed.retention_intelligence?.curiosity_gap || `Bagaimana alat ringkas ini sanggup memberikan hasil maksimal dalam hitungan detik?`,
      },
      story_structure: Array.isArray(parsed.story_structure) && parsed.story_structure.length > 0
        ? parsed.story_structure
        : [
            { phase: 'HOOK', time_range: `0-${hookEnd}s`, focus: 'Atensi instan & pembukaan visual dramatis' },
            { phase: 'PROBLEM_INTRO', time_range: `${hookEnd}-${probEnd}s`, focus: 'Visualisasi frustrasi & kebutuhan konsumen' },
            { phase: 'PRODUCT_DEMO', time_range: `${probEnd}-${demoEnd}s`, focus: 'Demonstrasi aksi nyata & keindahan visual anchor produk' },
            { phase: 'BENEFIT', time_range: `${demoEnd}-${benEnd}s`, focus: 'Hasil akhir memuaskan & efisiensi waktu' },
            { phase: 'CTA', time_range: `${benEnd}-${totalDurationSeconds}s`, focus: 'Instruksi pembelian jernih di keranjang' },
          ],
      script: {
        voice_over: parsed.script?.voice_over || `Pernah merasa repot kalau harus berurusan sama peralatan yang bulky? Kenalin ${pName}, solusi ringkas yang bikin rutinitas kamu jauh lebih efisien. Tinggal pakai, hasilnya langsung beres tanpa ribet. Cek sekarang sebelum kehabisan promo!`,
        dialogue: parsed.script?.dialogue || `${pName} - Solusi Praktis Harian`,
        subtitle: Array.isArray(parsed.script?.subtitle) && parsed.script.subtitle.length > 0
          ? parsed.script.subtitle
          : ['Capek cara lama yang ribet?', `Solusi praktis pakai ${pName}`, 'Cepat, mulus, tanpa repot', 'Klik keranjang sekarang!'],
        cta: parsed.script?.cta || 'Dapatkan produk originalnya di keranjang sekarang untuk promo spesial!',
        audio_mood: parsed.script?.audio_mood || 'Upbeat energetic modern acoustic with crisp tactile foley sound effects',
      },
    };
  } catch (err: any) {
    logger.error(`[ContentStrategyAgent] JSON parse error: ${err.message}. Raw text: ${response.text.slice(0, 200)}`);
    return {
      content_formula: {
        formula: 'Problem Solution',
        reason: 'Menyajikan solusi nyata atas pain point konsumen untuk konversi maksimal.',
      },
      retention_intelligence: {
        hook: `Masih pakai cara lama yang ribet? Waktunya beralih ke ${pName}!`,
        retention_trigger: 'Penonton menunggu demonstrasi performa fisik produk.',
        curiosity_gap: 'Melihat kemudahan penggunaan berkecepatan tinggi.',
      },
      story_structure: [
        { phase: 'HOOK', time_range: '0-3s', focus: 'Hook atensi pembuka' },
        { phase: 'PROBLEM_INTRO', time_range: '3-15s', focus: 'Menyentuh pain point konsumen' },
        { phase: 'PRODUCT_DEMO', time_range: '15-40s', focus: 'Demonstrasi produk beraksi' },
        { phase: 'BENEFIT', time_range: '40-55s', focus: 'Manfaat nyata & kepuasan' },
        { phase: 'CTA', time_range: '55-60s', focus: 'Ajakan checkout keranjang' },
      ],
      script: {
        voice_over: `Bikin hari kamu lebih praktis dengan ${pName}. Desain ringkas, performa maksimal, dan nyaman digunakan. Dapatkan produk originalnya sekarang juga!`,
        dialogue: `${pName} - Solusi Praktis`,
        subtitle: ['Praktis & Ringkas', 'Performa Maksimal', 'Klik Keranjang Sekarang'],
        cta: 'Dapatkan produk originalnya di keranjang sekarang!',
        audio_mood: 'Modern upbeat rhythm with tactile foley audio',
      },
    };
  }
}

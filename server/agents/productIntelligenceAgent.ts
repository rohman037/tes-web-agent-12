import { executeAiTask } from '@/server/services/aiRouter';
import { logger } from '@/server/core/utils/logger';

export interface ProductIdentity {
  name: string;
  category: string;
  brand: string;
  material: string;
  color: string;
  shape: string;
  texture: string;
  features: string[];
}

export interface VisualAnchor {
  shape: string;
  color: string;
  material: string;
  texture: string;
  unique_detail: string;
}

export interface FeaturesAndBenefits {
  features: string[];
  benefits: string[];
}

export interface BuyerPsychology {
  audience: string;
  pain_point: string;
  desire: string;
  objection: string;
  purchase_trigger: string;
}

export interface SeoKeywordIntelligence {
  primary: string;
  secondary: string;
  category: string;
  problem: string;
  buying_intent: string;
}

export interface ProductIntelligenceOutput {
  product_identity: ProductIdentity;
  visual_anchor: VisualAnchor;
  features_and_benefits: FeaturesAndBenefits;
  buyer_psychology: BuyerPsychology;
  seo_keywords: SeoKeywordIntelligence;
  selling_angle: string;
}

export interface ProductIntelligenceInput {
  productName?: string;
  productDescription?: string;
  productUrl?: string;
  marketplaceData?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  preferredModel?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  enableGrounding?: boolean;
}

const SYSTEM_INSTRUCTION = `Anda adalah "Agent 1: Product Intelligence Agent V2" dari sistem AI PRODUCT COMMERCIAL GENERATOR V2.
Tugas Anda adalah membedah dan menganalisis data produk secara mendalam, presisi, bernilai komersial tinggi, dan anti-generik.

Analisis yang harus Anda lakukan mencakup 6 dimensi utama:

1. PRODUCT IDENTITY:
   Ekstrak: nama produk, kategori, brand, material, warna, bentuk, tekstur, dan daftar fitur utama.

2. PRODUCT VISUAL ANCHOR:
   Kunci elemen visual riil produk dari deskripsi atau foto referensi agar AI video prompt tidak pernah mengubah identitas fisik produk:
   - shape: bentuk fisik spesifik produk
   - color: warna utama dan aksen
   - material: bahan fisik visual
   - texture: tekstur permukaan (e.g. brushed metal, matte, glossy, grained leather)
   - unique_detail: detail unik fisik (e.g. logo, tombol tactile, chamber transparan)

3. FEATURE VS BENEFIT ANALYSIS:
   Bedakan secara tegas antara Feature teknis (misal: "baterai 5000mAh", "motor 20000 RPM 6 mata pisau") dengan Benefit nyata bagi konsumen (misal: "bisa dipakai 15x blending seharian tanpa repot cari colokan saat traveling", "menghancurkan es batu dan buah beku dalam 10 detik tanpa ampas kasar").

4. BUYER PSYCHOLOGY ANALYSIS:
   Analisis psikologi pembeli ideal:
   - audience: target konsumen spesifik
   - pain_point: frustrasi harian riil sebelum punya produk
   - desire: keinginan mendasar konsumen
   - objection: keraguan atau alasan ragu membeli
   - purchase_trigger: alasan emosional/praktis pemicu pembelian instan

5. SEO KEYWORD INTELLIGENCE:
   Petakan kata kunci pencarian e-commerce tingkat tinggi:
   - primary: kata kunci utama produk (e.g. "portable blender")
   - secondary: kata kunci spesifik (e.g. "blender mini portable")
   - category: kata kunci kategori fungsional (e.g. "peralatan dapur praktis")
   - problem: kata kunci pencarian solusi masalah (e.g. "cara bikin jus segar di kantor")
   - buying_intent: kata kunci berniat beli (e.g. "blender portable terbaik")

6. SELLING ANGLE:
   Sudut pandang penjualan komersial terkuat yang membedakan produk ini dari kompetitor.

WAJIB MENGEMBALIKAN OUTPUT DALAM FORMAT JSON MURNI:
{
  "product_identity": {
    "name": "string",
    "category": "string",
    "brand": "string",
    "material": "string",
    "color": "string",
    "shape": "string",
    "texture": "string",
    "features": ["string"]
  },
  "visual_anchor": {
    "shape": "string",
    "color": "string",
    "material": "string",
    "texture": "string",
    "unique_detail": "string"
  },
  "features_and_benefits": {
    "features": ["string"],
    "benefits": ["string"]
  },
  "buyer_psychology": {
    "audience": "string",
    "pain_point": "string",
    "desire": "string",
    "objection": "string",
    "purchase_trigger": "string"
  },
  "seo_keywords": {
    "primary": "string",
    "secondary": "string",
    "category": "string",
    "problem": "string",
    "buying_intent": "string"
  },
  "selling_angle": "string"
}`;

export async function runProductIntelligenceAgent(
  input: ProductIntelligenceInput
): Promise<ProductIntelligenceOutput> {
  logger.info('[ProductIntelligenceAgent] Running Product Intelligence Agent V2 (Agent 1)...');

  const userPrompt = `Lakukan analisis Product Intelligence V2 mendalam pada produk berikut:
- Nama Produk: ${input.productName || 'Tidak disebutkan secara eksplisit'}
- Deskripsi / Detail: ${input.productDescription || '-'}
- Link / Marketplace URL: ${input.productUrl || '-'}
- Data Marketplace / Tambahan: ${input.marketplaceData || '-'}
${input.referenceImageBase64 ? '- Foto produk telah dilampirkan (analisis bentuk, warna, material, tekstur, dan detail fisik uniknya secara presisi untuk visual_anchor).' : ''}

Hasilkan output JSON murni sesuai schema yang telah ditentukan.`;

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

  const aiConfig: any = {
    systemInstruction: SYSTEM_INSTRUCTION,
    temperature: 0.2,
  };

  if (input.enableGrounding) {
    aiConfig.tools = [{ googleSearch: {} }];
    // Note: Gemini API requires omitting responseMimeType when tools are provided
  } else {
    aiConfig.responseMimeType = 'application/json';
  }

  const response = await executeAiTask({
    taskType: 'product_intelligence',
    contents,
    config: aiConfig,
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

    const parsed: ProductIntelligenceOutput = JSON.parse(cleanJson);
    const fallbackName = input.productName || 'Produk Unggulan';

    return {
      product_identity: {
        name: parsed.product_identity?.name || fallbackName,
        category: parsed.product_identity?.category || 'General E-Commerce & Lifestyle',
        brand: parsed.product_identity?.brand || 'Original Brand',
        material: parsed.product_identity?.material || 'High-grade durable material',
        color: parsed.product_identity?.color || 'Modern aesthetic finish',
        shape: parsed.product_identity?.shape || 'Ergonomic compact design',
        texture: parsed.product_identity?.texture || 'Smooth refined texture',
        features: Array.isArray(parsed.product_identity?.features) && parsed.product_identity.features.length > 0
          ? parsed.product_identity.features
          : ['Desain fungsional dan praktis harian', 'Material berkualitas tinggi dan tahan lama'],
      },
      visual_anchor: {
        shape: parsed.visual_anchor?.shape || parsed.product_identity?.shape || 'Ergonomic compact shape',
        color: parsed.visual_anchor?.color || parsed.product_identity?.color || 'Aesthetic modern colorway',
        material: parsed.visual_anchor?.material || parsed.product_identity?.material || 'Premium durable material',
        texture: parsed.visual_anchor?.texture || parsed.product_identity?.texture || 'Smooth matte finish',
        unique_detail: parsed.visual_anchor?.unique_detail || 'Branded tactile build detail',
      },
      features_and_benefits: {
        features: Array.isArray(parsed.features_and_benefits?.features) && parsed.features_and_benefits.features.length > 0
          ? parsed.features_and_benefits.features
          : ['Form factor ringkas dan mudah dibawa', 'Pengoperasian efisien satu tombol'],
        benefits: Array.isArray(parsed.features_and_benefits?.benefits) && parsed.features_and_benefits.benefits.length > 0
          ? parsed.features_and_benefits.benefits
          : ['Menghemat waktu dan tenaga dalam rutinitas harian', 'Memberikan kepuasan pemakaian praktis kapan saja'],
      },
      buyer_psychology: {
        audience: parsed.buyer_psychology?.audience || 'Pria & Wanita aktif usia 20-35 tahun',
        pain_point: parsed.buyer_psychology?.pain_point || 'Peralatan lama terlalu besar, repot dibawa, dan membuang waktu',
        desire: parsed.buyer_psychology?.desire || 'Menginginkan kepraktisan dan hasil cepat dalam rutinitas harian',
        objection: parsed.buyer_psychology?.objection || 'Khawatir produk kurang awet atau sulit dibersihkan',
        purchase_trigger: parsed.buyer_psychology?.purchase_trigger || 'Kemudahan penggunaan instan dan jaminan kualitas',
      },
      seo_keywords: {
        primary: parsed.seo_keywords?.primary || fallbackName.toLowerCase(),
        secondary: parsed.seo_keywords?.secondary || `${fallbackName.toLowerCase()} praktis`,
        category: parsed.seo_keywords?.category || 'peralatan praktis harian',
        problem: parsed.seo_keywords?.problem || `solusi praktis ${fallbackName.toLowerCase()}`,
        buying_intent: parsed.seo_keywords?.buying_intent || `${fallbackName.toLowerCase()} terbaik`,
      },
      selling_angle: parsed.selling_angle || `Kepraktisan dan efisiensi tingkat tinggi dalam genggaman untuk rutinitas harian.`,
    };
  } catch (err: any) {
    logger.error(`[ProductIntelligenceAgent] JSON parse error: ${err.message}. Raw text: ${response.text.slice(0, 200)}`);
    const fallbackName = input.productName || 'Produk Unggulan';
    return {
      product_identity: {
        name: fallbackName,
        category: 'E-Commerce Lifestyle',
        brand: 'Official Store',
        material: 'Premium durable material',
        color: 'Aesthetic modern colorway',
        shape: 'Ergonomic compact form',
        texture: 'Smooth matte finish',
        features: ['Desain fungsional multifungsi', 'Material awet dan kokoh'],
      },
      visual_anchor: {
        shape: 'Ergonomic compact form',
        color: 'Aesthetic modern colorway',
        material: 'Premium durable material',
        texture: 'Smooth matte finish',
        unique_detail: 'Tactile control buttons and sleek brand finish',
      },
      features_and_benefits: {
        features: ['Ukuran compact mudah dibawa kemana saja', 'Efisiensi pemakaian harian'],
        benefits: ['Memudahkan mobilitas tanpa beban berat', 'Memberikan efisiensi waktu maksimal'],
      },
      buyer_psychology: {
        audience: 'Masyarakat aktif perkotaan usia 20-35 tahun',
        pain_point: 'Cara lama terlalu rumit dan membuang waktu',
        desire: 'Hasil cepat dan praktis kapan saja',
        objection: 'Ragu akan ketahanan material',
        purchase_trigger: 'Kemudahan praktis harian dan jaminan kepuasan',
      },
      seo_keywords: {
        primary: fallbackName.toLowerCase(),
        secondary: `rekomendasi ${fallbackName.toLowerCase()}`,
        category: 'peralatan lifestyle praktis',
        problem: `cara mudah pakai ${fallbackName.toLowerCase()}`,
        buying_intent: `${fallbackName.toLowerCase()} terbaik`,
      },
      selling_angle: `Kepraktisan tingkat tinggi dalam genggaman untuk rutinitas harian yang lebih efisien.`,
    };
  }
}

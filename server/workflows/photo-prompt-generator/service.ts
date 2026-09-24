import crypto from 'crypto';
import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { promptResponseCache, PROMPT_CACHE_TTL_MS } from '@/server/core/state/serverState';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { logger } from '@/server/core/utils/logger';

export interface GeneratePhotoPromptOptions {
  mimeType: string;
  base64Data: string;
  subjectReference?: string;
  productReference?: string;
  model?: string;
  targetGenerator?: string;
  photoStyle?: string;
  aspectRatio?: string;
  negativePrompt?: string;
  referenceImageBase64?: string;
  referenceImageMimeType?: string;
  analysisMode?: string;
  ultraDetail?: boolean;
  isUltra?: boolean;
  mode?: string;
  customApiKey?: string;
  clientAccessCode?: string;
  useCache?: boolean;
}

export async function generatePhotoPromptService(options: GeneratePhotoPromptOptions) {
  const {
    mimeType,
    base64Data,
    subjectReference,
    productReference,
    model,
    targetGenerator = 'nanobananapro',
    photoStyle = 'commercial',
    aspectRatio = '--ar 16:9',
    negativePrompt,
    referenceImageBase64,
    referenceImageMimeType,
    analysisMode,
    ultraDetail,
    isUltra,
    mode,
    customApiKey,
    clientAccessCode,
    useCache = true,
  } = options;

  if (!base64Data || !mimeType) {
    throw new Error('Data gambar/teks dan tipe MIME diperlukan');
  }

  const isUserExplicitChoice = Boolean(model && typeof model === 'string' && model.trim() && model !== 'auto');
  const userSelectedModel = (!model || model === 'auto') ? undefined : normalizeGeminiModel(model);

  if (useCache) {
    const cacheModelId = userSelectedModel || 'auto_routed';
    const cacheInput = `photo_${mimeType}_${base64Data.slice(0, 500)}_${base64Data.length}_${cacheModelId}_${targetGenerator}_${photoStyle}_${aspectRatio}_${negativePrompt || ''}_${subjectReference || ''}_${productReference || ''}_${referenceImageBase64 ? referenceImageBase64.slice(0, 500) : ''}`;
    const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');
    const cached = promptResponseCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < PROMPT_CACHE_TTL_MS) {
      logger.info('[Photo Prompt Cache Hit - Saved Quota]', cacheKey);
      return {
        prompt: cached.text,
        modelUsed: cached.modelUsed,
        tierUsed: (cached as any).tierUsed || 'cached',
        cached: true,
      };
    }
  }

  const promptText = `Anda adalah Master Unified Photo Prompt & Identity Architect AI (Director of Photography, TikTok Visual Hook Strategist, Multimodal Google AEO Entity Specialist, dan Consistency Guard).

MANDAT UTAMA ANDA:
Lakukan penalaran multimodal end-to-end tingkat tinggi (High Agentic Reasoning) dalam SATU KALI EKSEKUSI CERDAS untuk mentransformasikan input konsep/script video/gambar menjadi Prompt Foto AI Ultra-HD Fotorealistik (Midjourney v6.1 / Flux.1 / Nano Banana Pro / DALL-E 3).

EMPAT TAHAP PENALARAN AGENTIC DALAM SATU PASS:
1. TAHAP 1 (KONTEKS & EKSTRAKSI ENTITAS MENDALAM):
   - Pahami secara menyeluruh konteks naskah, apakah berasal dari ide konten, video-to-prompt, replika video viral, product-to-video, atau input custom.
   - Identifikasi hook visual 3 detik pertama, alur cerita, emosi, dan setting lingkungan.

2. TAHAP 2 (LOCKING SUBJECT & PRODUCT REFERENCE — ZERO-FLICKER & ANTI-MORPHING):
   - KUNCI IDENTITAS KARAKTER (SUBJECT REFERENCE):
     * Definisikan biometrik subjek yang sangat spesifik dan permanen: gender, usia spesifik, etnisitas/ras, bentuk wajah, warna kulit & mikro-pori-pori, model & warna rambut, serta detail busana/pakaian (bahan, warna, gaya).
     * ${subjectReference ? `User telah memberikan Subject Reference spesifik: "${subjectReference}". ANDA WAJIB MENGGUNAKAN & MENGUNCI IDENTITAS INI SECARA MUTLAK.` : 'Jika tidak diberikan spesifik oleh user, simpulkan dari konteks dan KUNCI satu set karakter biometrik & busana secara permanen.'}
     * Di semua klip/prompt, subjek HARUS MEMILIKI ANCHOR IDENTITAS YANG IDENTIK (ANTI-FLICKER saat di-render).
   - KUNCI IDENTITAS PRODUK (PRODUCT REFERENCE):
     * Definisikan spesifikasi fisik produk: nama produk, bentuk/dimensi, material permukaan (misal: frosted glass, brushed matte aluminum, glossy acrylic), warna pantone, detail tutup/wadah, dan letak label kemasan.
     * ${productReference ? `User telah memberikan Product Reference spesifik: "${productReference}". ANDA WAJIB MENGGUNAKAN & MENGUNCI SPESIFIKASI PRODUK INI SECARA MUTLAK.` : 'Jika ada produk dalam konteks, KUNCI bentuk, material, dan warna produk tersebut secara konsisten.'}
     * Di semua klip/prompt, produk HARUS MEMILIKI ANCHOR YANG 100% SAMA (ZERO-MORPHING).

3. TAHAP 3 (FISIKA OPTIK KAMERA, PENCAHAYAAN & KOMPOSISI):
   - Terapkan parameter kamera nyata: Kamera premium (Hasselblad H6D-100c / Sony A7R V / Arri Alexa 65), lensa prima (85mm f/1.2 untuk portrait, 35mm f/1.4 untuk lifestyle/scene), shallow depth of field, creamy bokeh, natural eye-level/cinematic angle.
   - Pencahayaan fotorealistik: Arah key light yang jelas, softbox diffusion, subtle rim light, pantulan bayangan ray-traced nyata, temperatur warna Kelvin yang sesuai mood.

4. TAHAP 4 (PROPAGASI MULTI-KLIP & FORMATTING SIAP SALIN):
   - JIKA INPUT MULTI-KLIP (BATCH SCENE BREAKDOWN):
     * Wajib menghasilkan TEPAT N prompt foto terpisah untuk setiap klip (Klip 1 s/d Klip N). Jangan kurangi!
     * Format header: "### 🎬 KLIP [X] ([TIMESTAMP]) — [JUDUL / FOKUS ADEGAN]".
     * Setiap klip memiliki blok prompt code (\`\`\`text ... \`\`\`) yang berdiri sendiri dan SIAP SALIN 1-KLIK.
     * Di setiap klip, tag [Subject Reference] dan [Product Reference] HARUS IDENTIK & TERKUNCI, sementara [Action & Dynamic Posing] serta [Scene Context] bertransisi dinamis mengikuti naskah.
   - JIKA INPUT SINGLE CONCEPT:
     * Buat satu master prompt lengkap dengan struktur tag yang kaya dan presisi tinggi.

STRUKTUR BLOK PROMPT WAJIB (JANGAN MENGUBAH NAMA TAG UTAMA AGAR TETAP KOMPATIBEL):
\`\`\`text
[Master Shot]: Hyper-realistic ${photoStyle} photography, TikTok FYP visual hook aesthetic, Google AEO high-relevance semantic framing.
[Subject Reference (Anti-Flicker)]: [Biometrik lengkap: gender, usia spesifik, etnisitas, struktur wajah, model & warna rambut, detail bahan pakaian & warna yang terkunci konsisten].
[Product Reference (Zero-Morphing)]: [Spesifikasi fisik produk: bentuk kemasan, material finishing, warna, detail label & prop yang terkunci konsisten].
[Action & Dynamic Posing]: [Aksi natural interaksi subjek terhadap produk/lingkungan pada adegan ini, gestur tangan, arah pandangan mata (eyeline match)].
[Scene Context & Environment]: [Latar belakang lokasi spasial yang kaya entitas, detail interior/eksterior, kedalaman ruang sinematik].
[Lighting & Atmospheric Physics]: [Setup pencahayaan presisi: arah key light, soft fill, subtle edge rim light, temperatur warna, bayangan volumetrik realistis].
[Camera, Optics & Composition]: [Bodi kamera profesional, lensa (focal length), aperture f-stop lebar, sudut pengambilan gambar, depth of field murni].
[Texture & Rendering Quality]: 8k UHD resolution, raw authentic documentary photograph, realistic micro skin pores, fabric threading, zero artificial airbrushing, photorealistic raytraced reflections, ${aspectRatio} --style raw --v 6.1
\`\`\`

FORMAT KESELURUHAN OUTPUT:
JIKA SINGLE PROMPT:
### 📸 TIKTOK-OPTIMIZED AI PROMPT (SUPER REALISTIS & SIAP COPY)
\`\`\`text
[Master Shot]: ...
[Subject Reference (Anti-Flicker)]: ...
[Product Reference (Zero-Morphing)]: ...
[Action & Dynamic Posing]: ...
[Scene Context & Environment]: ...
[Lighting & Atmospheric Physics]: ...
[Camera, Optics & Composition]: ...
[Texture & Rendering Quality]: 8k UHD resolution, raw authentic documentary photo, natural micro skin pores, fabric threading, zero artificial airbrushing, photorealistic raytraced reflections, ${aspectRatio} --style raw --v 6.1
\`\`\`

---

### 🔍 ANALISIS MENDALAM RELEVANSI SCENE & ALGORITMA
- **🎯 Anchor Karakter & Produk (Anti-Flicker)**: [Penjelasan spesifikasi biologis subjek dan fisik produk yang dikunci].
- **⚡ TikTok Visual Hook & Retention**: [Elemen visual 3 detik pertama yang menghentikan scroll].
- **💡 Setup Pencahayaan, Optik & Komposisi**: [Spesifikasi teknis kamera, lensa, dan lighting].
- **🎨 Color Grading & Tekstur Realistis**: [Palet warna dan detail material].

JIKA MULTI-KLIP (BATCH CLIPS):
### 🎬 KLIP 1 (00:00 - 00:10) — [HOOK VISUAL PEMBUKA]
\`\`\`text
[Master Shot]: ...
[Subject Reference (Anti-Flicker)]: ...
[Product Reference (Zero-Morphing)]: ...
[Action & Dynamic Posing]: ...
[Scene Context & Environment]: ...
[Lighting & Atmospheric Physics]: ...
[Camera, Optics & Composition]: ...
[Texture & Rendering Quality]: 8k UHD resolution, photorealistic micro details, ${aspectRatio} --style raw --v 6.1
\`\`\`

---

### 🔍 ANALISIS MENDALAM RELEVANSI KONTEN & KONSISTENSI VISUAL BATCH
- **🎯 Konsistensi Subjek & Produk (Anti-Flicker)**: [Penjelasan bagaimana Subject Reference dan Product Reference dikunci 100% konsisten dari klip awal hingga akhir].
- **⚡ Keselarasan Naskah & Visual Hook**: [Bagaimana visual tiap klip memperkuat alur cerita naskah].
- **💡 Rekomendasi Generator**: [Model gambar terbaik yang direkomendasikan seperti Midjourney v6.1, Flux.1, atau Nano Banana Pro].`;

  let extendedPromptText = promptText;
  if (negativePrompt && negativePrompt.trim()) {
    extendedPromptText += `\n\nTAMBAHKAN TAG NEGATIVE PROMPT PADA AKHIR BLOK: [Negative Prompt]: ${negativePrompt.trim()}`;
  }

  let promptPayload: any = {
    contents: {
      parts: []
    },
    config: {
      systemInstruction: "You are the world's leading Master Photo Prompt & Identity Architect AI. In a SINGLE unified pass with deep reasoning, generate hyper-realistic AI image prompts with locked Subject and Product Reference anchors (zero-flicker / anti-morphing), authentic camera physics, and complete visual algorithm compliance.",
    }
  };

  if (mimeType === 'text/plain') {
    const rawUserText = Buffer.from(base64Data, 'base64').toString('utf-8');
    let userContextBlock = `BERIKUT DESKRIPSI / KONSEP FOTO INPUT:\n"""\n${rawUserText}\n"""\n`;
    
    if (subjectReference && subjectReference.trim()) {
      userContextBlock += `\n📌 SPESIFIKASI SUBJECT REFERENCE (KUNCI IDENTITAS KARAKTER):\n"${subjectReference.trim()}"\n`;
    }
    if (productReference && productReference.trim()) {
      userContextBlock += `\n📌 SPESIFIKASI PRODUCT REFERENCE (KUNCI IDENTITAS PRODUK):\n"${productReference.trim()}"\n`;
    }

    promptPayload.contents.parts.push({
      text: `${userContextBlock}\n\nTUGAS UTAMA ANDA:\n${extendedPromptText}`
    });

    if (referenceImageBase64 && referenceImageMimeType) {
      promptPayload.contents.parts.push({
        text: `\n\nIni adalah IDENTITY ANCHOR REFERENCE IMAGE opsional yang diberikan user:`
      });
      promptPayload.contents.parts.push({
        inlineData: {
          mimeType: referenceImageMimeType,
          data: referenceImageBase64,
        },
      });
    }
  } else {
    promptPayload.contents.parts.push({
      inlineData: {
        mimeType: mimeType,
        data: base64Data,
      },
    });

    let extraRefText = extendedPromptText;
    if (subjectReference && subjectReference.trim()) {
      extraRefText = `📌 SPESIFIKASI SUBJECT REFERENCE DARI USER: "${subjectReference.trim()}"\n\n` + extraRefText;
    }
    if (productReference && productReference.trim()) {
      extraRefText = `📌 SPESIFIKASI PRODUCT REFERENCE DARI USER: "${productReference.trim()}"\n\n` + extraRefText;
    }

    promptPayload.contents.parts.push({
      text: extraRefText,
    });
  }

  const hasImageMedia = Boolean(
    (mimeType && mimeType.startsWith('image/')) ||
    referenceImageBase64
  );
  const isUltraMode = Boolean(
    ultraDetail ||
    isUltra ||
    mode === 'ultra' ||
    analysisMode === 'deep' ||
    analysisMode === 'ultra' ||
    (typeof photoStyle === 'string' && photoStyle.toLowerCase().includes('ultra'))
  );

  const photoTargetTier = (hasImageMedia || isUltraMode) ? 'flagship' : 'tier2';
  const photoToolName = 'photo_prompt';

  // Multi-Model Cascading Fallback (Gemini 3.8 -> 3.7 -> 3.6 -> 3.5 -> 3.1)
  const result = await callGeminiWithFallback(
    userSelectedModel,
    promptPayload,
    customApiKey,
    clientAccessCode,
    photoTargetTier,
    photoToolName,
    isUserExplicitChoice,
    '/api/generate-photo-prompt',
    false // isSingleRequestMode: false to enable cascading fallback across entire pool
  );

  let finalPromptText = (result.text || '').trim();
  if (!finalPromptText) {
    finalPromptText = `### 📸 TIKTOK-OPTIMIZED AI PROMPT (SUPER REALISTIS & SIAP COPY)
\`\`\`text
[Master Shot]: Hyper-realistic ${photoStyle} photography, commercial visual hook aesthetic.
[Subject Reference (Anti-Flicker)]: Authentic natural subject, realistic micro skin pores, photorealistic details.
[Scene Context & Environment]: Atmospheric studio depth with clean background gradient.
[Lighting & Atmospheric Physics]: Softbox diffused key light, subtle edge rim light, soft natural shadows.
[Camera, Optics & Composition]: Hasselblad H6D-100c, 85mm f/1.4 lens, shallow depth of field, cinematic eye-level framing.
[Texture & Rendering Quality]: 8k UHD resolution, raw authentic photograph, fine textures, photorealistic reflections, ${aspectRatio} --style raw --v 6.1
\`\`\`

---
### 🔍 ANALISIS MENDALAM RELEVANSI SCENE & ALGORITMA
- **🎯 Anchor Karakter & Visual**: Identitas subjek dan rasio terkunci fotorealistik (${aspectRatio}).
- **💡 Setup Pencahayaan & Optik**: Pencahayaan studio presisi dengan depth of field sinematik.`;
  }

  if (useCache) {
    const cacheModelId = userSelectedModel || 'auto_routed';
    const cacheInput = `photo_${mimeType}_${base64Data.slice(0, 500)}_${base64Data.length}_${cacheModelId}_${targetGenerator}_${photoStyle}_${aspectRatio}_${negativePrompt || ''}_${subjectReference || ''}_${productReference || ''}_${referenceImageBase64 ? referenceImageBase64.slice(0, 500) : ''}`;
    const cacheKey = crypto.createHash('sha256').update(cacheInput).digest('hex');
    promptResponseCache.set(cacheKey, {
      timestamp: Date.now(),
      text: finalPromptText,
      modelUsed: result.modelUsed,
    });
  }

  return {
    prompt: finalPromptText,
    modelUsed: result.modelUsed,
    tierUsed: result.tierUsed,
    latencyMs: result.latencyMs,
    keyMasked: result.keyMasked,
  };
}

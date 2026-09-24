import { KeywordSeed, IdeaHookAssignment } from '../types';

export function buildContentGeneratorPrompt(options: {
  totalIdeas: number;
  maxSecNum: number;
  segSecNum: number;
  expectedClipsCount: number;
  identityAnchorDescription: string;
  enrichedInfo: string;
  productDetails: string;
  classifiedKeywords: KeywordSeed[];
  ideasHookAssignments: IdeaHookAssignment[];
}): { finalPrompt: string; systemInstruction: string } {
  const {
    totalIdeas,
    maxSecNum,
    segSecNum,
    expectedClipsCount,
    identityAnchorDescription,
    enrichedInfo,
    productDetails,
    classifiedKeywords,
    ideasHookAssignments,
  } = options;

  let block1VisualRules = '';
  if (identityAnchorDescription) {
    block1VisualRules = `=== BLOCK 1: IDENTITY ANCHOR & STRICT VISUAL CONSISTENCY ===
Karakteristik Fisik Visual Produk Referensi (WAJIB DIJAGA 100% IDENTIK):
${identityAnchorDescription}

ATURAN VISUAL KONSISTEN:
- Setiap deskripsi visual pada semua klip segmen WAJIB menampilkan bentuk kemasan, warna utama, tekstur bahan, dan label yang identik persis dengan deskripsi di atas.
- Dilarang membuat produk berubah wujud, berubah warna kemasan, atau halusinasi merek antar adegan klip.`;
  } else {
    block1VisualRules = `=== BLOCK 1: GENERIC VISUAL RULES & PRODUCT CONSISTENCY ===
ATURAN VISUAL UMUM:
- Tampilkan produk dalam kualitas visual komersial beresolusi tinggi (ultra-sharp, realistic studio or natural lighting aesthetic).
- Pertahankan konsistensi identitas visual produk di setiap adegan (warna, material, proporsi fisik, label kemasan).
- Dilarang membuat visual produk yang berubah-ubah wujudnya di tengah video.`;
  }

  const block2EnrichedData = `=== BLOCK 2: VERIFIED PRODUCT DATA & STRICT CLAIM INTEGRITY ===
Data Hasil Riset / Enrichment Produk:
${enrichedInfo}
Catatan Tambahan User: ${productDetails || 'Tidak ada catatan khusus'}
Target Durasi Video: ${maxSecNum} detik (${expectedClipsCount} klip @ ${segSecNum} detik per klip)

ATURAN KLAIM & FAKTA:
- Semua klaim manfaat, fitur, formula, harga, dan fungsi WAJIB bersandar pada data terverifikasi di atas.
- Dilarang membuat klaim medis berlebihan, klaim instan tanpa dasar, atau janji palsu yang melanggar ketentuan TikTok Shop Indonesia.`;

  const keywordsFormattedText = classifiedKeywords
    .map((k, idx) => `  ${idx + 1}. "${k.keyword}" (Intent: ${k.intent.toUpperCase()})`)
    .join('\n');
  const hookAssignmentsFormattedText = ideasHookAssignments
    .map(
      a =>
        `  - Ide #${a.idea_number}: Hook Type = [${a.hook_type}], Primary Keyword = "${a.primary_keyword}" (${a.intent})`
    )
    .join('\n');

  const block3KeywordIntent = `=== BLOCK 3: KEYWORD INTENT & HOOK DIVERSITY ===
Daftar Keyword Pencarian TikTok Shop Terklasifikasi:
${keywordsFormattedText}

Penugasan Hook Type & Primary Keyword per Ide (WAJIB DITERAPKAN):
${hookAssignmentsFormattedText}

ATURAN HOOK DIVERSITY:
- Setiap ide WAJIB mengadopsi sudut pandang dan Hook Type yang telah ditentukan agar ragam video tidak monoton.
- Primary keyword yang ditugaskan WAJIB muncul secara eksplisit dalam 3 detik pertama narasi video (baik di teks layar maupun narasi suara).`;

  const block4PatenBinding = `=== BLOCK 4: FORMAT KLIP (WAJIB, JANGAN DILANGGAR) ===
Setiap klip adegan WAJIB ditulis dengan format bersih berikut (jangan buat format lain):

- Setiap klip mulai dengan baris waktu: 0–${segSecNum} detik
  (sesuaikan angka dengan pecahan durasi user, contoh: 0–${segSecNum} detik, ${segSecNum}–${segSecNum * 2} detik, ${segSecNum * 2}–${segSecNum * 3} detik, dst)
- Lanjut field berurutan, masing-masing di baris sendiri:
  Visual: [deskripsi visual detail 1-3 kalimat]
  Aksi: [gerakan konkret]
  voice over: "[teks natural pakai kamu]"
  Subteks: "[teks overlay singkat]"

Contoh persis:
0–${segSecNum} detik
Visual: [deskripsi visual detail 1-3 kalimat]
Aksi: [gerakan konkret subjek dan produk]
voice over: "[teks natural pakai kamu]"
Subteks: "[teks overlay singkat]"

${segSecNum}–${segSecNum * 2} detik
Visual: [deskripsi visual detail 1-3 kalimat berikutnya]
Aksi: [gerakan konkret kelanjutan adegan]
voice over: "[teks natural pakai kamu]"
Subteks: "[teks overlay singkat]"

ATURAN KETAT:
- Setiap klip mulai dengan baris waktu: 0–${segSecNum} detik (sesuaikan angka dengan pecahan durasi).
- Lanjut field berurutan, masing-masing di baris sendiri: Visual:, Aksi:, voice over:, Subteks:.
- Jangan gabungkan semua jadi 1 paragraf tanpa label.
- Jangan pakai [Style] [Camera] [Lighting].
- Jangan pakai header [0–2s] dulu (tunda format kurung siku agar parser stabil).
- Voice over wajib pakai kata "kamu".
- Jumlah klip menyesuaikan totalDuration / promptSplitSec (sekitar ${expectedClipsCount} klip @ ${segSecNum} detik).
- Boleh sebut Stage di dalam Visual/Aksi (opsional), tapi jangan buat header rumit.
- Tanpa BGM atau musik latar sama sekali.`;

  const block5OutputInstructions = `=== BLOCK 5: FORMAT OUTPUT RESMI (STRUKTUR 3 BAGIAN MARKDOWN) ===
FORMAT OUTPUT WAJIB (JANGAN MENGUBAH NAMA BAGIAN ATAU HEADING):

# 🛍️ ANALISIS PRODUK & IDE KONTEN VIRAL TIKTOK SHOP (${maxSecNum}s, ~${expectedClipsCount} Klip)

## 📦 BAGIAN 1: AI ANALISIS PRODUK (5 PILAR UTAMA & ENRICHMENT)
- **Kategori & Positioning**: [Kategori spesifik & positioning produk di pasar]
- **Bahan / Key Ingredients & Formulasi**: [Bahan aktif/material utama, keunggulan formula]
- **Pain Points yang Diselesaikan**: [3 masalah utama konsumen yang diselesaikan]
- **Benefit / Claim Utama**: [Klaim manfaat utama yang terbukti/terasa]
- **Target User & Persona**: [Demografi, usia, gaya hidup, kebiasaan target pembeli]
- **Estimasi Harga / Value for Money**: [Analisis harga dan perbandingan nilai]
- **BPOM / Keamanan / Sertifikasi**: [Status BPOM / Halal / Keamanan jika relevan]
- **Unique Selling Point (USP)**: [Keunikan yang membedakan dari kompetitor]
- **Mood & Tone Konten Ideal**: [Gaya penyampaian video paling cocok]

### 📝 Ringkasan Eksekutif Produk
[1 paragraf ringkasan padat tentang produk dan selling angle terkuatnya]

---

## 🔍 BAGIAN 2: MAPPING QUERY SEO TIKTOK (8-12 QUERY)

1. **Berdasarkan Masalah / Pain Point Konsumen**
- "[query 1]"
- "[query 2]"

2. **Berdasarkan Manfaat & Hasil Pemakaian**
- "[query 3]"
- "[query 4]"

3. **Berdasarkan Merek / Produk & Kategori Terkait**
- "[query 5]"
- "[query 6]"

4. **Berdasarkan Pertanyaan Populer / Mitos vs Fakta**
- "[query 7]"
- "[query 8]"

---

## 🚀 BAGIAN 3: GENERATE ${totalIdeas} IDE KONTEN VIRAL TIKTOK SHOP

Hasilkan persis ${totalIdeas} ide konten kreatif dengan format berikut untuk setiap ide:

### 💡 IDE 1: [Judul Ide Konten & Angle Hook]
- **Query SEO Acuan**: [Sebutkan 1 query dari Bagian 2]
- **Sudut Pandang / Angle**: [Pain Point / Benefit / Before-After / Edukasi / UGC Review / Mitos vs Fakta / Unboxing]
- **Hook Type**: [Result-first / Suspense-thinking / Conflict-contrast / Pain-point sesuai penugasan]
- **Target Audience**: [Sebutkan audiens target spesifik]
- **Hook 3 Detik Pertama (0-3s)**:
  - *Visual*: [Gambaran adegan pembuka yang menghentikan scroll]
  - *Text On Screen (TOS)*: "[Kalimat teks tebal di layar]"
  - *Voice Over (VO)*: "[Kalimat pembuka yang diucapkan (wajib ada primary keyword)]"
- **Rincian Adegan Video & Prompt AI per Segmen (${maxSecNum} Detik)**:
[Tuliskan seluruh segmen adegan klip mengikuti ATURAN FORMAT KLIP WAJIB:
Setiap klip mulai dengan baris waktu: 0–${segSecNum} detik, ${segSecNum}–${segSecNum * 2} detik, dst.

Format persis setiap klip:
0–${segSecNum} detik
Visual: [deskripsi visual detail 1-3 kalimat]
Aksi: [gerakan konkret]
voice over: "[teks natural pakai kamu]"
Subteks: "[teks overlay singkat]"

(Lanjutkan hingga seluruh segmen selesai sesuai total durasi ~${maxSecNum}s. Jangan gabungkan jadi 1 paragraf tanpa label. Jangan pakai header kurung siku [0–2s].)]
- **Call To Action (CTA)**:
  "[Kalimat ajakan klik keranjang kuning / promo stok terbatas]"
- **Rekomendasi Audio & Visual Style**:
  - *Audio / Sound*: [SFX dan Foley suara nyata - TANPA BGM]
  - *Visual Style*: [Pencahayaan, lokasi, prop visual, pacing video]
- **Draft Caption TikTok Shop**:
  [Draft caption persuasif 3-5 kalimat berkonversi tinggi: Kalimat 1 = Hook masalah/keinginan konsumen yang memikat; Kalimat 2-3 = Sebutkan Nama Produk secara eksplisit, keunggulan formula/fitur/USP terverifikasi; Kalimat 4 = Social proof / urgensi stok; Kalimat 5 = Call To Action (CTA) jelas mengajak klik keranjang kuning / cek promo hari ini]
- **Hashtag Relevan**: #[NamaProdukSpesifik] #[KategoriProduk] #[SolusiAtauManfaat] #[TargetNicheAudiens] #[KataKunciPencarianBelanja]

(CATATAN HASHTAG: Wajib persis 5 hashtag dengan 100% RELEVANSI PRODUK TINGGI. DILARANG KERAS memakai hashtag generik/spam seperti #fyp, #viral, #foryou, #trending, #xyzbca, #masukberanda!)

(Jika total ide lebih dari 1, buatkan juga ### 💡 IDE 2 dst dengan format yang sama)`;

  const finalPrompt = [
    `Anda adalah Master TikTok Shop Strategist, Video Director, dan Indonesian Prompt Engineer spesialis FYP TikTok Shop Indonesia.`,
    block1VisualRules,
    block2EnrichedData,
    block3KeywordIntent,
    block4PatenBinding,
    block5OutputInstructions,
  ].join('\n\n');

  const systemInstruction = `You are a senior TikTok Shop content strategist for Indonesian market.
RULES YOU MUST NEVER BREAK:
1. Output MUST have exactly 3 sections: BAGIAN 1 Analisis Produk, BAGIAN 2 Mapping Query SEO, BAGIAN 3 Ide Konten.
2. Each idea MUST use a DIFFERENT hook type (Result-first / Suspense-thinking / Conflict-contrast / Pain-point).
3. Video structure MUST follow 5 stages: Hook → Pain Scene → Solution Demo → Benefit/Proof → CTA (Stage may be mentioned inside Visual/Aksi optionally, no complicated headers).

CLIP FORMAT (STRICT):
Each clip starts with a time line like: 0–${segSecNum} detik
Then exactly these labels on separate lines:
Visual:
Aksi:
voice over:
Subteks:
Do not omit labels. Do not merge into one paragraph without labels.

4. Always use second person 'kamu' in voice over.
5. Primary keyword MUST appear in the first 3 seconds of voice over.
6. Do NOT invent product claims not present in the provided product data.
7. Language: Bahasa Indonesia natural gaya TikTok.
8. No English bracket tags like [Style], [Camera], [Lighting].
9. High Product Relevance Captions: Craft 3-5 sentence persuasive selling copy explicitly mentioning the product name, verified USP/formula benefits, pain points solved, and clear basket checkout CTA.
10. High Product Relevance Hashtags: Generate exactly 5 ultra-relevant hashtags (1 Product Name, 2 Category/Niche, 1 Problem/Benefit, 1 Buying Intent). NEVER output generic spam hashtags like #fyp, #viral, #foryou, #trending, #xyzbca, #masukberanda.`;

  return { finalPrompt, systemInstruction };
}

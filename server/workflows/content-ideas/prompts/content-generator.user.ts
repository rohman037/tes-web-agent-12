export interface BuildContentGeneratorPromptOptions {
  totalIdeas: number;
  maxSecNum: number;
  segSecNum: number;
  expectedClipsCount: number;
  allIdeasTemplate: string;
  timestampGuideList: string[];
  groundingContext: string;
  productContext: string;
  contentType: string;
  tone: string;
  queryCouncilResult: {
    final_short_query_targets: string[];
    final_long_tail_queries: string[];
  };
  userSeedQueriesClean: string[];
}

export function buildContentGeneratorUserPrompt(options: BuildContentGeneratorPromptOptions): string {
  const {
    totalIdeas,
    maxSecNum,
    segSecNum,
    expectedClipsCount,
    allIdeasTemplate,
    timestampGuideList,
    groundingContext,
    productContext,
    contentType,
    tone,
    queryCouncilResult,
    userSeedQueriesClean,
  } = options;

  const hasCouncilQueries =
    queryCouncilResult.final_short_query_targets?.length > 0 ||
    queryCouncilResult.final_long_tail_queries?.length > 0;

  return `Anda adalah TikTok Content Strategist & Anti-AI-Slop Indonesian Copywriter Spesialis FYP Ranking TikTok Indonesia.

TUGAS UTAMA TAHAP 2:
Buatkan ${totalIdeas} IDE KONTEN VIRAL SANGAT OPTIMAL, RELEVAN, & PERSUASIF berdasarkan DATA HASIL ANALISIS TAHAP 1 TERLAMPIR.

${
  hasCouncilQueries
    ? `=== HASIL DEWAN 10 AGENT QUERY TAHAP 0 (WAJIB DIPAKAI, DILARANG MENGARANG QUERY BARU) ===
Short Query Targets: ${(queryCouncilResult.final_short_query_targets || []).join(' | ')}
Long-Tail Queries: ${(queryCouncilResult.final_long_tail_queries || []).join(' | ')}
${userSeedQueriesClean.length > 0 ? `Seed Asli dari User (prioritas tertinggi): ${userSeedQueriesClean.join(' | ')}` : ''}
==================================================================

ATURAN QUERY FAN-OUT (DIPERKETAT):
1. SETIAP query yang dicantumkan di "AEO SYNTHETIC QUERY FAN-OUT" dan di
   "AEO Query Mapping" tiap ide WAJIB diambil PERSIS atau nyaris identik dari
   daftar Dewan 10 Agent di atas. DILARANG membuat query baru yang tidak ada
   di daftar tersebut — ini untuk mencegah halusinasi.`
    : `=== AEO SYNTHETIC QUERY FAN-OUT & MAPPING ===
1. Hasilkan dan cantumkan 5-9 synthetic long-tail queries secara mandiri berdasarkan topik dan konteks yang ada.
2. Lakukan "AEO Query Mapping" untuk setiap ide dengan mengaitkannya ke query yang relevan yang telah Anda hasilkan.`
}

=== DATA GROUNDING FAKTUAL TAHAP 1 (MANDATORI DIIKUTI 100%) ===
"""
${groundingContext}
"""
==================================================================

${
  productContext
    ? `
========================================
DATA PRODUK UTAMA (DARI TIKTOK SHOP / USER)
========================================
${productContext}
`
    : ''
}

KONFIGURASI TARGET REPLIKA:
- Target Total Durasi Video: ${maxSecNum} Detik
- Target Jenis Konten: ${contentType.toUpperCase()}
- Tone Bahasa: ${tone.toUpperCase()}

FORMAT OUTPUT WAJIB:
${allIdeasTemplate}

ATURAN STRUKTUR PROMPT VIDEO DI BAGIAN "Rincian Adegan Video & Prompt AI per Segmen":
1. WAJIB mengikuti format breakdown timeline Bahasa Indonesia per segmen:
   [start]–[end] detik
   Visual: [deskripsi visual sangat detail: lokasi, pencahayaan, sudut kamera, subjek (orang + pakaian + ekspresi), objek produk, posisi, tekstur, suasana]
   Aksi: [gerakan konkret yang terjadi di detik tersebut]
   voice over: [teks voice over natural] (atau Subteks: [teks overlay atau makna tersirat])
2. Setiap segmen HARUS memiliki tepat 3 bagian: Visual, Aksi, dan (voice over ATAU Subteks).
3. Gunakan "voice over:" jika ada narasi suara. Gunakan "Subteks:" jika lebih cocok sebagai teks overlay / makna tersirat.
4. DURASI & PEMBAGIAN SEGMEN:
   - Target total durasi: ${maxSecNum} detik, dibagi menjadi persis ${expectedClipsCount} klip segmen (masing-masing berdurasi ${segSecNum} detik).
   - Rentang waktu tiap klip WAJIB mengikuti durasi ${segSecNum} detik penuh:
${timestampGuideList.map(item => '     ' + item.split('\n')[0]).join('\n')}
   - DILARANG memecah menjadi potongan mikro 2-3 detik! Setiap segmen adalah 1 PROMPT UTUH SIAP SALIN berdurasi ${segSecNum} detik untuk AI Video Generator (Sora, Kling, Minimax, Hailuo, Runway).
5. Visual harus sangat kaya detail: lokasi, pencahayaan, sudut kamera, subjek, objek produk, posisi, tekstur, dan suasana.
6. Aksi harus menjelaskan gerakan konkret yang terjadi di detik tersebut.
7. Bahasa harus natural, gaya TikTok Indonesia (santai, persuasif, mudah dipahami).
8. DILARANG menggunakan format Inggris, tag [Style], [Camera], [Lighting], [Actions], atau codeblock Inggris.
9. Jaga konsistensi visual di semua klip.
10. ATURAN CAPTION RELEVANSI PRODUK TINGGI:
    - Caption wajib 3-5 kalimat persuasif dengan alur hook masalah $\rightarrow$ demonstrasi solusi & keunggulan nama produk $\rightarrow$ CTA jelas.
    - Wajib menyematkan nama produk/entitas utama dan 2-3 kata kunci manfaat spesifik secara organik.
11. ATURAN HASHTAG RELEVANSI PRODUK TINGGI (TEPAT 5 HASHTAG):
    - Wajib memberikan persis 5 hashtag dengan formula: #[NamaProduk] #[KategoriSpesifik] #[ManfaatAtauSolusi] #[TargetNiche] #[KataKunciPencarian].
    - DILARANG KERAS menggunakan hashtag spam seperti #fyp, #viral, #foryou, #trending, #xyzbca, #masukberanda.
`;
}

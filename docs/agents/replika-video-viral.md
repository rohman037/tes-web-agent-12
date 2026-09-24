# Workflow: Replika Video Viral (Content Ideas)

## Deskripsi
Workflow pembuatan ide konten dan replika video viral berbasis analisis DNA video kompetitor atau tren, digabungkan dengan intelijen produk/layanan.

## Pipeline Agents
1. **Video DNA Extractor** (`agents/video-dna-extractor.ts`)
   - Menganalisis transkrip, gaya visual, hook pacing, dan dynamic storytelling dari video referensi.
2. **Product Intelligence** (`agents/product-intelligence.ts`)
   - Memetakan USP, fitur, pain-point audiens, dan positioning produk.
3. **Content Generator** (`agents/content-generator.ts`)
   - Memproduksi naskah storyboard klip per klip (Visual, Aksi, Voice Over, Subteks, Sound Effect).
4. **Copy Refiner** (`agents/copy-refiner.ts`)
   - Memperbaiki copywriting dan tone of voice lokal Indonesia (natural, anti-slop).
5. **Indonesian Query Council** (`agents/query-council.ts`)
   - Merumuskan kata kunci pencarian SEO TikTok (Short & Long-tail search queries) serta max 5 hashtag non-spam.

## Output Validator
- Memvalidasi 17 poin kepatuhan format (`validators/output-validator.ts`), konsistensi timeline, dan kepatuhan anti-slop.

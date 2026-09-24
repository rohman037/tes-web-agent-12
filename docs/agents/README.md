# Agents Architecture Specification

Dokumen ini mendefinisikan arsitektur modular AI Agent yang digunakan pada platform ini.

## Prinsip Desain
1. **Single Responsibility per Agent**: Setiap file agen bertanggung jawab atas satu fase inferensi atau data gathering spesifik.
2. **Decoupled Prompts**: File prompt dipisahkan dari logika eksekusi agen (`prompts/` vs `agents/`).
3. **Decoupled Validation**: Evaluasi output, struktur klip, dan validasi kualitas diletakkan di folder `validators/`.
4. **Resilient Routing**: Menggunakan cascading multi-tier model LLM Gateway (`flagship` -> `tier2` -> `tier3` -> `tier4`).

## Agen pada Workflow: Replika Video Viral (`server/workflows/content-ideas/`)
- `video-dna-extractor.ts`: Mengekstrak fakta fisik visual, aksi tangan, ekspresi, dan audio dari video sumber.
- `product-intelligence.ts`: Mengambil metadata TikTok Shop dan mengekstrak anchor identitas visual dari gambar referensi.
- `content-generator.ts`: Merancang ide video TikTok viral lengkap dengan timeline per segmen (Visual, Aksi, voice over/Subteks).
- `copy-refiner.ts`: Menilai ulang dan melengkapi output jika struktur ide tidak lengkap.

## Agen pada Workflow: Produk to Video (`server/workflows/tiktok-shop-ideas/`)
- `identity-anchor-agent.ts`: Menganalisis ciri visual fisik produk dari foto referensi (menghindari flickering identitas antar adegan).
- `link-enricher-agent.ts`: Melakukan HTTP fetch metadata OpenGraph & konten halaman produk e-commerce.
- `keyword-classifier-agent.ts`: Mengelompokkan search intent (problem, result, curiosity, price) dan menetapkan hook diversity.
- `content-generator-agent.ts`: Menghasilkan 3 bagian terstruktur: Analisis 5 Pilar, 8-12 Mapping Query SEO, dan Ide Konten Viral.
- `copy-refiner-agent.ts`: Memperbaiki caption persuasif dan memastikan tepat 5 hashtag relevan jika output awal kurang optimal.

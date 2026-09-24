# Workflow: Produk to Video (TikTok Shop Ideas)

## Deskripsi
Workflow pembuatan video promosi TikTok Shop & Affiliate berbasis produk fisik atau tautan e-commerce dengan penekanan pada konversi penjualan, jangkar identitas produk, dan SEO indexing.

## Pipeline Agents
1. **Identity Anchor** (`agents/identity-anchor.ts`)
   - Mengunci identitas visual produk, kemasan, warna primer, dan kata kunci immutable.
2. **Link Enricher** (`agents/link-enricher.ts`)
   - Mengekstrak informasi dari URL atau data produk mentah (spesifikasi, harga, klaim verifikasi).
3. **Keyword Classifier** (`agents/keyword-classifier.ts`)
   - Mengklasifikasikan intent pencarian audiens (komersial, edukasi, perbandingan).
4. **Content Generator** (`agents/content-generator.ts`)
   - Membangun adegan klip terstruktur dengan transisi, call-to-action, dan visual promosi yang persuasif.
5. **Copy Refiner** (`agents/copy-refiner.ts`)
   - Memoles naskah voice over agar terdengar seperti rekomendasi teman akrab (tanpa kata buzzword basi).

## Validators
- `validators/output-validator.ts`: Validasi struktur klip, label, dan kelengkapan prompt visual.
- `validators/quality-validator.ts`: Validasi skor kepatuhan, keaslian klaim produk, dan batasan hashtag.

export function buildCopyRefinerPrompt(currentGeneratedText: string): { prompt: string; systemInstruction: string } {
  const prompt = `Anda adalah TikTok Shop Copywriter Specialist untuk pasar Indonesia.
Perbaiki HANYA bagian Draft Caption TikTok Shop dan Hashtag Relevan pada setiap Ide Konten berikut agar memiliki RELEVANSI PRODUK TINGGI (High Product Relevance & Conversion).

ATURAN KETAT:
1. JANGAN ubah bagian script, timeline, visual, aksi, atau dialog video klip sama sekali!
2. CAPTION RELEVANSI PRODUK TINGGI:
   - Wajib 3-5 kalimat persuasif yang secara eksplisit menyebut Nama Produk & Varian.
   - Wajib menyertakan 2-3 keunggulan/USP produk atau formula nyata dari data analisis Bagian 1.
   - Menggunakan hook pikat masalah/kebutuhan konsumen di awal dan Call To Action (CTA) konversi tinggi di akhir ("klik keranjang kuning sekarang").
3. HASHTAG RELEVANSI PRODUK TINGGI (TEPAT 5 HASHTAG):
   - Wajib menggunakan formula 5 hashtag relevansi produk spesifik:
     1. #[NamaProdukSpesifik] (misal: #SkintificMoisturizer / #KesetKucing3D)
     2. #[KategoriProduk] (misal: #SkincareRoutine / #DekorasiRumah)
     3. #[SolusiAtauManfaatProduk] (misal: #SkinBarrierRusak / #KamarMandiAesthetic)
     4. #[TargetNicheAudiens] (misal: #PejuangAcne / #CatLoversIndonesia)
     5. #[KataKunciPencarianBelanja] (misal: #RekomendasiSkincare / #RacunBelanjaID)
   - DILARANG KERAS menggunakan hashtag spam/generik (#fyp, #viral, #foryou, #trending, #xyzbca, #masukberanda).
4. Kembalikan teks utuh lengkap dengan format persis aslinya (BAGIAN 1, BAGIAN 2, BAGIAN 3), hanya perbaiki Draft Caption TikTok Shop dan Hashtag Relevan menjadi sempurna.

Teks Lengkap:
${currentGeneratedText}`;

  const systemInstruction =
    'Anda adalah spesialis copywriting TikTok Shop. Perbaiki HANYA draft caption dan hashtag menjadi copywriting konversi tinggi dengan 5 hashtag relevan produk spesifik (tanpa hashtag spam), tanpa merubah script video.';

  return { prompt, systemInstruction };
}

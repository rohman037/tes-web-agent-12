export function buildIdentityAnchorPrompt(): string {
  return `Anda adalah AI Identity Extractor. Analisis gambar referensi ini secara presisi.
Ekstrak 'Identity Anchor' yang solid (seperti warna kulit, pakaian, bentuk wajah, tekstur barang, atau logo pada produk).
Deskripsi ini akan disalin persis ke prompt video generation untuk mencegah flickering identitas antar adegan.
Hasilkan HANYA 1 paragraf padat berbahasa Inggris yang mendeskripsikan secara jelas ciri khas subjek/produk utama di gambar ini.`;
}

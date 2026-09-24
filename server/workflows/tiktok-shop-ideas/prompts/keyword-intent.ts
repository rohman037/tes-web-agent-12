export function buildKeywordClassifierPrompt(
  derivedProductName: string,
  productDetails: string,
  enrichedInfo: string,
  totalIdeas: number
): string {
  return `Anda adalah TikTok Shop SEO & Consumer Search Intent Specialist untuk pasar Indonesia.
Analisis produk berikut dan tentukan 8-12 keyword intent serta variasi hook konten video.

Informasi Produk:
- Nama Produk / Konteks: ${derivedProductName}
- Detail Input User: ${productDetails || 'Tidak ada catatan tambahan'}
- Ringkasan Data Produk: ${enrichedInfo ? enrichedInfo.slice(0, 700) : 'Dari foto referensi & link'}

TUGAS UTAMA:
1. Hasilkan 8–12 keyword seeds pencarian TikTok Indonesia yang relevan, dicari audiens lokal, dan bernilai beli tinggi (High Commercial Intent).
2. Klasifikasikan setiap keyword ke dalam salah satu dari 4 intent:
   - "problem" (keluhan/masalah/gejala audiens)
   - "result" (bukti hasil/before-after/efektivitas produk)
   - "curiosity" (review jujur/rasa penasaran/apakah worth it)
   - "price" (harga promo/diskon/murah/hemat)
3. Alokasikan penugasan hookType yang BERBEDA untuk masing-masing ${totalIdeas} ide video:
   Pilihan hookType: "Result-first", "Suspense-thinking", "Conflict-contrast", "Pain-point".
   Setiap ide WAJIB memiliki hookType yang berbeda dan 1 primary_keyword spesifik.

OUTPUT WAJIB JSON KETAT (hanya JSON valid, tanpa markdown pembuka/penutup):
{
  "product_summary": "Nama ringkas produk",
  "keywords": [
    { "keyword": "...", "intent": "problem" },
    { "keyword": "...", "intent": "result" },
    { "keyword": "...", "intent": "curiosity" },
    { "keyword": "...", "intent": "price" }
  ],
  "ideas_hook_assignment": [
    { "idea_number": 1, "hook_type": "Result-first", "primary_keyword": "...", "intent": "result" },
    { "idea_number": 2, "hook_type": "Pain-point", "primary_keyword": "...", "intent": "problem" }
  ]
}`;
}

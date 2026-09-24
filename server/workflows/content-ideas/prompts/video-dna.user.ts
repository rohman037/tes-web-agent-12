export function buildVideoDNAUserPrompt(sourceTitle: string = '', topic: string = ''): string {
  const mainInstruction = `Anda adalah AI Video Vision Analyzer tingkat presisi tinggi.
TUGAS TAHAP 1: Analisis video ini dari detik awal sampai akhir secara objektif tanpa mengarang.
Ekstrak struktur data internal faktual berikut:
1. Objek/Produk yang BENAR-BENAR terlihat di frame (nama barang, warna, bahan, detail visual unik, kancing, motif, kerah, jahitan, packaging).
2. Aksi Tangan / Orang yang BENAR-BENAR terjadi (misal: memegang kerah, membalik lengan baju, menunjuk detail kancing, mengoleskan krim, membuka kemasan, mengangkat barang ke kamera).
3. Environment / Setting Asli Video (ruang tamu, kamar, studio, latar belakang, lighting, suasana).
4. Ekspresi & Gesture yang Terlihat (apabila ada orang/presenter di video).
5. Transkrip Audio / Teks Terdeteksi (jika ada suara/VO/teks asli di video).

JIKA ADA BAGIAN DETAIL YANG TIDAK JELAS ATAU TIDAK TERDETEKSI: Tandai eksplisit sebagai "[Kurang yakin / Tidak terdeteksi jelas]". JANGAN PERNAH MENGARANG AKSI ATAU PRODUK YANG TIDAK ADA.`;

  return `${mainInstruction}\n\nJudul/Caption Video: ${sourceTitle || '-'}\nCatatan Tambahan: ${topic || '-'}`;
}

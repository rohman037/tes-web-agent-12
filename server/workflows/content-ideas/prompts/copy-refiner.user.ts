export function buildCopyRefinerUserPrompt(
  groundingContext: string,
  rawText: string,
  totalIdeas: number,
  allIdeasTemplate: string
): string {
  return `BERIKUT DATA ANALISIS VISUAL TAHAP 1:
"""
${groundingContext}
"""

BERIKUT HASIL YANG TERDETEKSI KURANG LENGKAP:
"""
${rawText}
"""

TUGAS VALIDASI:
Lengkapi kembali ${totalIdeas} ide konten viral sesuai format:
${allIdeasTemplate}

Pastikan bagian rincian adegan video memakai format:
0–2 detik
Visual: ...
Aksi: ...
voice over: ...

2–3,8 detik
Visual: ...
Aksi: ...
Subteks: ...`;
}

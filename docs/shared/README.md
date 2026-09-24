# Shared Workflow Utilities

Direktori `server/workflows/shared/` menyediakan utilitas bersama yang digunakan oleh berbagai workflow agen:
- `callGeminiWithFallback`: Memanggil AI dengan proteksi fallback tier otomatis.
- `normalizeGeminiModel`: Memastikan nama model selalu valid dan sesuai alias Gemini SDK terbaru.
- `sanitizeCaptionsAndHashtags`: Pembersihan teks, penghapusan karakter escape berlebih, dan standardisasi format hashtag.
- `promptResponseCache`: Cache respon SHA256 in-memory untuk menghemat kuota dan memangkas latency.
- `recordExecutionAndUpgrade`: Pencatatan metrik eksekusi workflow ke dalam memori sistem.

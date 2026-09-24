# Panduan Arsitektur & Operasional Sistem

Selamat datang di repositori **Remix proses perbaikan tollssatset-v4**. Sistem ini adalah platform *All-in-One Creator AI Workspace & Admin Suite* berbasis TypeScript (Express + React 18 + Vite).

---

## 📁 Struktur Repositori

```text
├── config/                      # Konfigurasi aplikasi & Firebase applet config
├── docs/                        # Dokumentasi arsitektur, API, dan agen
│   ├── agents/                  # Spesifikasi modular agent per workflow
│   ├── api/                     # Daftar route & controller API
│   └── shared/                  # Utilitas bersama workflow
├── scripts/                     # Skrip otomasi, build, dan pemeliharaan
│   ├── firebase/                # Skrip database & seed Firestore
│   ├── build.sh                 # Skrip build produksi
│   ├── deploy.sh                # Skrip persiapan deployment
│   └── _archive/                # Arsip script historis
├── server/                      # Backend Core & Workflows
│   ├── core/                    # Engine inti (LLM Gateway, Routing, State, TikTok fetcher)
│   └── workflows/               # Domain workflow bisnis
│       ├── content-ideas/       # Workflow Replika Video Viral (Agents, Prompts, Validators)
│       ├── tiktok-shop-ideas/   # Workflow Produk to Video (Agents, Prompts, Validators)
│       ├── photo-prompt-generator/
│       ├── video-to-prompt/
│       ├── tiktok-downloader/
│       ├── frame-extractor/
│       ├── api-keys/
│       ├── clients/
│       ├── packages/
│       ├── payments/
│       └── shared/              # Shared workflow exports
├── src/                         # Frontend React UI (Tailwind CSS, Lucide icons)
├── storage/                     # Penyimpanan data cache lokal
└── server.ts                    # Entry point server Express + Vite middleware
```

---

## 🚀 Perintah Operasional

- **Menjalankan Dev Server**: `npm run dev`
- **Build Produksi**: `npm run build`
- **Menjalankan Build Produksi**: `npm start`
- **Seeding Database Firestore**: `npm run seed:firestore`
- **Verifikasi Cache Lokal**: `npx tsx scripts/firebase/fix-cache.ts`
- **Verifikasi Integritas Database**: `npx tsx scripts/firebase/fix-db.ts`

---

## 🤖 Standar Arsitektur AI Agent
1. **Agent Decoupling**: Setiap tahapan berpikir AI dipecah ke dalam file agen tersendiri di `agents/`.
2. **Externalized Prompts**: Teks prompt sistem dan instruksi pengguna berada di direktori `prompts/`.
3. **Automated Validation**: Format output dan kepatuhan timeline klip divalidasi oleh modul di `validators/`.
4. **Resilient LLM Routing**: Seluruh inferensi dilindungi oleh rotasi API key dan fallback tier otomatis di `server/core/llm/`.

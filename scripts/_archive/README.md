# Arsip Skrip Migrasi & Patch Manual

Direktori ini (`scripts/_archive/`) menyimpan catatan skrip-skrip patch ad-hoc / one-off yang pernah digunakan pada iterasi migrasi sebelumnya.

## Daftar Skrip
- `fix_cache.cjs`: Inisialisasi awal cache JSON.
- `fix_db_keys.cjs`: Normalisasi format key database lokal.
- `fix_db_memory.cjs`: Pengaturan struktur in-memory storage.
- `fix_firebase_admin.cjs`: Skrip pembantu auth admin.
- `fix_payment.cjs`: Patch status transaksi pembayaran.
- `fix_rules.cjs` & `update_rules.cjs`: Konfigurasi rules Firestore.
- `fix_ts.cjs`: Perbaikan tipe data TypeScript.
- `generate_routers.cjs` & `split_server.js`: Skrip pemecah monolithic router ke modular express routes.
- `patch_client_panel.cjs`, `patch_payment.cjs`, `patch_user_layout.cjs`: Patch layout UI.
- `update_metadata.cjs`: Skrip pembantu sinkronisasi metadata.

> **Catatan**: Skrip operasional harian kini berada di:
> - `scripts/firebase/seed-firestore.ts` (Inisialisasi & Seeding Firestore)
> - `scripts/firebase/fix-cache.ts` (Perbaikan cache database)
> - `scripts/firebase/fix-db.ts` (Verifikasi integritas database)
> - `scripts/build.sh` (Build script)
> - `scripts/deploy.sh` (Deploy script)

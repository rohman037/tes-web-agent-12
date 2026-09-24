# Panduan Pengujian Sistem (Testing Guide)

Dokumentasi ini menjelaskan arsitektur pengujian, standar mocking, konvensi penamaan, dan cara menjalankan unit serta integration test untuk **Creator AI Workspace & Admin Suite**.

---

## 1. Perintah Menjalankan Test

| Perintah | Deskripsi |
| :--- | :--- |
| `npm run test` | Menjalankan seluruh test suite satu kali (non-interactive). |
| `npm run test:watch` | Menjalankan test dalam mode watch interaktif saat pengembangan. |
| `npm run test:coverage` | Menghasilkan laporan coverage detail di terminal dan direktori `coverage/`. |
| `npm run test:ci` | Perintah standar untuk CI/CD (single run + threshold check, exit code `0` jika sukses). |

---

## 2. Struktur & Konvensi Direktori

```text
tests/
├── fixtures/                    # Data dummy deterministik & mock response
│   ├── dbFixtures.ts            # Fixture API Keys, Clients, Packages, Payments
│   └── llmFixtures.ts           # Fixture response LLM JSON & malformed
├── integration/                 # Pengujian integrasi API Express, RBAC, & Error Contracts
│   └── api-endpoints.test.ts
├── unit/                        # Unit test terisolasi per-modul
│   ├── clients-packages.test.ts # Kuota klien, expiry cron, fake timers
│   ├── llm-routing.test.ts      # Rotasi key, scoring, cooldown & fallback
│   ├── payments.test.ts         # State transition pembayaran & approval
│   ├── sanitizer.test.ts        # XSS, Emoji, Unicode, & Markdown cleaner
│   └── validators.test.ts       # Output validator tiap workflow
└── setup.ts                     # Konfigurasi environment & global cleanup
```

---

## 3. Konvensi Penamaan

* **File Test**: Gunakan akhiran `.test.ts` (contoh: `validators.test.ts`, `payments.test.ts`).
* **Describe & It**:
  * Gunakan kalimat deskriptif bahasa Inggris atau Indonesia yang jelas:
    ```typescript
    describe('Unit Test: Payment Workflow', () => {
      it('should transition status from CREATED to AWAITING_VERIFICATION on proof upload', async () => {
        // ...
      });
    });
    ```

---

## 4. Standar Mocking (100% Offline & Deterministic)

1. **Panggilan LLM / AI Gateway**:
   - DILARANG memanggil API Google GenAI / Gemini asli dalam test suite.
   - Selalu gunakan fixture respons dari `tests/fixtures/llmFixtures.ts` atau `vi.spyOn()`.

2. **Database Firestore**:
   - Mock seluruh pemanggilan `dbGet...` dan `dbSave...` dari `@/src/db/dbService` dengan in-memory state.
   - Contoh:
     ```typescript
     vi.spyOn(dbService, 'dbGetApiKeys').mockImplementation(async () => mockKeys);
     ```

3. **Waktu & Cron (Fake Timers)**:
   - Pengujian yang melibatkan batas waktu, cooldown, atau tanggal kadaluwarsa klien WAJIB menggunakan `vi.useFakeTimers()`.
   - Contoh:
     ```typescript
     beforeEach(() => {
       vi.useFakeTimers();
       vi.setSystemTime(new Date('2026-01-01T00:00:00Z'));
     });
     afterEach(() => {
       vi.useRealTimers();
     });
     ```

---

## 5. Ambang Batas Coverage (Coverage Thresholds)

Sesuai `vitest.config.ts`, standar minimum coverage:
* **Statements**: 60%
* **Branches**: 50%
* **Functions**: 60%
* **Lines**: 60%

---

## 6. Cara Menambahkan Test Baru

1. Buat file baru di `tests/unit/nama-fitur.test.ts` atau `tests/integration/nama-fitur.test.ts`.
2. Impor helper dan fixture dari `tests/fixtures/`.
3. Tulis pengujian untuk *happy path* (kasus normal), *edge cases* (input null/kosong/panjang), dan *error path* (status 400/401/403/429/500).
4. Jalankan `npm run test` untuk memverifikasi.

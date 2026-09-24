# Panduan Observability & Reliability Runbook (Sentry + OpenTelemetry)

Dokumentasi ini menjelaskan arsitektur observability, standarisasi tracing, matriks eskalasi alert, dan runbook investigasi insiden untuk **Creator AI Workspace & Admin Suite**.

---

## 1. Arsitektur Observability

```text
[ React 18 Client ]  ──(Web Vitals & Error Boundary)──> [ Sentry Frontend ]
         │
         │ (HTTP / SSE / REST)
         ▼
[ Express Server ]   ──(Request Middleware & Profiling)──> [ Sentry Backend ]
         │
         ├─ [ OpenTelemetry Tracer (OTLP) ] ──> Distributed Trace Collector
         ├─ [ LLM Gateway & Key Pool ]       ──> Span: llm.* (Prompt Hash, Model, Cost, Latency)
         ├─ [ Firestore Data Engine ]       ──> Span: firestore.* (Slow Query >500ms Tracker)
         └─ [ Autonomous Cron Schedulers ]  ──> Sentry Cron Job Monitors
```

---

## 2. Cara Membaca Dashboard & Telemetri

### A. Sentry Issues (Error Tracking)
- **Tag Filter**:
  - `workflow.name`: Memfilter error berdasarkan workflow AI (`workflow_video_prompt_seo_generation`, dll).
  - `llm.model`: Memfilter kegagalan spesifik model (`gemini-2.5-flash`, `gemini-2.5-pro`).
  - `http.status_code`: Mengidentifikasi lonjakan `429` (Quota/Rate Limit), `401` (Unauthorized API Key), atau `503`.
- **Breadcrumbs**:
  - Setiap rotasi API key atau retry model dicatat dalam breadcrumb berkategori `llm.key_rotation`.

### B. OpenTelemetry Distributed Traces
- **Root Span**: `HTTP GET/POST /api/...`
- **Child Spans**:
  - `llm.<task_type>`: Mencakup atribut `llm.model`, `llm.prompt_hash`, `llm.tokens.prompt`, `llm.tokens.completion`, `llm.latency_ms`, `llm.estimated_cost_usd`.
  - `firestore.<operation>`: Menandai `db.slow_query: true` jika durasi melebihi 500ms.

---

## 3. Matriks Eskalasi Alert (Severity Levels)

| Level | Kondisi / Trigger | Channel | SLA Respons | Tindakan |
| :--- | :--- | :--- | :--- | :--- |
| **P0 (Critical)** | Semua API key di pool rate limited / 503 outage > 2 menit | PagerDuty / Telegram Admin | < 15 Menit | Segera tambahkan/rotasi API key baru di Admin Dashboard. |
| **P1 (High)** | Error rate LLM Gateway > 10% dalam 5 menit | Slack #alerts-critical | < 30 Menit | Cek status provider Gemini API & model availability. |
| **P2 (Medium)** | Cron job `client_expiry_cleanup` atau `growth_analyst` gagal berturut-turut | Email Admin | < 2 Jam | Cek log Sentry Cron & database connection health. |
| **P3 (Low)** | Slow query Firestore (>500ms) berulang atau lonjakan warning rate limit | Dashboard Telemetry | 1x24 Jam | Evaluasi indexing Firestore & cache in-memory. |

---

## 4. Runbook untuk Top-5 Pola Insiden (Incident Runbooks)

### 🔴 Runbook 1: LLM Rate Limit Spike (429 Cascade Spike)
1. **Identifikasi**: Lonjakan error `RESOURCE_EXHAUSTED` (429) pada span `llm.*` di Sentry.
2. **Diagnosis**: Buka Admin Dashboard -> Panel **Manajemen API Key**. Periksa jumlah key berstatus `rate_limited` dan `cooldownUntil`.
3. **Mitigasi**:
   - Jika semua key aktif sedang dalam cooldown, sistem otomatis melakukan fallback tier.
   - Tambahkan minimal 2-3 API key Gemini baru berkuota segar melalui tombol *+ Tambah API Key* di Admin Dashboard.
   - Reset cooldown key yang sudah pulih.

### 🟡 Runbook 2: Cron Job Failure / Timeout
1. **Identifikasi**: Notifikasi Sentry Cron Monitor pada `client_expiry_cleanup` atau `daily_meta_agent_factory`.
2. **Diagnosis**: Periksa breadcrumbs log transaksi di Sentry untuk melihat apakah error terjadi karena Firestore timeout atau schema mismatch.
3. **Mitigasi**:
   - Jalankan pengecekan manual via endpoint `/api/admin/health`.
   - Jika disk cache dirty, sistem otomatis mempertahankan fallback `local_db_store.json`.

### 🟠 Runbook 3: High Latency Degradation (LLM > 8 Detik)
1. **Identifikasi**: Metrik `llm.latency_ms` pada trace OpenTelemetry melonjak di atas 8000ms.
2. **Diagnosis**: Cek model yang digunakan pada span tag `llm.model`. (Contoh: `gemini-2.5-pro` yang memproses video prompt kompleks).
3. **Mitigasi**:
   - Aktifkan model selector optimizer agar task ringan diprioritaskan ke model Flash (`gemini-2.5-flash`).
   - Periksa payload prompt token estimation di Sentry.

### 🔵 Runbook 4: Frontend Crash Spike (React ErrorBoundary Triggered)
1. **Identifikasi**: Event Sentry Frontend melonjak dengan stack trace pada komponen React.
2. **Diagnosis**: Buka issue di Sentry, periksa Breadcrumbs interaksi pengguna terakhir sebelum crash.
3. **Mitigasi**:
   - Periksa validitas payload JSON yang dikirimkan oleh API ke client.
   - Pengguna dapat me-refresh tampilan tanpa kehilangan sesi karena state tersimpan di LocalStorage/Cache.

### 🟣 Runbook 5: RBAC & Device Security Violation Flood
1. **Identifikasi**: Lonjakan HTTP 403 / 401 dan event `banDeviceOrIp` di audit log.
2. **Diagnosis**: Buka Admin Dashboard -> Panel **Audit Log & Security**, filter berdasarkan IP/Fingerprint yang mencurigakan.
3. **Mitigasi**:
   - Sistem auto-ban secara otomatis memblokir IP/Device setelah 5 kali gagal login berturut-turut.
   - Jika terjadi *false-positive*, admin dapat membuka blokir melalui panel keamanan.

---

## 5. Kepatuhan Privasi & Zero-PII Standard

1. **Zero Raw Prompts**: Raw text prompt pengguna **DILARANG** dikirim ke log eksternal. Sistem hanya mencatat `llm.prompt_hash` (SHA-256) dan perkiraan token.
2. **API Key Masking**: Regex `AIza...[MASKED_KEY]` otomatis diterapkan pada seluruh stack trace dan string sebelum dikirim ke Sentry.
3. **Replay Privacy**: Session replay otomatis dinonaktifkan (`sampleRate: 0`) pada rute pembayaran (`/payment`, `/checkout`) dan login admin (`/admin/login`).

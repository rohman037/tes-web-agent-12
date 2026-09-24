# Quota-Aware Orchestrator v2 Architecture & Runbook

Dokumentasi ini menguraikan arsitektur pengelolaan kuota pool API Key Google AI Studio secara terdistribusi dan cerdas untuk menangani batasan ketat (RPM, RPD, TPM) di multi-tenant SaaS.

---

## 1. Alur Kerja Orchestration (`acquireSlot` ➔ `Execute` ➔ `Commit/Release`)

```text
[ Workflow Request ] 
         │
         ▼
[ Cache Check (SHA-256 Hash) ] ──(Hit)──> [ Return Cached Response (Zero Quota Impact) ]
         │ (Miss)
         ▼
[ Single-Flight Dedup ] ──(Concurrent Identical)──> [ Share In-Flight Promise ]
         │ (Unique)
         ▼
[ Quota-Aware Router (`acquireSlot`) ]
   ├─ Filter keys: status READY, rpdUsed < 80% limit (50% for cron), rpmWindow < limit, not in warm cooldown
   ├─ Reserve 20% capacity for peak hours (cron/bulk forbidden from touching top 20% reserve)
   ├─ Scoring: (Remaining RPD * 0.6) + (Health Score * 0.3) + (Idle Time * 0.1)
   └─ Fallback Chain: Automatic fallback across models if primary model quota is saturated
         │
         ▼
[ Smart Rate Limiter Queue (Strict RPM Throttle + Backoff Retry) ]
         │
         ▼
[ Google AI Studio API Execution ]
   ├─ Success ➔ Commit usage to Quota Ledger & Cache response (24h TTL)
   ├─ HTTP 429  ➔ Mark Key WARM for model (10 minutes cooldown) & Try Fallback
   └─ HTTP 401  ➔ Quarantine Key + Trigger Sentry Alert
```

---

## 2. Struktur Data Quota Ledger (`server/services/quotaLedger.ts`)
- **Rolling Window RPM**: Menyimpan array timestamp per request untuk jendela 60 detik.
- **RPD & TPM Tracking**: Memantau konsumsi harian dan TPM.
- **Pacific Time Reset**: Sinkronisasi reset kuota harian tepat pukul 00:00 PT (`America/Los_Angeles`).
- **Persistence**: Snapshot tersimpan otomatis ke koleksi Firestore setiap 5 menit dan saat *graceful shutdown*.

---

## 3. Hard Guardrails & Model Tiering (`config/modelTiering.ts`)
- **Strict Guardrail**: Model **Veo 3** dan **Nano Banana** dicekal secara mutlak (*hard error*) jika dipanggil.
- **Task Mapping**:
  - `validation | sanitation`: `[flash-lite-3.5, flash-lite-3.1, gemini-3.8-flash]`
  - `draft | summarize | bulk`: `[gemma-4-26b, flash-lite-3.5]`
  - `generate-final`: `[gemini-3.8-flash, gemini-3.7-flash, ...]`
  - `realtime | stream`: `[flash-3-live]`
  - `similarity`: `[embedding-2, embedding-1]`

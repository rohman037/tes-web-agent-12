# API & Workflow Routing Reference

## Endpoints Utama
- `POST /api/content-ideas` atau `/api/generate-content-ideas`: Endpoint pembuatan ide replika video viral.
  - Handler: `server/workflows/content-ideas/controller.ts`
  - Service: `server/workflows/content-ideas/service.ts`
- `POST /api/tiktok-shop-ideas` atau `/api/generate-tiktok-shop-ideas`: Endpoint transformasi produk TikTok Shop menjadi ide konten video.
  - Handler: `server/workflows/tiktok-shop-ideas/controller.ts`
  - Service: `server/workflows/tiktok-shop-ideas/service.ts`
- `POST /api/generate-photo-prompt`: Generator prompt AI photo/image generation.
  - Router: `server/workflows/photo-prompt-generator/routes.ts`
  - Service: `server/workflows/photo-prompt-generator/service.ts`
- `POST /api/tiktok/info`: Pengambilan metadata video TikTok (downloader / info fetcher).
  - Router: `server/core/tiktok-fetcher/routes.ts`
- `POST /api/tiktok-shop/info`: Pengambilan metadata produk TikTok Shop.
  - Router: `server/core/tiktok-fetcher/routes.ts`
- `GET /api/health`: Healthcheck dan uptime status server.

## LLM Gateway Routing Core
- `server/core/llm/routing/llmGateway.ts`: Core gateway multi-key resolver dengan rotasi otomatis, circuit breaker, dan tier fallback.
- `server/core/llm/routing/modelRouter.ts`: Normalisasi alias model Gemini dan cascading priority.
- `server/core/llm/routing/modelConstants.ts`: Definisi model tier, limit rate, dan model order.

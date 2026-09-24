import express from 'express';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { logger } from './server/core/utils/logger';
import { initDbSeed } from './src/db/dbService';
import { errorMiddleware } from './server/middleware/error.middleware';
import { initBackendSentry, Sentry } from './server/core/observability/sentry';
import { initOpenTelemetry } from './server/core/observability/tracing';

// Core State & Security Services
import { loadBannedDevices, isDeviceOrIpBanned } from './server/core/security/deviceSecurity';
import { loadSystemMemory } from './server/core/state/systemMemoryState';
import { loadActiveGenerationsService } from './server/workflows/events/service';
import { initServerAutoTrainerScheduler } from './server/workflows/knowledge/service';
import { initBackgroundSchedulers } from './server/core/cron/scheduler';

// Modular Workflow Routers
import { geminiProxyRouter } from './server/workflows/gemini-proxy/routes';
import { transcribeAudioRouter } from './server/workflows/transcribe-audio/routes';
import { promptSplitterRouter } from './server/workflows/prompt-splitter/routes';
import { photoPromptRouter } from './server/workflows/photo-prompt-generator/routes';
import { contentIdeasRouter } from './server/workflows/content-ideas/routes';
import { tiktokShopIdeasRouter } from './server/workflows/tiktok-shop-ideas/routes';
import { tiktokRouter } from './server/core/tiktok-fetcher/routes';
import { paymentRouter } from './server/workflows/payment/routes';
import { orchestratorRouter } from './server/workflows/orchestrator/routes';
import { growthRouter } from './server/workflows/growth/routes';
import { settingsRouter } from './server/workflows/settings/routes';
import { healthRouter } from './server/workflows/health/routes';
import { accessControlRouter } from './server/workflows/access-control/routes';
import { apiKeysRouter } from './server/workflows/api-keys/routes';
import { knowledgeRouter } from './server/workflows/knowledge/routes';
import { eventsRouter } from './server/workflows/events/routes';
import { videoToPromptRouter } from './server/workflows/video-to-prompt/routes';
import { replicaVideoRouter } from './server/workflows/replica-video/routes';

async function startServer() {
  // Initialize Core Observability (OpenTelemetry & Sentry)
  initOpenTelemetry();
  initBackendSentry();

  const app = express();
  const PORT = 3000;

  // Initialize DB seed on server startup
  await initDbSeed();

  // Initialize Core Security & State Caches
  await loadBannedDevices();
  await loadSystemMemory();
  await loadActiveGenerationsService();

  // Start Background 24/7 Intelligence Engines
  initServerAutoTrainerScheduler();
  initBackgroundSchedulers();

  // Increase payload limits for base64 video data (up to 100MB)
  app.use(express.json({ limit: '100mb' }));
  app.use(express.urlencoded({ limit: '100mb', extended: true }));

  // Enable trust proxy for Cloud Run / reverse proxy
  app.set('trust proxy', 1);

  // Apply Global API Rate Limiter
  const apiLimiter = rateLimit({
    windowMs: 1 * 60 * 1000,
    max: 10000,
    message: { error: 'Terlalu banyak permintaan (Rate limit). Silakan coba lagi sebentar lagi.' },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { default: false },
    keyGenerator: (req) => {
      const clientCode = (req.headers['x-client-access-code'] as string) || '';
      if (clientCode && clientCode.trim()) return `client_${clientCode.trim()}`;

      const fingerprint = (req.headers['x-device-fingerprint'] as string) || '';
      if (fingerprint && fingerprint.trim()) return `fp_${fingerprint.trim()}`;

      const forwarded = req.headers['x-forwarded-for'];
      if (typeof forwarded === 'string' && forwarded.trim()) {
        const clientIp = forwarded.split(',')[0].trim();
        if (clientIp) return `ip_${clientIp}`;
      }

      return req.ip || req.socket.remoteAddress || 'unknown';
    },
    skip: (req) => {
      const url = req.originalUrl || req.url || '';
      // Real-time events, SSE, and health endpoints
      if (
        url.includes('/api/events') ||
        url.includes('/api/health') ||
        url.includes('/api/ping') ||
        url.includes('/active-status') ||
        url.includes('/events/live') ||
        url.includes('/events/stream') ||
        url.includes('/events/poll')
      ) {
        return true;
      }

      // Routine telemetry, presence, heartbeats, security checks
      if (
        url.includes('/api/presence') ||
        url.includes('/api/security') ||
        url.includes('/api/admin/presence') ||
        url.includes('/api/admin/audit-logs') ||
        url.includes('/api/analytics')
      ) {
        return true;
      }

      // Transactions, access codes, clients, settings, formulas, announcements, qris, gateway
      if (
        url.includes('/api/transactions') ||
        url.includes('/api/access-codes') ||
        url.includes('/api/admin/clients') ||
        url.includes('/api/contact-settings') ||
        url.includes('/api/user-ui-settings') ||
        url.includes('/api/login-ui-settings') ||
        url.includes('/api/formulas') ||
        url.includes('/api/announcements') ||
        url.includes('/api/affiliates') ||
        url.includes('/api/apikeys') ||
        url.includes('/api/qris') ||
        url.includes('/api/llm-gateway')
      ) {
        return true;
      }

      // AI Generation & Processing endpoints
      if (
        url.includes('/api/generate-content-ideas') ||
        url.includes('/api/generate-photo-prompt') ||
        url.includes('/api/generate-prompt') ||
        url.includes('/api/generate-tiktok-shop-ideas') ||
        url.includes('/api/generate-video-to-prompt') ||
        url.includes('/api/video-to-prompt') ||
        url.includes('/api/gemini/generate') ||
        url.includes('/api/orchestrate') ||
        url.includes('/api/learn-feedback') ||
        url.includes('/api/tiktok/info') ||
        url.includes('/api/tiktok-shop/info') ||
        url.includes('/api/replica-video')
      ) {
        return true;
      }

      return false;
    },
  });
  app.use('/api', apiLimiter);

  // Security Gate Middleware: verify request is not from a banned device/IP/Code
  app.use('/api', (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.path.includes('/admin/banned-devices/unban') || req.path === '/health') {
      return next();
    }

    const clientIp = req.ip || req.socket.remoteAddress || '';
    const fingerprint = (req.headers['x-device-fingerprint'] as string) || req.body?.fingerprint || '';
    const accessCode =
      (req.headers['x-access-code'] as string) ||
      (req.headers['x-client-access-code'] as string) ||
      req.body?.accessCode ||
      '';

    const check = isDeviceOrIpBanned(clientIp, fingerprint, accessCode);
    if (check.banned) {
      return res.status(403).json({
        error: `Akses Ditolak! Perangkat atau IP Anda telah diblokir secara permanen oleh Sistem Keamanan Backend (Device Banned). Alasan: ${check.reason || 'Pelanggaran Akses'}.`,
        code: 'DEVICE_BANNED',
        isBanned: true,
        reason: check.reason,
      });
    }

    next();
  });

  // --- MOUNT MODULAR WORKFLOW ROUTERS ---
  app.use(geminiProxyRouter);
  app.use(transcribeAudioRouter);
  app.use(promptSplitterRouter);
  app.use(photoPromptRouter);
  app.use(contentIdeasRouter);
  app.use(replicaVideoRouter);
  app.use(tiktokShopIdeasRouter);
  app.use(tiktokRouter);
  app.use(knowledgeRouter);
  app.use(eventsRouter);
  app.use(videoToPromptRouter);
  app.use(accessControlRouter);
  app.use(paymentRouter);
  app.use(apiKeysRouter);
  app.use(orchestratorRouter);
  app.use(growthRouter);
  app.use(settingsRouter);
  app.use(healthRouter);

  // 404 handler for unknown API routes to prevent falling through to SPA index.html
  app.all('/api/*', (req, res) => {
    res.status(404).json({ error: `API endpoint tidak ditemukan: ${req.method} ${req.path}` });
  });

  // Global Express error handler to ensure clean JSON responses
  app.use(errorMiddleware);
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('[Server Error]', err);
    if (res.headersSent) {
      return next(err);
    }
    const status = err.status || err.statusCode || 500;
    const message =
      err.type === 'entity.too.large'
        ? 'Ukuran data file terlalu besar. Silakan kurangi ukuran file video atau gunakan file di bawah 50MB.'
        : err.message || 'Terjadi kesalahan internal pada server.';
    res.status(status).json({ error: message });
  });

  // Vite middleware in development mode
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    logger.info(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

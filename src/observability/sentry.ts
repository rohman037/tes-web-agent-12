import * as Sentry from '@sentry/react';
import {
  observabilityConfig,
  sentryBeforeSendHook,
  sentryBeforeBreadcrumbHook,
} from '../../config/observability';

let isFrontendSentryInitialized = false;

/**
 * Checks if the current route is sensitive to disable session replay
 */
function isSensitiveRoute(): boolean {
  if (typeof window === 'undefined') return false;
  const path = window.location.pathname.toLowerCase();
  return (
    path.includes('login') ||
    path.includes('payment') ||
    path.includes('checkout') ||
    path.includes('credential') ||
    path.includes('admin/auth')
  );
}

/**
 * Initializes Sentry for the React 18 Single Page Application
 */
export function initFrontendSentry() {
  if (isFrontendSentryInitialized || typeof window === 'undefined') return;

  const dsn =
    (import.meta as any).env?.VITE_SENTRY_DSN_FRONTEND ||
    observabilityConfig.sentry.frontendDsn;

  if (!dsn) {
    // Zero-telemetry standby mode if DSN is not configured
    return;
  }

  try {
    Sentry.init({
      dsn,
      environment: observabilityConfig.sentry.environment,
      release: observabilityConfig.sentry.release,
      tracesSampleRate: observabilityConfig.sentry.tracesSampleRate,
      replaysSessionSampleRate: isSensitiveRoute() ? 0 : observabilityConfig.sentry.replaysSessionSampleRate,
      replaysOnErrorSampleRate: isSensitiveRoute() ? 0 : observabilityConfig.sentry.replaysOnErrorSampleRate,
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: false,
          block: ['.payment-input', '.admin-secret-field', '.auth-token', '.access-code-input'],
          mask: ['.user-email', '.user-phone', '.price-amount'],
        }),
      ],
      beforeSend: sentryBeforeSendHook,
      beforeBreadcrumb: sentryBeforeBreadcrumbHook,
    });

    isFrontendSentryInitialized = true;
    initPerformanceWebVitals();
    initUnhandledRejectionHandler();
  } catch (err) {
    console.warn('[Frontend Observability] Note initializing Sentry:', err);
  }
}

/**
 * Performance & Core Web Vitals (LCP, FID/INP, CLS) Reporter
 */
function initPerformanceWebVitals() {
  if (typeof window === 'undefined' || !('PerformanceObserver' in window)) return;

  try {
    // 1. Largest Contentful Paint (LCP)
    const lcpObserver = new PerformanceObserver((entryList) => {
      const entries = entryList.getEntries();
      const lastEntry = entries[entries.length - 1];
      if (lastEntry) {
        Sentry.setMeasurement('LCP', lastEntry.startTime, 'millisecond');
      }
    });
    lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });

    // 2. Cumulative Layout Shift (CLS)
    let clsScore = 0;
    const clsObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        if (!entry.hadRecentInput) {
          clsScore += entry.value;
        }
      }
      Sentry.setMeasurement('CLS', clsScore, 'none');
    });
    clsObserver.observe({ type: 'layout-shift', buffered: true });

    // 3. First Input Delay (FID)
    const fidObserver = new PerformanceObserver((entryList) => {
      for (const entry of entryList.getEntries() as any[]) {
        const delay = entry.processingStart - entry.startTime;
        Sentry.setMeasurement('FID', delay, 'millisecond');
      }
    });
    fidObserver.observe({ type: 'first-input', buffered: true });
  } catch {}
}

/**
 * Global Unhandled Rejection & Error Capture
 */
function initUnhandledRejectionHandler() {
  if (typeof window === 'undefined') return;

  window.addEventListener('unhandledrejection', (event) => {
    // Ignore benign websocket connection aborts in Vite preview
    const reason = event.reason?.message || String(event.reason || '');
    if (reason.includes('WebSocket') || reason.includes('vite')) return;

    Sentry.captureException(event.reason || new Error('Unhandled Promise Rejection'));
  });
}

export { Sentry };

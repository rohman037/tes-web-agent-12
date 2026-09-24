import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./tests/setup.ts'],
    include: ['**/__tests__/**/*.test.ts', 'tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      thresholds: {
        statements: 60,
        branches: 50,
        functions: 60,
        lines: 60,
      },
      include: [
        'config/observability.ts',
        'config/modelTiering.ts',
        'server/core/observability/**',
        'server/services/quotaLedger.ts',
        'server/services/quotaRouter.ts',
        'src/lib/clientFlight.ts',
        'src/lib/resultCache.ts',
        'src/hooks/useQuotaStream.ts',
        'server/workflows/**/validators/**',
        'server/workflows/shared/**',
        'server/workflows/payment/service.ts',
        'server/core/security/secretManager.ts',
        'server/core/security/deviceSecurity.ts',
        'server/core/utils/logger.ts',
        'server/middleware/error.middleware.ts',
        'server/services/apiKeyPool.ts',
      ],
      exclude: [
        'prompts/**',
        'docs/**',
        'scripts/_archive/**',
        'coverage/**',
        'dist/**',
        'node_modules/**',
        'tests/**',
        '**/*.d.ts',
        '**/*.config.*',
        '**/types/**',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
});

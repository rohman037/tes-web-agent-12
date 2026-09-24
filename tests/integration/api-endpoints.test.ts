import { describe, it, expect, vi, beforeEach } from 'vitest';
import express, { Request, Response, NextFunction } from 'express';
import request from 'supertest';
import { errorMiddleware, AppError } from '@/server/middleware/error.middleware';
import * as dbService from '@/src/db/dbService';
import { MOCK_CLIENTS, MOCK_PACKAGES } from '../fixtures/dbFixtures';

// Setup isolated Express integration test app
function createTestApp() {
  const app = express();
  app.use(express.json());

  // Health endpoint
  app.get('/api/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'healthy', uptime: process.uptime(), timestamp: Date.now() });
  });

  // Mock RBAC Admin Middleware
  const requireAdminAuth = (req: Request, _res: Response, next: NextFunction) => {
    const adminKey = req.headers['x-admin-key'] || req.headers['authorization'];
    if (!adminKey) {
      const err: AppError = new Error('Akses Ditolak: Token autentikasi admin tidak ditemukan.');
      err.statusCode = 401;
      err.code = 'UNAUTHORIZED';
      return next(err);
    }
    if (adminKey !== 'test-valid-admin-secret-2026') {
      const err: AppError = new Error('Akses Ditolak: Kredensial admin tidak memiliki izin (Forbidden).');
      err.statusCode = 403;
      err.code = 'FORBIDDEN';
      return next(err);
    }
    next();
  };

  // Protected Admin Route
  app.get('/api/admin/packages', requireAdminAuth, async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const packages = await dbService.dbGetPackages();
      res.status(200).json({ success: true, data: packages });
    } catch (e) {
      next(e);
    }
  });

  // Mock VIP Member Route
  app.post('/api/workflows/content-ideas', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const clientCode = req.headers['x-client-access-code'] as string;
      if (!clientCode) {
        const err: AppError = new Error('Header x-client-access-code diperlukan.');
        err.statusCode = 401;
        err.code = 'UNAUTHORIZED';
        return next(err);
      }

      const clients = await dbService.dbGetClients();
      const validClient = clients.find((c: any) => c.clientCode === clientCode && c.status === 'active');

      if (!validClient) {
        const err: AppError = new Error('Kode akses klien tidak valid atau telah kedaluwarsa.');
        err.statusCode = 403;
        err.code = 'FORBIDDEN';
        return next(err);
      }

      const { niche } = req.body;
      if (!niche) {
        const err: AppError = new Error('Parameter niche wajib diisi.');
        err.statusCode = 400;
        err.code = 'BAD_REQUEST';
        return next(err);
      }

      res.status(200).json({
        success: true,
        data: {
          niche,
          ideas: [
            { id: '1', title: `Ide Konten ${niche}` }
          ]
        }
      });
    } catch (e) {
      next(e);
    }
  });

  // Endpoint to simulate distinct error contracts (401, 403, 404, 429, 500, 503, UNKNOWN)
  app.get('/api/test-error/:status', (req: Request, _res: Response, next: NextFunction) => {
    const statusParam = req.params.status;
    const statusNum = parseInt(statusParam, 10);
    const err: AppError = new Error(`Simulated Error for status ${statusParam}`);
    
    if (!isNaN(statusNum)) {
      err.statusCode = statusNum;
      if (statusNum === 401) err.code = 'UNAUTHENTICATED';
      else if (statusNum === 403) err.code = 'PERMISSION_DENIED';
      else if (statusNum === 404) err.code = 'NOT_FOUND';
      else if (statusNum === 429) err.code = 'RESOURCE_EXHAUSTED';
      else if (statusNum === 503) err.code = 'SERVICE_UNAVAILABLE';
      else err.code = 'INTERNAL_SERVER_ERROR';
    } else {
      err.statusCode = 500;
      err.code = 'UNKNOWN';
    }

    next(err);
  });

  // Attach global error middleware
  app.use(errorMiddleware);

  return app;
}

describe('Integration Test: Express API Endpoints, RBAC & Error Contracts', () => {
  let app: express.Express;

  beforeEach(() => {
    app = createTestApp();
    vi.spyOn(dbService, 'dbGetPackages').mockImplementation(async () => MOCK_PACKAGES);
    vi.spyOn(dbService, 'dbGetClients').mockImplementation(async () => MOCK_CLIENTS);
  });

  describe('Health Endpoint', () => {
    it('GET /api/health should return 200 with status healthy', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('healthy');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('RBAC Access Control', () => {
    it('should return 401 UNAUTHORIZED when no admin credentials provided', async () => {
      const res = await request(app).get('/api/admin/packages');
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('UNAUTHORIZED');
    });

    it('should return 403 FORBIDDEN when invalid admin credentials provided', async () => {
      const res = await request(app)
        .get('/api/admin/packages')
        .set('x-admin-key', 'wrong-key-abc');
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.code).toBe('FORBIDDEN');
    });

    it('should return 200 with package list when valid admin key provided', async () => {
      const res = await request(app)
        .get('/api/admin/packages')
        .set('x-admin-key', 'test-valid-admin-secret-2026');
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBe(MOCK_PACKAGES.length);
    });

    it('should reject workflow without client code with 401', async () => {
      const res = await request(app)
        .post('/api/workflows/content-ideas')
        .send({ niche: 'kuliner' });
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    it('should reject expired client code with 403', async () => {
      const res = await request(app)
        .post('/api/workflows/content-ideas')
        .set('x-client-access-code', 'SATSET-EXP-001')
        .send({ niche: 'kuliner' });
      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
    });

    it('should allow active VIP client code with 200', async () => {
      const res = await request(app)
        .post('/api/workflows/content-ideas')
        .set('x-client-access-code', 'SATSET-VIP-888')
        .send({ niche: 'kuliner pedas' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.niche).toBe('kuliner pedas');
    });
  });

  describe('Error Contracts (401, 403, 404, 429, 500, 503, UNKNOWN)', () => {
    const errorCases = [
      { status: 401, code: 'UNAUTHENTICATED' },
      { status: 403, code: 'PERMISSION_DENIED' },
      { status: 404, code: 'NOT_FOUND' },
      { status: 429, code: 'RESOURCE_EXHAUSTED' },
      { status: 500, code: 'INTERNAL_SERVER_ERROR' },
      { status: 503, code: 'SERVICE_UNAVAILABLE' },
      { status: 500, code: 'UNKNOWN', param: 'unknown' },
    ];

    for (const testCase of errorCases) {
      it(`should return consistent error shape for HTTP status ${testCase.param || testCase.status}`, async () => {
        const param = testCase.param || String(testCase.status);
        const res = await request(app).get(`/api/test-error/${param}`);
        
        expect(res.status).toBe(testCase.status);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBeDefined();
        expect(res.body.code).toBe(testCase.code);
      });
    }
  });
});

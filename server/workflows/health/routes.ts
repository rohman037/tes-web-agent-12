import { Router, Request, Response } from 'express';
import { testFirestoreHealth, getDbDiagnostics } from '@/src/db/dbService';

export const healthRouter = Router();

healthRouter.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

healthRouter.get(['/api/health/firestore', '/api/db-health'], async (_req: Request, res: Response) => {
  const health = await testFirestoreHealth();
  res.status(health.ok ? 200 : 500).json(health);
});

healthRouter.get('/api/admin/db-diagnostics', (_req: Request, res: Response) => {
  res.json(getDbDiagnostics());
});

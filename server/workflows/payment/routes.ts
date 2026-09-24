import { Router } from 'express';
import { requireAuth, optionalAuthenticate } from '@/server/middleware/auth.middleware';
import { requireAdminRole } from '@/server/middleware/role.middleware';
import { paymentRateLimiter, adminActionRateLimiter } from '@/server/middleware/rateLimit.middleware';
import {
  getQrisConfigController,
  updateQrisConfigController,
  getTransactionsController,
  createTransactionController,
  submitProofController,
  approveTransactionController,
  rejectTransactionController,
} from './controller';

export const paymentRouter = Router();

// QRIS endpoints
paymentRouter.get(['/api/qris', '/api/admin/qris'], getQrisConfigController);
paymentRouter.post('/api/admin/qris', requireAuth, requireAdminRole, adminActionRateLimiter, updateQrisConfigController);

// Transactions endpoints
paymentRouter.get('/api/transactions', optionalAuthenticate, getTransactionsController);
paymentRouter.post('/api/transactions', paymentRateLimiter, createTransactionController);
paymentRouter.post('/api/transactions/proof', paymentRateLimiter, submitProofController);
paymentRouter.post('/api/transactions/approve', requireAuth, requireAdminRole, adminActionRateLimiter, approveTransactionController);
paymentRouter.post('/api/transactions/reject', requireAuth, requireAdminRole, adminActionRateLimiter, rejectTransactionController);


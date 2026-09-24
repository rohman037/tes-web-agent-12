import { Router } from 'express';
import { requireAuth } from '@/server/middleware/auth.middleware';
import { requireAdminRole } from '@/server/middleware/role.middleware';
import { adminActionRateLimiter } from '@/server/middleware/rateLimit.middleware';
import {
  getContactSettingsController,
  updateContactSettingsController,
  getUsageSummaryController,
  exportBackupController,
  restoreBackupController,
  getHistoryController,
  saveHistoryController,
  deleteHistoryController,
} from './controller';

export const settingsRouter = Router();

// Contact Settings
settingsRouter.get(['/api/contact-settings', '/api/admin/contact-settings'], getContactSettingsController);
settingsRouter.post('/api/admin/contact-settings', requireAuth, requireAdminRole, adminActionRateLimiter, updateContactSettingsController);

// Analytics Usage Summary (Admin only)
settingsRouter.get('/api/analytics/usage-summary', requireAuth, requireAdminRole, getUsageSummaryController);

// System Backup & Restore (Admin only)
settingsRouter.get('/api/system/export-backup', requireAuth, requireAdminRole, adminActionRateLimiter, exportBackupController);
settingsRouter.post('/api/system/restore-backup', requireAuth, requireAdminRole, adminActionRateLimiter, restoreBackupController);

// History (User authenticated)
settingsRouter.get('/api/history', requireAuth, getHistoryController);
settingsRouter.post('/api/history', requireAuth, saveHistoryController);
settingsRouter.delete('/api/history/:id', requireAuth, deleteHistoryController);


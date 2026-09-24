import { Request, Response } from 'express';
import { handleApiError } from '@/server/core/utils/errorHandler';
import {
  getContactSettingsService,
  updateContactSettingsService,
  getUsageSummaryAnalyticsService,
  exportSystemBackupService,
  restoreSystemBackupService,
  getHistoryService,
  saveHistoryItemService,
  deleteHistoryItemService,
} from './service';

export async function getContactSettingsController(req: Request, res: Response) {
  try {
    const data = await getContactSettingsService();
    return res.json(data);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function updateContactSettingsController(req: Request, res: Response) {
  try {
    const settings = await updateContactSettingsService(req.body);
    return res.json({ success: true, settings });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getUsageSummaryController(req: Request, res: Response) {
  try {
    const summary = await getUsageSummaryAnalyticsService();
    return res.json(summary);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function exportBackupController(req: Request, res: Response) {
  try {
    const dump = await exportSystemBackupService();
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename=satset_backup_${Date.now()}.json`);
    return res.send(JSON.stringify(dump, null, 2));
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function restoreBackupController(req: Request, res: Response) {
  try {
    const result = await restoreSystemBackupService(req.body?.collections);
    return res.json({ success: true, ...result });
  } catch (err) {
    return handleApiError(res, err);
  }
}

export async function getHistoryController(req: Request, res: Response) {
  try {
    const code = req.query.accessCode || '';
    const history = await getHistoryService(String(code));
    return res.json(history);
  } catch (e) {
    return res.status(500).json({ error: 'Failed to get history' });
  }
}

export async function saveHistoryController(req: Request, res: Response) {
  try {
    await saveHistoryItemService(req.body);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to save history item' });
  }
}

export async function deleteHistoryController(req: Request, res: Response) {
  try {
    await deleteHistoryItemService(req.params.id);
    return res.json({ success: true });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to delete history item' });
  }
}

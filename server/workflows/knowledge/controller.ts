import { Request, Response } from 'express';
import { handleApiError } from '@/server/core/utils/errorHandler';
import {
  getSystemIntelligenceService,
  processLearnEventsService,
  learnFeedbackService,
  getKnowledgeBaseService,
  injectKnowledgeService,
  manualTrainKnowledgeService,
  deleteKnowledgeService,
  chatKnowledgeService,
} from './service';

export function getSystemIntelligenceController(req: Request, res: Response) {
  try {
    const result = getSystemIntelligenceService();
    return res.json(result);
  } catch (err) {
    return handleApiError(res, err);
  }
}

export function processLearnEventsController(req: Request, res: Response) {
  try {
    const { events } = req.body || {};
    const result = processLearnEventsService(events);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Gagal memproses event pembelajaran' });
  }
}

export function learnFeedbackController(req: Request, res: Response) {
  try {
    const { insight, type = 'contentIdeas' } = req.body || {};
    const result = learnFeedbackService(insight, type);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Insight teks tidak valid' });
  }
}

export function getKnowledgeBaseController(req: Request, res: Response) {
  try {
    const result = getKnowledgeBaseService();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Gagal mengambil data pengetahuan sistem' });
  }
}

export function injectKnowledgeController(req: Request, res: Response) {
  try {
    const { insight, category, fileName } = req.body || {};
    const result = injectKnowledgeService(insight, category, fileName);
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Gagal menginjeksi pengetahuan' });
  }
}

export async function manualTrainKnowledgeController(req: Request, res: Response) {
  try {
    const result = await manualTrainKnowledgeService();
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Gagal menjalankan pelatihan manual' });
  }
}

export function deleteKnowledgeController(req: Request, res: Response) {
  try {
    const { index, text } = req.body || {};
    const result = deleteKnowledgeService(index, text);
    return res.json(result);
  } catch (err: any) {
    return res.status(500).json({ error: err?.message || 'Gagal menghapus wawasan pengetahuan' });
  }
}

export async function chatKnowledgeController(req: Request, res: Response) {
  try {
    const { message, attachedFile, chatHistory } = req.body || {};
    const result = await chatKnowledgeService({ message, attachedFile, chatHistory });
    return res.json(result);
  } catch (err: any) {
    return res.status(400).json({ error: err?.message || 'Gagal memproses chat pengetahuan' });
  }
}

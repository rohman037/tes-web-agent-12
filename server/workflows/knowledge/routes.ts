import { Router } from 'express';
import {
  getSystemIntelligenceController,
  processLearnEventsController,
  learnFeedbackController,
  getKnowledgeBaseController,
  injectKnowledgeController,
  manualTrainKnowledgeController,
  deleteKnowledgeController,
  chatKnowledgeController,
} from './controller';

export const knowledgeRouter = Router();

// System Intelligence Status & Memory Metrics
knowledgeRouter.get('/api/system-intelligence', getSystemIntelligenceController);

// Realtime Batched Auto-Learning Memory Worker
knowledgeRouter.post('/api/backend/learn', processLearnEventsController);

// User Feedback / Custom Prompt Learning
knowledgeRouter.post('/api/learn-feedback', learnFeedbackController);

// Admin Knowledge Base Injection & Retraining
knowledgeRouter.get('/api/admin/knowledge', getKnowledgeBaseController);
knowledgeRouter.post('/api/admin/knowledge/inject', injectKnowledgeController);
knowledgeRouter.post('/api/admin/knowledge/manual-train', manualTrainKnowledgeController);
knowledgeRouter.delete('/api/admin/knowledge', deleteKnowledgeController);
knowledgeRouter.post('/api/admin/knowledge/chat', chatKnowledgeController);

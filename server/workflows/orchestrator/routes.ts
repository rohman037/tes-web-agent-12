import { Router } from 'express';
import {
  orchestrateController,
  aeoGenerateController,
  runAllAgentsController,
} from './controller';

export const orchestratorRouter = Router();

// Multi-agent orchestrator & relevance auditor endpoint
orchestratorRouter.post('/api/orchestrate', orchestrateController);

// AEO pipeline generator endpoint
orchestratorRouter.post('/api/aeo/generate', aeoGenerateController);

// Benchmark / test run all platform agents
orchestratorRouter.post('/api/agents/run-all', runAllAgentsController);

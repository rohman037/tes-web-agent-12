import { Router } from 'express';
import { generateReplicaVideoController } from './controller';

export const replicaVideoRouter = Router();

replicaVideoRouter.post('/api/replica-video/generate', generateReplicaVideoController);
replicaVideoRouter.post('/api/replica-video', generateReplicaVideoController);

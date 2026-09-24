import {
  dbGetGrowthState,
  dbSaveGrowthState,
  dbGetAiAgents,
  dbSaveAiAgent,
  dbDeleteAiAgent,
  dbGetLearningQueue,
  dbGetSystemMemory,
  dbGetClients,
  dbGetTransactions,
} from '@/src/db/dbService';
import {
  rollbackGrowthScalingVersion,
  setFullAutoMode,
} from '@/src/lib/admin/growthScaling';
import { runAutoAgentFactory } from '@/server/core/intelligence/agentAutoAgentFactory';
import { broadcastLiveEvent } from '@/server/core/state/serverState';

export async function getSystemMemoryService() {
  return await dbGetSystemMemory();
}

export async function getGrowthStateService() {
  return await dbGetGrowthState();
}

export async function evaluateGrowthService() {
  const clients = await dbGetClients();
  const transactions = await dbGetTransactions();
  const result = await runAutoAgentFactory(clients, transactions);
  const growthState = await dbGetGrowthState();
  return { result, growthState };
}

export async function rollbackGrowthService(targetVersion: string) {
  if (!targetVersion) {
    throw new Error('Target version required');
  }
  const newState = rollbackGrowthScalingVersion(targetVersion);
  await dbSaveGrowthState(newState);
  broadcastLiveEvent({ type: 'growth_scaling_updated', growthState: newState });
  return newState;
}

export async function toggleAutoModeService(enabled: boolean) {
  const newState = setFullAutoMode(Boolean(enabled));
  await dbSaveGrowthState(newState);
  broadcastLiveEvent({ type: 'growth_scaling_updated', growthState: newState });
  return newState;
}

export async function getAiAgentsService() {
  return await dbGetAiAgents();
}

export async function updateAiAgentsService(agents: any[]) {
  if (!Array.isArray(agents)) {
    throw new Error('Payload agents harus berupa array');
  }
  const existing = await dbGetAiAgents();
  const newIds = new Set(agents.map((a: any) => a.id).filter(Boolean));
  for (const oldAgent of existing) {
    if (oldAgent?.id && !newIds.has(oldAgent.id)) {
      await dbDeleteAiAgent(oldAgent.id);
    }
  }
  for (const item of agents) {
    await dbSaveAiAgent(item);
  }
  broadcastLiveEvent({ type: 'ai_agents_updated', agents });
  return agents;
}

export async function toggleAgentStatusService(id: string) {
  const agents = await dbGetAiAgents();
  const idx = agents.findIndex((a: any) => a.id === id);
  if (idx === -1) {
    const err: any = new Error('Agent tidak ditemukan');
    err.status = 404;
    throw err;
  }
  agents[idx].status = agents[idx].status === 'active' ? 'inactive' : 'active';
  await dbSaveAiAgent(agents[idx]);
  broadcastLiveEvent({ type: 'ai_agents_updated', agents });
  return { agent: agents[idx], agents };
}

export async function getLearningQueueService() {
  return await dbGetLearningQueue();
}


import { syncHistoryAsync } from './history';
import { syncClientsAsync } from './admin/clients';

export function initRealtimeSync() {
  console.log('Initializing Realtime Sync...');
  
  // Do initial sync
  syncClientsAsync();
  syncHistoryAsync();
  
  // Set up periodic sync (polling as fallback)
  const interval = setInterval(() => {
    syncClientsAsync();
    syncHistoryAsync();
  }, 15000);
  
  return () => {
    clearInterval(interval);
  };
}

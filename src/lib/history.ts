import { HistoryItem, HistoryCategory } from '../types';
import { getUserSession } from './auth';
import { getClients } from './admin/clients';
import { db } from './firebase';
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, orderBy, limit } from 'firebase/firestore';

export type { HistoryItem, HistoryCategory };
const BASE_STORAGE_KEY = 'videoai_pro_history_v1';
const MAX_HISTORY_ITEMS = 100;

function getHistoryStorageKey(userCode?: string): string {
  const session = getUserSession();
  const code = (userCode || session?.code || '').trim().toUpperCase();
  if (!code) return `${BASE_STORAGE_KEY}_GUEST`;
  return `${BASE_STORAGE_KEY}_${code}`;
}

export const getHistoryCount = (userCode?: string): number => {
  return getHistory(userCode).length;
};

export const syncHistoryAsync = async (userCode?: string): Promise<void> => {
  const session = getUserSession();
  const code = (userCode || session?.code || '').trim().toUpperCase();
  if (!code || code === 'GUEST') return;
  try {
    const q = query(collection(db, 'history'), where('accessCode', '==', code), orderBy('timestamp', 'desc'), limit(MAX_HISTORY_ITEMS));
    const snapshot = await getDocs(q);
    const data = snapshot.docs.map(doc => doc.data() as HistoryItem);
    
    const key = getHistoryStorageKey(code);
    localStorage.setItem(key, JSON.stringify(data));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated', { detail: { accessCode: code } }));
    }
  } catch (e) {
    console.warn('Failed to sync history from Firestore', e);
  }
};

export const getHistory = (userCode?: string): HistoryItem[] => {
  if (typeof localStorage === 'undefined') return [];
  try {
    const key = getHistoryStorageKey(userCode);
    let raw = localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    return [];
  }
};

export const saveHistoryItem = (item: Omit<HistoryItem, 'id' | 'timestamp'>, userCode?: string): HistoryItem => {
  const session = getUserSession();
  const activeCode = (userCode || session?.code || 'GUEST').trim().toUpperCase();
  
  let clientId = 'cli_guest';
  let clientName = 'Guest User';
  const clients = getClients();
  const matched = clients.find((c) => c.accessCode.toUpperCase() === activeCode);
  if (matched) {
    clientId = matched.id;
    clientName = matched.name || 'Klien Satset';
  }

  const newItem: HistoryItem = {
    ...item,
    id: `hist_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    timestamp: Date.now(),
    accessCode: activeCode,
    clientId,
    clientName,
  };

  try {
    const key = getHistoryStorageKey(activeCode);
    const current = getHistory(activeCode);
    
    const filtered = current.filter((existing) => {
      if (item.category === 'tiktok_download' && existing.category === 'tiktok_download') {
        return existing.data.tiktokUrl !== item.data.tiktokUrl;
      }
      if (item.category === existing.category && existing.data.prompt && item.data.prompt) {
        return existing.data.prompt !== item.data.prompt;
      }
      return true;
    });

    const updated = [newItem, ...filtered].slice(0, MAX_HISTORY_ITEMS);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(updated));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated', { detail: { accessCode: activeCode } }));
    }
    
    // Sync to Firestore
    if (activeCode !== 'GUEST') {
      setDoc(doc(db, 'history', newItem.id), newItem).catch(e => console.warn('Failed to save to Firestore', e));
    }
    
    return newItem;
  } catch (error) {
    return newItem;
  }
};

export const deleteHistoryItem = (id: string, userCode?: string): HistoryItem[] => {
  try {
    const key = getHistoryStorageKey(userCode);
    const current = getHistory(userCode);
    const updated = current.filter((item) => item.id !== id);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(key, JSON.stringify(updated));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated'));
    }
    
    const session = getUserSession();
    const code = userCode || session?.code;
    if (code && code !== 'GUEST') {
      deleteDoc(doc(db, 'history', id)).catch(e => console.warn('Failed to delete from Firestore', e));
    }
    
    return updated;
  } catch (error) {
    return getHistory(userCode);
  }
};

export const clearAllHistory = (userCode?: string): void => {
  try {
    const key = getHistoryStorageKey(userCode);
    localStorage.removeItem(key);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('satset_history_updated'));
    }
  } catch (error) {
    console.error('Failed to clear history:', error);
  }
};

export const exportHistoryJSON = (userCode?: string): void => {};
export const importHistoryJSON = (jsonText: string, userCode?: string): HistoryItem[] => { return []; };

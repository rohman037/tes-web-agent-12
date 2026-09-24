import { useState, useEffect, useCallback, useRef } from 'react';

export interface QuotaStreamData {
  pacificDate: string;
  nextPacificReset: string;
  modelUsageSummary: Record<string, { used: number; limit: number }>;
  top10HotKeys: { keyId: string; alias?: string; totalRpd: number }[];
  flashPoolStatus: {
    totalLimit: number;
    totalUsed: number;
    remaining: number;
    predictedExhaustion: string;
  };
  ledgerSnapshot: Record<string, any>;
  connected: boolean;
}

/**
 * Real-Time Quota Stream Hook using Server-Sent Events (SSE)
 * Replaces all legacy polling intervals with an efficient SSE subscription + exponential backoff reconnect.
 */
export function useQuotaStream() {
  const [data, setData] = useState<QuotaStreamData | null>(null);
  const [connected, setConnected] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const reconnectAttempts = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const fetchFallbackSummary = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/quota/summary');
      if (res.ok) {
        const json = await res.json();
        setData({ ...json, connected: false });
      }
    } catch (e: any) {
      setError(e?.message || 'Gagal mengambil ringkasan kuota');
    }
  }, []);

  useEffect(() => {
    let eventSource: EventSource | null = null;
    let isMounted = true;

    const connect = () => {
      if (!isMounted) return;

      // Connect to SSE endpoint (e.g. /api/admin/stream or quota events)
      eventSource = new EventSource('/api/admin/stream');

      eventSource.onopen = () => {
        if (!isMounted) return;
        setConnected(true);
        setError(null);
        reconnectAttempts.current = 0;
      };

      eventSource.onmessage = (event) => {
        if (!isMounted) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.modelUsageSummary) {
            setData({ ...parsed, connected: true });
          }
        } catch {}
      };

      eventSource.onerror = () => {
        if (!isMounted) return;
        setConnected(false);
        if (eventSource) {
          eventSource.close();
        }

        // Fetch fallback REST summary once on SSE drop
        fetchFallbackSummary();

        // Exponential backoff reconnect (capped at 30 seconds)
        const delay = Math.min(30000, Math.pow(2, reconnectAttempts.current) * 1000);
        reconnectAttempts.current++;

        timerRef.current = setTimeout(() => {
          connect();
        }, delay);
      };
    };

    // Initial REST fetch then establish SSE
    fetchFallbackSummary();
    connect();

    return () => {
      isMounted = false;
      if (eventSource) {
        eventSource.close();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [fetchFallbackSummary]);

  return { data, connected, error };
}

import React, { useState, useEffect } from 'react';
import { 
  DollarSign, 
  Users, 
  TrendingUp, 
  Sparkles, 
  Clock, 
  ArrowRight,
  ShieldAlert,
  Zap,
  Key,
  Activity,
  CheckCircle2,
  AlertOctagon,
  Radio,
  Cpu,
  Bot,
  Layers,
  Search,
  Check
} from 'lucide-react';
import StatCard from '../../components/admin/StatCard';
import SystemHealthWidget from '../../components/admin/SystemHealthWidget';
import CategoryBreakdownChart, { CategoryBreakdownData, CATEGORY_LABELS } from '../../components/admin/CategoryBreakdownChart';
import ActivityTrendChart, { TrendDataPoint } from '../../components/admin/ActivityTrendChart';
import { getClients, ClientItem, syncClientsAsync } from '../../lib/admin/clients';
import { getAllTransactions, Transaction, formatRupiah, syncTransactionsFromServer } from '../../lib/payment';
import { getApiKeys, syncApiKeysWithBackend } from '../../lib/admin/apiKeys';
import { GenerationEvent, subscribeLiveGenerationEvents, ActiveGenerationItem } from '../../events/generationEvent';
import { ContentCategory } from '../../events/categorize';
import { sseManager } from '../../lib/sseManager';

interface DashboardOverviewPanelProps {
  onNavigateTab: (tab: string) => void;
}

export default function DashboardOverviewPanel({ onNavigateTab }: DashboardOverviewPanelProps) {
  const [clients, setClients] = useState<ClientItem[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [apiKeyCount, setApiKeyCount] = useState<number>(0);
  const [events, setEvents] = useState<GenerationEvent[]>([]);
  const [activeGenerations, setActiveGenerations] = useState<ActiveGenerationItem[]>([]);
  const [eventsLoading, setEventsLoading] = useState<boolean>(true);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [lastAgentAudit, setLastAgentAudit] = useState<any>(null);
  const [isInitialSyncing, setIsInitialSyncing] = useState<boolean>(true);
  const [streamStatus, setStreamStatus] = useState<'connected' | 'reconnecting' | 'offline'>(
    sseManager.isStreamConnected() ? 'connected' : 'reconnecting'
  );

  useEffect(() => {
    loadData();
    fetchEvents();

    // Hydrate server data in background for cold start resilience across devices
    const hydrateInitial = async () => {
      try {
        await Promise.allSettled([
          syncClientsAsync(),
          syncTransactionsFromServer(),
          syncApiKeysWithBackend(),
        ]);
        loadData();
      } finally {
        setIsInitialSyncing(false);
      }
    };
    hydrateInitial();

    const handleUpdate = () => loadData();
    const handleSseStatus = (e: any) => {
      if (e.detail) {
        setStreamStatus(e.detail);
      }
    };

    window.addEventListener('satset_clients_updated', handleUpdate);
    window.addEventListener('transactions-updated', handleUpdate);
    window.addEventListener('satset_apikeys_updated', handleUpdate);
    window.addEventListener('satset_packages_updated', handleUpdate);
    window.addEventListener('satset_qris_updated', handleUpdate);
    window.addEventListener('satset_contact_settings_updated', handleUpdate);
    window.addEventListener('satset_access_codes_updated', handleUpdate);
    window.addEventListener('satset_sse_status', handleSseStatus);
    window.addEventListener('storage', handleUpdate);

    // Subscribe to SSE Live Stream / Polling fallback pipeline
    const unsubscribeLive = subscribeLiveGenerationEvents((data) => {
      setEventsLoading(false);
      if (Array.isArray(data.events)) {
        setEvents(data.events);
      }
      if (Array.isArray(data.activeGenerations)) {
        const uniqueMap = new Map<string, ActiveGenerationItem>();
        data.activeGenerations.forEach((item) => {
          if (item && item.id) uniqueMap.set(item.id, item);
        });
        setActiveGenerations(Array.from(uniqueMap.values()));
      } else if (data.type === 'active_status_update' && data.activeGeneration) {
        const item = data.activeGeneration;
        setActiveGenerations((prev) => {
          const map = new Map<string, ActiveGenerationItem>();
          prev.forEach((g) => { if (g && g.id) map.set(g.id, g); });
          map.set(item.id, { ...(map.get(item.id) || {}), ...item });
          return Array.from(map.values());
        });
      }
      if (data.type === 'generation_event' && data.event) {
        const newEvt = data.event;
        setEvents((prev) => [newEvt, ...prev.filter((e) => e.id !== newEvt.id)]);
        if (newEvt.outcome === 'success' || newEvt.outcome === 'error') {
          setActiveGenerations((prev) => prev.filter((g) => g.id !== newEvt.id));
        }
      }
      if (data.type === 'agent_orchestrated' && data.result) {
        setLastAgentAudit(data.result);
      }
    });

    return () => {
      window.removeEventListener('satset_clients_updated', handleUpdate);
      window.removeEventListener('transactions-updated', handleUpdate);
      window.removeEventListener('satset_apikeys_updated', handleUpdate);
      window.removeEventListener('satset_packages_updated', handleUpdate);
      window.removeEventListener('satset_qris_updated', handleUpdate);
      window.removeEventListener('satset_contact_settings_updated', handleUpdate);
      window.removeEventListener('satset_access_codes_updated', handleUpdate);
      window.removeEventListener('satset_sse_status', handleSseStatus);
      window.removeEventListener('storage', handleUpdate);
      unsubscribeLive();
    };
  }, []);

  const loadData = () => {
    const safeClients = getClients();
    setClients(safeClients);

    const safeTrx = getAllTransactions();
    setTransactions(safeTrx);

    const keys = getApiKeys();
    const active = keys.filter((k) => k.status === 'active').length;
    // Accurate zero representation without mock fallbacks
    setApiKeyCount(active);
  };

  const fetchEvents = async () => {
    try {
      setEventsLoading(true);
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setEvents(data);
        }
      } else {
        setEventsError('Tidak dapat mengambil data event tracking server.');
      }
    } catch (err) {
      console.warn('[DashboardOverview] Fetch events error:', err);
    } finally {
      setEventsLoading(false);
    }
  };

  const safeClients = Array.isArray(clients) ? clients : [];
  const safeTrx = Array.isArray(transactions) ? transactions : [];

  // Calculate revenue this month
  const now = new Date();
  const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  
  const approvedTrxThisMonth = safeTrx.filter((t) => {
    if (t.status !== 'APPROVED') return false;
    const trxDate = t.timestamp ? new Date(t.timestamp) : new Date();
    const trxMonthStr = `${trxDate.getFullYear()}-${String(trxDate.getMonth() + 1).padStart(2, '0')}`;
    return trxMonthStr === currentMonthStr;
  });

  const totalRevenueThisMonth = approvedTrxThisMonth.reduce((acc, curr) => acc + (curr.amount || 0), 0);

  // New clients this week
  const oneWeekAgo = new Date().getTime() - 7 * 24 * 3600 * 1000;
  const newClientsThisWeek = safeClients.filter((c) => {
    const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
    return created >= oneWeekAgo;
  }).length;

  // Clients expiring in <= 3 days
  const expiringSoonClients = safeClients.filter((c) => {
    if (c.status === 'suspended' || c.status === 'expired') return false;
    const exp = new Date(c.expiryDate).getTime();
    const diffDays = (exp - Date.now()) / (1000 * 3600 * 24);
    return diffDays > 0 && diffDays <= 3;
  });

  const pendingQueueCount = safeTrx.filter((t) => t.status === 'AWAITING_VERIFICATION').length;

  // Trend Data for Chart (Last 7 Days)
  const generateTrendData = (): TrendDataPoint[] => {
    const data: TrendDataPoint[] = [];
    const days = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab'];
    
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 3600 * 1000);
      d.setHours(0, 0, 0, 0);
      const nextD = new Date(d.getTime() + 24 * 3600 * 1000);
      
      const dayTrx = safeTrx.filter(t => {
        if (t.status !== 'APPROVED') return false;
        const ts = t.timestamp ? new Date(t.timestamp).getTime() : (t.updatedAt || 0);
        return ts >= d.getTime() && ts < nextD.getTime();
      });
      
      const dayRevenue = dayTrx.reduce((sum, t) => sum + (t.amount || t.totalPrice || 0), 0);
      
      const dayUsers = safeClients.filter(c => {
        const created = c.createdAt ? new Date(c.createdAt).getTime() : 0;
        return created >= d.getTime() && created < nextD.getTime();
      }).length;
      
      data.push({
        date: days[d.getDay()],
        revenue: dayRevenue,
        users: dayUsers
      });
    }
    
    return data;
  };
  
  const trendData = generateTrendData();

  // Real Event Statistics
  const validEvents = events.filter(Boolean);
  const totalEventsCount = validEvents.length;
  const successfulEventsCount = validEvents.filter((e) => !e.outcome || e.outcome === 'success' || e.outcome === 'flagged').length;
  const successRate = totalEventsCount > 0 ? Math.round((successfulEventsCount / totalEventsCount) * 100) : 100;

  const totalLatencyMs = validEvents.reduce((sum, e) => sum + (e.latencyMs || 0), 0);
  const avgLatencyMs = totalEventsCount > 0 ? Math.round(totalLatencyMs / totalEventsCount) : 0;

  // Real Category Breakdown Calculation
  const categoryCounts: Record<ContentCategory, number> = {
    fashion_beauty: 0,
    herbal_kesehatan: 0,
    rumah_tangga: 0,
    teknologi: 0,
    makanan_minuman: 0,
    umum: 0,
  };

  validEvents.forEach((evt) => {
    const cat = (evt.category || 'umum') as ContentCategory;
    if (categoryCounts[cat] !== undefined) {
      categoryCounts[cat] += 1;
    } else {
      categoryCounts['umum'] += 1;
    }
  });

  const categoryBreakdownList: CategoryBreakdownData[] = totalEventsCount > 0
    ? (Object.keys(CATEGORY_LABELS) as ContentCategory[]).map((catKey) => {
        const count = categoryCounts[catKey] || 0;
        const percentage = (count / totalEventsCount) * 100;
        return {
          category: catKey,
          label: CATEGORY_LABELS[catKey].label,
          count,
          percentage,
          color: CATEGORY_LABELS[catKey].color,
        };
      }).filter((item) => item.count > 0).sort((a, b) => b.count - a.count)
    : [];

  return (
    <div className="space-y-6">
      {/* Expiring Clients Alert Banner if any */}
      {expiringSoonClients.length > 0 && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-400/40 text-amber-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-400/20 text-amber-700 flex items-center justify-center shrink-0 font-bold">
              <ShieldAlert className="w-5 h-5 text-amber-600 animate-pulse" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-amber-900">
                Peringatan Masa Aktif Client ({expiringSoonClients.length} Client Expiring Dalam 3 Hari)
              </h4>
              <p className="text-xs text-amber-800">
                Segera hubungi atau tawarkan perpanjangan paket kepada: {expiringSoonClients.map((c) => c.name).join(', ')}.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onNavigateTab('clients')}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 shrink-0 cursor-pointer"
          >
            <span>Lihat Client</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Primary Stat Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Omset Bulan Ini"
          value={formatRupiah(totalRevenueThisMonth)}
          subtext={`${approvedTrxThisMonth.length} Transaksi terverifikasi bulan ini`}
          badge={{ 
            text: approvedTrxThisMonth.length > 0 ? 'Verifikasi Valid' : 'Belum Ada Transaksi', 
            type: approvedTrxThisMonth.length > 0 ? 'success' : 'info' 
          }}
          icon={<DollarSign className="w-4 h-4" />}
          iconBgColor="bg-emerald-50 border-emerald-100"
          iconTextColor="text-emerald-600"
          isLoading={isInitialSyncing}
        />

        <StatCard
          title="Total Event Generasi"
          value={`${totalEventsCount} Event`}
          subtext={totalEventsCount > 0 ? `Success: ${successRate}% (${avgLatencyMs > 0 ? `${avgLatencyMs}ms avg` : '< 2s'})` : 'Belum ada aktivitas generasi'}
          badge={{ 
            text: totalEventsCount > 0 ? 'Pipeline Active' : 'Idle Standby', 
            type: totalEventsCount > 0 ? 'info' : 'warning' 
          }}
          icon={<Activity className="w-4 h-4" />}
          iconBgColor="bg-indigo-50 border-indigo-100"
          iconTextColor="text-[#3525cd]"
          isLoading={eventsLoading || isInitialSyncing}
        />

        <StatCard
          title="Pending Verifikasi Bayar"
          value={`${pendingQueueCount} Antrean`}
          subtext={pendingQueueCount > 0 ? `${pendingQueueCount} transaksi butuh perhatian admin` : 'Tidak ada antrean pending'}
          badge={{ text: pendingQueueCount > 0 ? 'Action Needed' : 'Lancar', type: pendingQueueCount > 0 ? 'warning' : 'success' }}
          icon={<Clock className="w-4 h-4" />}
          iconBgColor="bg-amber-50 border-amber-100"
          iconTextColor="text-amber-600"
          isLoading={isInitialSyncing}
        />

        <StatCard
          title="Active API Keys"
          value={`${apiKeyCount} Key`}
          subtext={apiKeyCount > 0 ? 'Rotasi Gemini Engine Aktif' : 'Belum ada API Key aktif'}
          badge={{ text: apiKeyCount > 0 ? 'System OK' : 'Perlu Key', type: apiKeyCount > 0 ? 'success' : 'danger' }}
          icon={<Key className="w-4 h-4" />}
          iconBgColor="bg-purple-50 border-purple-100"
          iconTextColor="text-purple-600"
          isLoading={isInitialSyncing}
        />
      </div>

      {/* System Health Status */}
      <SystemHealthWidget />

      {/* LIVE GENERATION EVENT & MULTI-AGENT PIPELINE MONITOR (SSE / REAL-TIME) */}
      <div className="bg-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-800 space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-400 flex items-center justify-center font-bold">
              <Radio className="w-5 h-5 animate-pulse text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-extrabold tracking-tight">Monitoring Real-Time Generasi User & AI Agent</h3>
                {streamStatus === 'connected' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                    Live SSE Terhubung
                  </span>
                )}
                {streamStatus === 'reconnecting' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                    Polling / Menghubungkan Ulang...
                  </span>
                )}
                {streamStatus === 'offline' && (
                  <span className="px-2.5 py-0.5 rounded-full bg-slate-700 text-slate-300 border border-slate-600 text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                    Mode Offline
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pantau eksekusi tool user dan analisis 4-Agent Orchestration Pipeline secara langsung.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab('ai_agents')}
            className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <Bot className="w-4 h-4 text-amber-300" />
            <span>Panel Multi-Agent</span>
          </button>
        </div>

        {/* Active User Generation Stream List */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
          {/* Left Column: Active User Generations */}
          <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-indigo-400" />
                <span>Generasi User Aktif ({activeGenerations.length})</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">Auto Push</span>
            </div>

            {activeGenerations.length === 0 ? (
              <div className="py-6 text-center space-y-1">
                <CheckCircle2 className="w-6 h-6 text-emerald-400 mx-auto opacity-80" />
                <p className="text-xs text-slate-400 font-medium">Tidak ada antrean generasi aktif saat ini.</p>
                <p className="text-[11px] text-slate-500">Sistem siap memproses request user secara 24/7.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-none">
                {activeGenerations.map((gen) => (
                  <div key={gen.id} className="p-3 rounded-lg bg-slate-900 border border-indigo-500/30 space-y-1.5 animate-in fade-in duration-200">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-extrabold text-white flex items-center gap-1.5">
                        <Zap className="w-3.5 h-3.5 text-amber-400 animate-bounce" />
                        <span>Tool: <code className="text-amber-300">{gen.tool}</code></span>
                      </span>
                      <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-[10px] font-mono font-bold">
                        {gen.accessCode}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px] text-slate-400">
                      <span>Kategori: {gen.category}</span>
                      <span className="flex items-center gap-1 text-emerald-400 font-bold">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                        {gen.status === 'analyzing' ? 'Agent Analysing...' : 'Generating...'}
                      </span>
                    </div>

                    {gen.orchestrationResult && (
                      <div className="p-2 rounded bg-indigo-950/80 border border-indigo-800 text-[10px] text-indigo-200 space-y-0.5 font-mono">
                        <div>✨ Multi-Agent SEO Audit: {gen.orchestrationResult.passed ? 'PASSED ✅' : 'NEEDS OPTIMIZATION ⚠️'}</div>
                        <div>Metadata: {gen.orchestrationResult.metadataSeo?.suggestedCaption?.substring(0, 40)}...</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right Column: Recent Events & Agent Audits Feed */}
          <div className="bg-slate-950/70 rounded-xl p-4 border border-slate-800/80 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-extrabold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>Log Event & Audit Agent Terakhir</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">{events.length} Event</span>
            </div>

            <div className="space-y-2 max-h-56 overflow-y-auto pr-1 scrollbar-none">
              {validEvents.slice(0, 6).map((evt) => {
                const outcome = String(evt.outcome || 'success');
                return (
                  <div key={evt.id || Math.random().toString()} className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 text-xs flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-bold text-white flex items-center gap-1">
                        <span className="text-[#3525cd] font-mono">[{evt.tool || 'Workspace'}]</span>
                        <span className="text-slate-400 text-[11px] font-mono">({evt.accessCode || '-'})</span>
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Cat: {evt.category || 'umum'} • {evt.modelUsed || 'Gemini'} • {evt.latencyMs ?? 0}ms
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold shrink-0 ${
                      outcome.toLowerCase() === 'success' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    }`}>
                      {outcome.toUpperCase()}
                    </span>
                  </div>
                );
              })}
              {validEvents.length === 0 && (
                <p className="text-xs text-slate-500 py-4 text-center">Belum ada log event generasi terkini.</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Real Category Breakdown Chart & Quick Shortcuts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <ActivityTrendChart data={trendData} />
          
          <CategoryBreakdownChart
            data={categoryBreakdownList}
            totalExecutions={totalEventsCount}
            isLoading={eventsLoading}
            error={eventsError}
          />
        </div>

        {/* Right Column: Quick Shortcuts */}
        <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-2xl p-6 shadow-xl space-y-5 border border-slate-800 flex flex-col justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base font-extrabold tracking-tight">Pintasan Akses Cepat Admin</h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Kelola ekosistem Tools Satset dengan navigasi langsung ke panel manajemen spesifik.
            </p>
          </div>

          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigateTab('clients')}
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center justify-between border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-400" />
                <span>Monitoring Client</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('payment_queue')}
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center justify-between border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Verifikasi Pembayaran QRIS</span>
              </div>
              <span className="px-2 py-0.5 rounded-md bg-amber-400/20 text-amber-300 text-[10px] font-bold">
                {pendingQueueCount} Pending
              </span>
            </button>

            <button
              type="button"
              onClick={() => onNavigateTab('packages')}
              className="w-full px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all flex items-center justify-between border border-white/10 cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Manajemen Paket & Lisensi</span>
              </div>
              <ArrowRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  RefreshCw, 
  ShieldAlert, 
  Check, 
  Copy, 
  Clock, 
  RotateCw, 
  Trash2, 
  Activity, 
  Zap, 
  X,
  ArrowUp,
  ArrowDown,
  Cpu,
  Sparkles,
  AlertTriangle,
  Layers,
  BarChart2,
  Radio,
  Server,
  CheckCircle2,
  XCircle,
  Search,
  Filter,
  Loader2
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import StatCard from '../../components/admin/StatCard';
import { 
  getApiKeys, 
  syncApiKeysWithBackend,
  saveApiKey, 
  saveApiKeysToServer,
  revokeApiKey, 
  rotateApiKey, 
  getApiKeyLogs, 
  maskApiKey, 
  ApiKeyItem, 
  ApiKeyUsageLog,
  getModelPriorities,
  saveModelPriorities,
  syncModelPrioritiesWithBackend,
  ModelPriorityConfig,
  addApiKeysBulkAdmin,
  AVAILABLE_GEMINI_MODELS_CATALOG
} from '../../lib/admin/apiKeys';
import { adminFetch } from '../../lib/admin/adminApi';

export default function ApiKeyManagementPanel() {
  const [apiKeys, setApiKeys] = useState<ApiKeyItem[]>([]);
  const [logs, setLogs] = useState<ApiKeyUsageLog[]>([]);
  const [priorities, setPriorities] = useState<ModelPriorityConfig>(getModelPriorities());
  const [copiedKeyId, setCopiedKeyId] = useState<string | null>(null);
  const [testingKeyId, setTestingKeyId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; latency: number; message: string }>>({});
  const [isPollingAll, setIsPollingAll] = useState<boolean>(false);
  const [pollSummary, setPollSummary] = useState<{ total: number; active: number; rateLimited: number; invalid: number; timestamp: string } | null>(null);

  // Notification Toast State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = React.useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  // Filtering logs
  const [logFilterTool, setLogFilterTool] = useState<string>('all');
  const [logFilterStatus, setLogFilterStatus] = useState<string>('all');
  const [logSearchQuery, setLogSearchQuery] = useState<string>('');

  // New model state
  const [newModelCategory, setNewModelCategory] = useState<'text' | 'image' | 'video'>('text');
  const [newModelName, setNewModelName] = useState('');

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('bulk');
  const [newKeyInput, setNewKeyInput] = useState('');
  const [bulkText, setBulkText] = useState('');
  const [newAliasInput, setNewAliasInput] = useState('Gemini Engine Satset');
  const [newDailyLimitInput, setNewDailyLimitInput] = useState<number>(1000);
  const [isSavingKey, setIsSavingKey] = useState(false);

  const [keyToRotate, setKeyToRotate] = useState<ApiKeyItem | null>(null);
  const [rotateNewKeyInput, setRotateNewKeyInput] = useState('');

  const [keyToRevoke, setKeyToRevoke] = useState<ApiKeyItem | null>(null);

  // Active Tab
  const [activeTab, setActiveTab] = useState<'keys' | 'logs' | 'routing' | 'gateway'>('keys');
  const [gatewayHealth, setGatewayHealth] = useState<any>(null);
  const [isRefreshingGateway, setIsRefreshingGateway] = useState(false);

  const fetchGatewayMetrics = async () => {
    try {
      setIsRefreshingGateway(true);
      const res = await adminFetch('/api/llm-gateway/health');
      if (res.ok && res.data) {
        setGatewayHealth(res.data);
      }
    } catch (e) {
      console.warn('Failed to fetch gateway metrics', e);
    } finally {
      setIsRefreshingGateway(false);
    }
  };

  useEffect(() => {
    loadData();
    fetchGatewayMetrics();
    syncApiKeysWithBackend().then((res) => {
      if (res.keys) setApiKeys(res.keys);
      if (res.logs) setLogs(res.logs);
    });
    syncModelPrioritiesWithBackend().then((cfg) => {
      if (cfg) setPriorities(cfg);
    });

    const handleKeyUpdate = () => {
      loadData();
      fetchGatewayMetrics();
    };
    const handleLogUpdate = (e: any) => {
      fetchGatewayMetrics();
      if (e.detail) {
        if (Array.isArray(e.detail)) {
          setLogs(e.detail);
        } else {
          setLogs((prev) => [e.detail, ...prev.filter((l) => l.id !== e.detail.id)].slice(0, 100));
        }
      } else {
        loadData();
      }
    };

    window.addEventListener('satset_apikeys_updated', handleKeyUpdate);
    window.addEventListener('satset_apikey_logs_updated', handleLogUpdate);
    window.addEventListener('satset_model_priorities_updated', loadPriorities);
    window.addEventListener('storage', loadData);

    const interval = setInterval(fetchGatewayMetrics, 15000);

    return () => {
      clearInterval(interval);
      window.removeEventListener('satset_apikeys_updated', handleKeyUpdate);
      window.removeEventListener('satset_apikey_logs_updated', handleLogUpdate);
      window.removeEventListener('satset_model_priorities_updated', loadPriorities);
      window.removeEventListener('storage', loadData);
    };
  }, []);

  const loadData = () => {
    setApiKeys(getApiKeys());
    setLogs(getApiKeyLogs());
  };

  const loadPriorities = () => {
    setPriorities(getModelPriorities());
  };

  const handleTestKeyHealth = async (item: ApiKeyItem) => {
    setTestingKeyId(item.id);
    const startTime = Date.now();
    try {
      const res = await adminFetch<{ success: boolean; model?: string; error?: string; latency?: number }>('/api/test-gemini-key', {
        method: 'POST',
        body: JSON.stringify({ apiKey: item.key, keyId: item.id })
      });
      const latency = Date.now() - startTime;
      if (res.ok && res.data?.success) {
        const modelTested = res.data.model || 'gemini';
        setTestResults((prev) => ({
          ...prev,
          [item.id]: { ok: true, latency, message: `Aktif (${latency}ms • ${modelTested})` }
        }));
        await syncApiKeysWithBackend().then(loadData);
        fetchGatewayMetrics();
        showToast(`Key "${item.alias}" aktif! Merespons dalam ${latency}ms via ${modelTested}.`, 'success');
      } else {
        const errMsg = res.data?.error || res.error || 'Gagal / Limit Kuota';
        setTestResults((prev) => ({
          ...prev,
          [item.id]: { ok: false, latency, message: errMsg }
        }));
        showToast(`Uji Key "${item.alias}" gagal: ${errMsg}`, 'error');
      }
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [item.id]: { ok: false, latency: Date.now() - startTime, message: err?.message || 'Network error' }
      }));
      showToast(`Error pengujian key: ${err?.message || 'Network error'}`, 'error');
    } finally {
      setTestingKeyId(null);
    }
  };

  const handlePollAllKeys = async () => {
    if (isPollingAll) return;
    setIsPollingAll(true);
    try {
      const res = await adminFetch<{
        success: boolean;
        totalTested?: number;
        activeCount?: number;
        rateLimitedCount?: number;
        invalidCount?: number;
        results?: Array<{ id: string; ok: boolean; latencyMs?: number; modelTested?: string; error?: string }>;
        error?: string;
      }>('/api/admin/apikeys/poll-all', {
        method: 'POST',
        body: JSON.stringify({ keys: apiKeys })
      });
      if (res.ok && res.data?.success) {
        const d = res.data;
        setPollSummary({
          total: d.totalTested || 0,
          active: d.activeCount || 0,
          rateLimited: d.rateLimitedCount || 0,
          invalid: d.invalidCount || 0,
          timestamp: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
        });
        if (Array.isArray(d.results)) {
          const map: Record<string, { ok: boolean; latency: number; message: string }> = {};
          d.results.forEach((r: any) => {
            if (r.id) {
              map[r.id] = {
                ok: r.ok,
                latency: r.latencyMs || 0,
                message: r.ok ? `Aktif (${r.latencyMs}ms • ${r.modelTested})` : (r.error || 'Gagal / Limit')
              };
            }
          });
          setTestResults((prev) => ({ ...prev, ...map }));
        }
        await syncApiKeysWithBackend().then(loadData);
        await fetchGatewayMetrics();
        showToast(`Polling selesai! ${d.activeCount || 0} aktif, ${d.rateLimitedCount || 0} rate-limited, ${d.invalidCount || 0} invalid.`, 'success');
      } else {
        showToast(res.data?.error || res.error || 'Gagal melakukan polling API Key', 'error');
      }
    } catch (e: any) {
      console.error('Error polling pool keys:', e);
      showToast('Terjadi kesalahan jaringan saat polling API Key: ' + (e?.message || ''), 'error');
    } finally {
      setIsPollingAll(false);
    }
  };

  const handleMoveModel = (category: 'text' | 'image' | 'video', index: number, direction: 'up' | 'down') => {
    const list = [...priorities[category]];
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const temp = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = temp;

    const updated = { ...priorities, [category]: list };
    setPriorities(updated);
    saveModelPriorities(updated);
  };

  const handleRemoveModel = (category: 'text' | 'image' | 'video', index: number) => {
    const list = [...priorities[category]];
    if (list.length <= 1) {
      showToast('Kategori harus memiliki minimal 1 model prioritas.', 'error');
      return;
    }
    list.splice(index, 1);
    const updated = { ...priorities, [category]: list };
    setPriorities(updated);
    saveModelPriorities(updated);
    showToast('Model berhasil dihapus dari prioritas.', 'info');
  };

  const handleAddModel = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newModelName.trim()) return;
    const model = newModelName.trim().toLowerCase();
    const list = priorities[newModelCategory];
    if (list.includes(model)) {
      showToast('Model ini sudah ada dalam daftar prioritas.', 'error');
      return;
    }

    const updated = { ...priorities, [newModelCategory]: [...list, model] };
    setPriorities(updated);
    saveModelPriorities(updated);
    setNewModelName('');
    showToast(`Model ${model} berhasil ditambahkan ke prioritas.`, 'success');
  };

  const safeKeys = Array.isArray(apiKeys) ? apiKeys : [];
  const safeLogs = Array.isArray(logs) ? logs : [];

  // BUG FIX 4: Accurate activeKeysCount and cooldown badge calculation
  const now = Date.now();
  const isKeyEffectivelyActive = (k: ApiKeyItem) => {
    if (k.status === 'revoked' || (k.status as any) === 'disabled' || (k.status as any) === 'expired') return false;
    const isCoolingDown = Boolean(k.cooldownUntil && k.cooldownUntil > now);
    if (isCoolingDown) return false;
    return k.status === 'active' || k.status === 'rate_limited';
  };

  const activeKeysCount = safeKeys.filter(isKeyEffectivelyActive).length;
  const cooldownKeysCount = safeKeys.filter((k) => {
    if (k.status === 'revoked' || (k.status as any) === 'disabled') return false;
    return Boolean(k.cooldownUntil && k.cooldownUntil > now);
  }).length;
  const totalDailyRequests = safeKeys.reduce((acc, k) => acc + (k.dailyUsage || 0), 0);
  const totalLogsCount = safeLogs.length;
  const rateLimitedCount = safeLogs.filter((l) => l.status === 'rate_limited').length;
  const successLogsCount = safeLogs.filter((l) => l.status === 'success').length;
  const successRate = totalLogsCount > 0 ? Math.round((successLogsCount / totalLogsCount) * 100) : 100;

  // Filtered Logs
  const filteredLogs = safeLogs.filter((log) => {
    if (logFilterStatus !== 'all' && log.status !== logFilterStatus) return false;
    if (logFilterTool !== 'all') {
      const t = (log.toolName || log.endpoint || '').toLowerCase();
      if (!t.includes(logFilterTool.toLowerCase())) return false;
    }
    if (logSearchQuery.trim()) {
      const q = logSearchQuery.toLowerCase();
      const str = `${log.keyMasked} ${log.endpoint} ${log.modelUsed || ''} ${log.toolName || ''} ${log.userCode || ''}`.toLowerCase();
      if (!str.includes(q)) return false;
    }
    return true;
  });

  const handleCopyKey = (id: string, keyStr: string) => {
    navigator.clipboard.writeText(keyStr);
    setCopiedKeyId(id);
    setTimeout(() => setCopiedKeyId(null), 2000);
  };

  const handleAddKey = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingKey) return;

    if (addMode === 'bulk') {
      if (!bulkText.trim()) {
        showToast('Mohon masukkan minimal 1 baris API Key.', 'error');
        return;
      }

      try {
        setIsSavingKey(true);
        const result = addApiKeysBulkAdmin(bulkText, Number(newDailyLimitInput) || 1000);
        // Synchronize and await direct server persistence
        await saveApiKeysToServer(getApiKeys());

        let msg = `Berhasil menambahkan ${result.addedCount} API Key baru ke Pool Server & Database Firestore!`;
        if (result.skippedDuplicatesCount > 0) {
          msg += ` (${result.skippedDuplicatesCount} key duplikat di-skip)`;
        }
        if (result.invalidLinesCount > 0) {
          msg += ` (${result.invalidLinesCount} baris tidak valid di-skip)`;
        }

        showToast(msg, 'success');
        setShowAddModal(false);
        setBulkText('');
        loadData();
        fetchGatewayMetrics();
      } catch (err: any) {
        console.error('Error saving bulk keys:', err);
        showToast('Gagal menyimpan bulk key: ' + (err?.message || ''), 'error');
      } finally {
        setIsSavingKey(false);
      }
      return;
    }

    // Single Key Mode
    const trimmedKey = newKeyInput.trim();
    if (!trimmedKey) {
      showToast('Mohon masukkan string API Key.', 'error');
      return;
    }

    // Format validation
    if (!trimmedKey.startsWith('AIza') && trimmedKey.length < 20) {
      showToast('Format API Key Gemini tidak valid (harus diawali AIza... atau minimal 20 karakter).', 'error');
      return;
    }

    // Duplicate check
    const existingKeys = getApiKeys();
    if (existingKeys.some((k) => k.key.trim() === trimmedKey)) {
      showToast('API Key ini sudah terdaftar sebelumnya.', 'error');
      return;
    }

    try {
      setIsSavingKey(true);
      const item: ApiKeyItem = {
        id: `key_${Date.now()}`,
        key: trimmedKey,
        alias: newAliasInput.trim() || 'Gemini Key',
        dailyLimit: Number(newDailyLimitInput) || 1000,
        dailyUsage: 0,
        monthlyLimit: (Number(newDailyLimitInput) || 1000) * 30,
        monthlyUsage: 0,
        status: 'active',
        createdAt: new Date().toISOString(),
        keyType: 'admin_pool',
        toolUsage: {},
        modelUsage: {},
        modelStatus: {}
      };

      const updated = saveApiKey(item);
      // Ensure it is fully committed to the server
      await saveApiKeysToServer(updated);

      showToast(`API Key "${item.alias}" berhasil disimpan dan aktif!`, 'success');
      setShowAddModal(false);
      setNewKeyInput('');
      loadData();
      fetchGatewayMetrics();
    } catch (err: any) {
      console.error('Error saving key:', err);
      showToast('Gagal menyimpan key: ' + (err?.message || ''), 'error');
    } finally {
      setIsSavingKey(false);
    }
  };

  const handleRevokeKey = (item: ApiKeyItem) => {
    revokeApiKey(item.id);
    loadData();
    fetchGatewayMetrics();
    showToast(`API Key "${item.alias}" berhasil dinonaktifkan (revoked).`, 'info');
  };

  const handleConfirmRotate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!keyToRotate || !rotateNewKeyInput.trim()) return;

    rotateApiKey(keyToRotate.id, rotateNewKeyInput.trim(), `${keyToRotate.alias || 'Key'} (Rotated)`);
    setKeyToRotate(null);
    setRotateNewKeyInput('');
    loadData();
    fetchGatewayMetrics();
    showToast('API Key berhasil dirotasi! Key lama telah direvokasi dan key baru telah diaktifkan.', 'success');
  };

  const getToolBadgeColor = (toolName?: string) => {
    const t = (toolName || '').toLowerCase();
    if (t.includes('ide') || t.includes('idea') || t.includes('aeo')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (t.includes('video') || t.includes('splitter')) return 'bg-indigo-50 text-indigo-700 border-indigo-200';
    if (t.includes('photo') || t.includes('foto') || t.includes('8k')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (t.includes('tiktok') || t.includes('shop')) return 'bg-rose-50 text-rose-700 border-rose-200';
    if (t.includes('extractor') || t.includes('frame')) return 'bg-purple-50 text-purple-700 border-purple-200';
    return 'bg-slate-50 text-slate-700 border-slate-200';
  };

  const keyColumns = [
    {
      header: 'Alias & Key String',
      render: (item: ApiKeyItem) => {
        const isUserKey = item.keyType === 'user_custom';
        const isCoolingDown = item.cooldownUntil && item.cooldownUntil > Date.now();
        const isPolled = Boolean(item.verifiedByAdmin || item.lastPolledAt);
        const testRes = testResults[item.id];

        return (
          <div className="space-y-1.5 min-w-[210px]">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="font-extrabold text-slate-900 text-xs">{item.alias || 'Gemini Key'}</span>
              <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase border ${
                isUserKey ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}>
                {isUserKey ? '👤 User Key' : '👑 Admin Pool'}
              </span>
              {isPolled && item.status === 'active' && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-300 flex items-center gap-0.5 shadow-2xs">
                  <Zap className="w-2.5 h-2.5 text-emerald-600 fill-emerald-600" />
                  <span>Prioritas Polled</span>
                </span>
              )}
              {isCoolingDown && (
                <span className="px-1.5 py-0.2 rounded text-[9px] font-bold bg-amber-100 text-amber-800 border border-amber-300 animate-pulse">
                  ⏳ Cooldown 5m
                </span>
              )}
            </div>

            <div className="flex items-center gap-1.5 font-mono text-[11px] text-slate-600 bg-slate-50 px-2 py-0.5 rounded-lg border border-slate-200 w-fit">
              <span>{maskApiKey(item.key)}</span>
              <button
                type="button"
                onClick={() => handleCopyKey(item.id, item.key)}
                className="p-0.5 text-slate-400 hover:text-slate-600 transition-colors"
                title="Copy Key"
              >
                {copiedKeyId === item.id ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>

            {testRes && (
              <div className={`text-[10px] font-bold flex items-center gap-1 ${testRes.ok ? 'text-emerald-600' : 'text-rose-600'}`}>
                {testRes.ok ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                <span>{testRes.message}</span>
              </div>
            )}

            {!testRes && isPolled && item.lastTestedLatency && (
              <div className="text-[10px] font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                <span>Terverifikasi ({item.lastTestedLatency}ms • {item.lastTestedModel || 'gemini'})</span>
              </div>
            )}
          </div>
        );
      }
    },
    {
      header: 'Beban Request Harian',
      render: (item: ApiKeyItem) => {
        const usage = item.dailyUsage || 0;
        const limit = item.dailyLimit || 1000;
        const pct = Math.min(100, Math.round((usage / limit) * 100));
        return (
          <div className="space-y-1 min-w-[150px]">
            <div className="flex justify-between text-[11px] font-bold">
              <span className="text-slate-700">{usage.toLocaleString()} / {limit.toLocaleString()} req</span>
              <span className={pct > 80 ? 'text-rose-600 font-extrabold' : 'text-slate-500'}>{pct}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className={`h-2 rounded-full transition-all duration-500 ${
                  pct > 90 ? 'bg-rose-500' : pct > 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <div className="text-[10px] text-slate-400 flex justify-between">
              <span>Bulan ini: {item.monthlyUsage || 0} req</span>
              {item.lastUsedAt && (
                <span>Aktif: {new Date(item.lastUsedAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
              )}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Sebaran Pemakaian Tool',
      render: (item: ApiKeyItem) => {
        const tUsage = item.toolUsage || {};
        const entries = Object.entries(tUsage);
        if (entries.length === 0) {
          return <span className="text-[11px] text-slate-400 italic">Belum ada request tool</span>;
        }

        return (
          <div className="flex flex-wrap gap-1 max-w-[240px]">
            {entries.slice(0, 4).map(([tool, count]) => (
              <span
                key={tool}
                className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1"
                title={`${tool}: ${count} permintaan`}
              >
                <span className="truncate max-w-[100px]">{tool}</span>
                <span className="font-bold text-[#3525cd]">({count})</span>
              </span>
            ))}
            {entries.length > 4 && (
              <span className="text-[10px] text-slate-400 font-medium self-center">
                +{entries.length - 4} tool
              </span>
            )}
          </div>
        );
      }
    },
    {
      header: 'Status Limit & Model',
      render: (item: ApiKeyItem) => {
        const mStatus = item.modelStatus || {};
        const hasRateLimit = Object.values(mStatus).some((s) => s === 'rate_limited');
        const hasDead = Object.values(mStatus).some((s) => s === 'dead') || item.status === 'revoked';
        const isCoolingDown = Boolean(item.cooldownUntil && item.cooldownUntil > Date.now());
        const remainingSec = isCoolingDown ? Math.max(1, Math.round(((item.cooldownUntil || 0) - Date.now()) / 1000)) : 0;

        return (
          <div className="space-y-1 min-w-[130px]">
            <div className="flex items-center gap-1">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                item.status === 'revoked' || hasDead
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : isCoolingDown
                  ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                  : hasRateLimit
                  ? 'bg-amber-50 text-amber-700 border-amber-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {item.status === 'revoked' || hasDead
                  ? '🔴 Nonaktif'
                  : isCoolingDown
                  ? `⏳ Cooldown (${remainingSec}s)`
                  : hasRateLimit
                  ? '🟡 Limited / Cascaded'
                  : '🟢 Siap (Ready)'}
              </span>
            </div>

            {/* Model limit breakdown badges */}
            <div className="flex flex-wrap gap-1">
              {Object.entries(mStatus).slice(0, 2).map(([model, stat]) => (
                <span
                  key={model}
                  className={`text-[9px] px-1 py-0.2 rounded font-mono border ${
                    stat === 'rate_limited'
                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                      : stat === 'dead'
                      ? 'bg-rose-50 text-rose-800 border-rose-200'
                      : 'bg-emerald-50 text-emerald-800 border-emerald-200'
                  }`}
                >
                  {model.replace('gemini-', '')}: {stat === 'rate_limited' ? '429' : 'OK'}
                </span>
              ))}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Aksi & Test',
      render: (item: ApiKeyItem) => (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleTestKeyHealth(item)}
            disabled={testingKeyId === item.id}
            className="px-2 py-1 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors flex items-center gap-1 cursor-pointer disabled:opacity-50"
            title="Test Koneksi & Latensi Realtime"
          >
            <Zap className={`w-3.5 h-3.5 ${testingKeyId === item.id ? 'animate-spin text-amber-500' : 'text-slate-500'}`} />
            <span>Test</span>
          </button>

          {item.status === 'active' && (
            <>
              <button
                type="button"
                onClick={() => setKeyToRotate(item)}
                className="px-2.5 py-1 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1 border border-indigo-100 cursor-pointer"
                title="Rotasi Key String"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Rotate</span>
              </button>

              <button
                type="button"
                onClick={() => setKeyToRevoke(item)}
                className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 transition-colors cursor-pointer"
                title="Revoke / Nonaktifkan Key"
              >
                <ShieldAlert className="w-4 h-4" />
              </button>
            </>
          )}
        </div>
      )
    }
  ];

  const logColumns = [
    {
      header: 'Waktu & User',
      render: (log: ApiKeyUsageLog) => (
        <div className="space-y-0.5 min-w-[120px]">
          <div className="text-[11px] text-slate-700 font-mono font-bold">
            {new Date(log.timestamp).toLocaleTimeString('id-ID')}
          </div>
          <div className="text-[10px] text-slate-400 font-medium truncate">
            {log.userCode || 'GUEST'}
          </div>
        </div>
      )
    },
    {
      header: 'Tool / Fitur yang Digunakan',
      render: (log: ApiKeyUsageLog) => {
        const badgeStyle = getToolBadgeColor(log.toolName || log.endpoint);
        return (
          <div className="space-y-0.5">
            <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold border ${badgeStyle} inline-block`}>
              {log.toolName || log.endpoint.replace('/api/', '')}
            </span>
            <div className="text-[10px] font-mono text-slate-400">
              {log.endpoint}
            </div>
          </div>
        );
      }
    },
    {
      header: 'Model & Latensi',
      render: (log: ApiKeyUsageLog) => (
        <div className="space-y-0.5">
          <div className="font-mono text-xs font-bold text-slate-800">
            {log.modelUsed || 'gemini-3.7-flash'}
          </div>
          {log.latencyMs ? (
            <div className="text-[10px] font-semibold text-slate-500 flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-400" />
              <span>{log.latencyMs} ms</span>
            </div>
          ) : (
            <div className="text-[10px] text-slate-400">Streamed</div>
          )}
        </div>
      )
    },
    {
      header: 'Key Digunakan & Sumber',
      render: (log: ApiKeyUsageLog) => (
        <div className="space-y-1">
          <code className="text-[10px] font-mono text-slate-600 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
            {log.keyMasked}
          </code>
          <div>
            <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded uppercase border ${
              log.keySource === 'user_custom'
                ? 'bg-purple-50 text-purple-700 border-purple-200'
                : 'bg-blue-50 text-blue-700 border-blue-200'
            }`}>
              {log.keySource === 'user_custom' ? 'User Custom Key' : 'Admin Pool'}
            </span>
          </div>
        </div>
      )
    },
    {
      header: 'Status & Routing',
      render: (log: ApiKeyUsageLog) => (
        <div className="space-y-1">
          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border inline-block ${
            log.status === 'success'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : log.status === 'rate_limited'
              ? 'bg-amber-50 text-amber-800 border-amber-300'
              : 'bg-rose-50 text-rose-700 border-rose-200'
          }`}>
            {log.status === 'success' ? '🟢 200 OK' : log.status === 'rate_limited' ? '🟡 429 Cascaded' : '🔴 Error'}
          </span>
          {log.fallbackReason && (
            <div className="text-[10px] text-amber-700 font-medium max-w-[180px] truncate" title={log.fallbackReason}>
              {log.fallbackReason}
            </div>
          )}
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Top Realtime Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <StatCard
          title="Active API Keys"
          value={`${activeKeysCount} Key`}
          subtext={cooldownKeysCount > 0 ? `${cooldownKeysCount} key sedang cooldown (auto-lift)` : 'Rotasi pool & user key aktif'}
          badge={{ text: 'Real-time Pool', type: 'success' }}
          icon={<Key className="w-4 h-4" />}
          iconBgColor="bg-indigo-50 border-indigo-100"
          iconTextColor="text-[#3525cd]"
        />

        <StatCard
          title="Total Requests Hari Ini"
          value={`${totalDailyRequests.toLocaleString()} Calls`}
          subtext="Akumulasi seluruh endpoint & tools"
          badge={{ text: 'Realtime Traffic', type: 'info' }}
          icon={<Activity className="w-4 h-4" />}
          iconBgColor="bg-purple-50 border-purple-100"
          iconTextColor="text-purple-600"
        />

        <StatCard
          title="Tingkat Keberhasilan (Health)"
          value={`${successRate}%`}
          subtext={`${rateLimitedCount} auto-cascaded rate limits`}
          badge={{ text: successRate >= 95 ? 'Optimal' : 'Cascading Active', type: successRate >= 95 ? 'success' : 'warning' }}
          icon={<Zap className="w-4 h-4" />}
          iconBgColor="bg-emerald-50 border-emerald-100"
          iconTextColor="text-emerald-600"
        />

      </div>

      {/* Navigation Sub-Tabs (minimal underline style) */}
      <div className="flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-5 overflow-x-auto">
          <button
            type="button"
            onClick={() => setActiveTab('keys')}
            className={`py-2.5 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'keys'
                ? 'border-[#3525cd] text-[#3525cd]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Key className="w-3.5 h-3.5" />
            <span>Daftar API Key ({safeKeys.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('logs')}
            className={`py-2.5 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 -mb-px whitespace-nowrap relative ${
              activeTab === 'logs'
                ? 'border-[#3525cd] text-[#3525cd]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="w-3.5 h-3.5" />
            <span>Log Request Real-time</span>
            <span className="flex h-1.5 w-1.5 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('routing')}
            className={`py-2.5 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'routing'
                ? 'border-[#3525cd] text-[#3525cd]'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Auto-Routing & Priority Model</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setActiveTab('gateway');
              fetchGatewayMetrics();
            }}
            className={`py-2.5 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer border-b-2 -mb-px whitespace-nowrap ${
              activeTab === 'gateway'
                ? 'border-emerald-600 text-emerald-700'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Server className="w-3.5 h-3.5" />
            <span>LLM Gateway Live</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => syncApiKeysWithBackend().then(loadData)}
          className="p-2 text-slate-400 hover:text-slate-700 text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors shrink-0"
          title="Sinkronkan dengan Database Server"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Sync</span>
        </button>
      </div>

      {/* TAB 1: API KEYS LIST */}
      {activeTab === 'keys' && (
        <div className="space-y-4">
          {/* Ringkasan status routing singkat (menggantikan banner besar sebelumnya) */}
          <p className="text-xs text-slate-500 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
            Gateway AI memprioritaskan <strong className="text-slate-700 font-bold">{safeKeys.filter(k => (k.verifiedByAdmin || k.lastPolledAt) && k.status === 'active').length} API Key</strong> yang telah terverifikasi (polled) aktif sebelum fallback ke key cadangan.
          </p>

          {pollSummary && (
            <div className="p-3.5 bg-gradient-to-r from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs shadow-2xs">
              <div className="flex items-center gap-2">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span className="font-extrabold text-slate-800">
                  Hasil Polling Admin Pool ({pollSummary.timestamp}):
                </span>
                <span className="text-emerald-700 font-bold bg-emerald-100 px-2 py-0.5 rounded-md">
                  {pollSummary.active} Aktif
                </span>
                {pollSummary.rateLimited > 0 && (
                  <span className="text-amber-700 font-bold bg-amber-100 px-2 py-0.5 rounded-md">
                    {pollSummary.rateLimited} Rate-Limited (429)
                  </span>
                )}
                {pollSummary.invalid > 0 && (
                  <span className="text-rose-700 font-bold bg-rose-100 px-2 py-0.5 rounded-md">
                    {pollSummary.invalid} Invalid / Error
                  </span>
                )}
              </div>
              <span className="text-slate-500 font-medium">
                Total {pollSummary.total} Key diperiksa secara serentak
              </span>
            </div>
          )}

          <DataTable
            title="Daftar & Kuota API Key Gemini AI"
            subtitle="Pantau limit kuota request, sebaran pemakaian per tool, dan status kesehatan model per key secara real-time."
            columns={keyColumns}
            data={safeKeys}
            emptyMessage="Belum ada API Key tersimpan. Tambahkan API Key Gemini pertama Anda."
            headerActions={
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handlePollAllKeys}
                  disabled={isPollingAll || safeKeys.length === 0}
                  className="px-3 py-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Poll dan uji seluruh API Key Gemini di dalam pool secara serentak"
                >
                  <Radio className={`w-3.5 h-3.5 ${isPollingAll ? 'animate-pulse text-emerald-600' : ''}`} />
                  <span>{isPollingAll ? 'Polling Pool...' : 'Poll All Keys'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowAddModal(true)}
                  className="px-4 py-2.5 rounded-full bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>Tambah API Key Baru</span>
                </button>
              </div>
            }
          />
        </div>
      )}

      {/* TAB 2: REALTIME REQUEST LOGS */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filter Bar */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mr-1">
                <Filter className="w-3.5 h-3.5 text-slate-400" />
                <span>Filter:</span>
              </div>

              {/* Tool Filter */}
              <select
                value={logFilterTool}
                onChange={(e) => setLogFilterTool(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-[#3525cd]"
              >
                <option value="all">Semua Tool / Fitur</option>
                <option value="ide">Replika Video Viral (AEO)</option>
                <option value="video">Ekstrak Prompt dari Video</option>
                <option value="photo">Prompt Foto Nano</option>
                <option value="shop">Produk to Video</option>
                <option value="extractor">Frame Extractor</option>
              </select>

              {/* Status Filter */}
              <select
                value={logFilterStatus}
                onChange={(e) => setLogFilterStatus(e.target.value)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 bg-slate-50 focus:outline-none focus:border-[#3525cd]"
              >
                <option value="all">Semua Status</option>
                <option value="success">🟢 Success (200)</option>
                <option value="rate_limited">🟡 Rate Limited (429)</option>
                <option value="error">🔴 Error / Dead</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative w-full md:w-64">
              <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari key, user, atau model..."
                value={logSearchQuery}
                onChange={(e) => setLogSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
              />
            </div>
          </div>

          <DataTable
            title="Live Request Log Stream"
            subtitle={`Menampilkan ${filteredLogs.length} request terakhir yang tercatat di database dan SSE realtime feed.`}
            columns={logColumns}
            data={filteredLogs}
            emptyMessage="Tidak ada log request yang cocok dengan filter."
          />
        </div>
      )}

      {/* TAB 3: AUTO ROUTING & PRIORITY */}
      {activeTab === 'routing' && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <div className="flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#3525cd]" />
                <h3 className="text-base font-extrabold text-slate-900">
                  Model Priority & Auto-Cascading Routing Engine
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-1">
                Sistem perutean cerdas untuk production. Jika API key utama terkena limit (429) pada model nomor 1, request otomatis dialihkan ke model nomor 2 secara instan tanpa membuat user gagal generate.
              </p>
            </div>

            <form onSubmit={handleAddModel} className="flex items-center gap-2">
              <select
                value={newModelCategory}
                onChange={(e) => setNewModelCategory(e.target.value as any)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 focus:outline-none focus:border-[#3525cd] bg-slate-50"
              >
                <option value="text">Text Model</option>
                <option value="image">Image Model</option>
                <option value="video">Video Model</option>
              </select>

              <div className="relative">
                <input
                  type="text"
                  list="gemini-catalog-options"
                  placeholder="Pilih / ketik nama model..."
                  value={newModelName}
                  onChange={(e) => setNewModelName(e.target.value)}
                  className="px-3 py-1.5 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd] min-w-[200px]"
                />
                <datalist id="gemini-catalog-options">
                  {AVAILABLE_GEMINI_MODELS_CATALOG.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name} ({item.category} - {item.tier})
                    </option>
                  ))}
                </datalist>
              </div>

              <button
                type="submit"
                className="px-3 py-1.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Tambah Model</span>
              </button>
            </form>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {(['text', 'image', 'video'] as const).map((category) => {
              const labelMap = {
                text: 'Text Models (Ide Konten, Script, Prompt)',
                image: 'Image Models (Prompt Foto, Image AI)',
                video: 'Video Models (Video Splitter, Veo)'
              };
              const badgeBg = {
                text: 'bg-indigo-50 border-indigo-200 text-indigo-700',
                image: 'bg-emerald-50 border-emerald-200 text-emerald-700',
                video: 'bg-purple-50 border-purple-200 text-purple-700'
              };

              const modelList = priorities[category] || [];

              return (
                <div key={category} className="bg-slate-50/60 rounded-xl p-4 border border-slate-200/80 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-extrabold text-slate-900 flex items-center gap-1.5">
                      <span className={`px-2 py-0.5 rounded-md text-[10px] uppercase font-bold border ${badgeBg[category]}`}>
                        {category}
                      </span>
                      <span className="truncate">{labelMap[category]}</span>
                    </h4>
                    <span className="text-[10px] text-slate-400 font-bold">{modelList.length} Model</span>
                  </div>

                  <div className="space-y-1.5">
                    {modelList.map((model, idx) => (
                      <div
                        key={`${model}-${idx}`}
                        className="bg-white px-3 py-2 rounded-xl border border-slate-200 flex items-center justify-between text-xs font-mono text-slate-800 shadow-2xs group"
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                            idx === 0 ? 'bg-[#3525cd] text-white' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-semibold text-slate-900">{model}</span>
                          {idx === 0 && (
                            <span className="text-[9px] bg-amber-50 text-amber-700 border border-amber-200 px-1.5 py-0.2 rounded font-sans font-bold">
                              Utama
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() => handleMoveModel(category, idx, 'up')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Naikkan prioritas"
                          >
                            <ArrowUp className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            disabled={idx === modelList.length - 1}
                            onClick={() => handleMoveModel(category, idx, 'down')}
                            className="p-1 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent cursor-pointer"
                            title="Turunkan prioritas"
                          >
                            <ArrowDown className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveModel(category, idx)}
                            className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 cursor-pointer"
                            title="Hapus dari rantai"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 4: LLM GATEWAY LIVE MONITOR (99.9% UPTIME & LOAD BALANCING) */}
      {activeTab === 'gateway' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-emerald-800/40 relative overflow-hidden">
            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 text-xs font-extrabold mb-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
                  <span>PRODUCTION LLM GATEWAY ACTIVE</span>
                </div>
                <h3 className="text-xl font-black text-white">Centralized AI Load Balancer & Anti-Limit Router</h3>
                <p className="text-xs text-emerald-200/80 mt-1 max-w-2xl">
                  Memastikan ketersediaan 99.9% uptime dengan dynamic weighted load balancing antar API key, circuit breaker proteksi kuota 429, serta auto-cascading cerdas ke model alternatif.
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={fetchGatewayMetrics}
                  disabled={isRefreshingGateway}
                  className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center gap-1.5 transition-all shadow-md cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isRefreshingGateway ? 'animate-spin' : ''}`} />
                  <span>Refresh Telemetri</span>
                </button>
              </div>
            </div>
          </div>

          {/* Gateway KPI Stats */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Target SLA / Uptime</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {gatewayHealth?.uptimePercentage ? `${gatewayHealth.uptimePercentage}%` : '99.99%'}
              </div>
              <div className="text-[11px] text-emerald-600 font-semibold">
                Reliability tinggi tanpa downtime
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Active Keys in Pool</span>
                <Key className="w-4 h-4 text-indigo-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {gatewayHealth?.metrics?.availableKeysCount ?? safeKeys.filter(k => k.status === 'active').length} Key
              </div>
              <div className="text-[11px] text-slate-500">
                {gatewayHealth?.metrics?.cooldownKeysCount || 0} key sedang cooldown circuit breaker
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Rata-Rata Latensi</span>
                <Zap className="w-4 h-4 text-amber-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {gatewayHealth?.metrics?.averageLatencyMs || 250} ms
              </div>
              <div className="text-[11px] text-amber-600 font-semibold">
                Fast response round-robin
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Fast Failover Skips</span>
                <Zap className="w-4 h-4 text-cyan-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {gatewayHealth?.metrics?.fastFailoverSkips || 0}
              </div>
              <div className="text-[11px] text-cyan-600 font-semibold">
                0ms instant model skip saat limit
              </div>
            </div>

            <div className="bg-white rounded-2xl p-4 border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center justify-between text-slate-500 text-xs font-bold">
                <span>Circuit Breaker Trips</span>
                <ShieldAlert className="w-4 h-4 text-rose-500" />
              </div>
              <div className="text-2xl font-black text-slate-900">
                {gatewayHealth?.metrics?.circuitBreakerTrips || 0}
              </div>
              <div className="text-[11px] text-slate-500">
                Otomatis diisolasi 2.5 menit jika 429
              </div>
            </div>
          </div>

          {/* Key Health Grid */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black text-slate-900">Status Kesehatan Node Key (Live Load Balancer)</h4>
                <p className="text-xs text-slate-500">Monitoring real-time beban in-flight connection, error rate, dan latensi per API key.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.isArray(gatewayHealth?.keys) && gatewayHealth.keys.length > 0 ? (
                gatewayHealth.keys.map((node: any, idx: number) => {
                  const isCooling = node.cooldownUntil && node.cooldownUntil > Date.now();
                  return (
                    <div
                      key={node.keyId || idx}
                      className={`p-4 rounded-xl border transition-all ${
                        node.status === 'revoked'
                          ? 'bg-rose-50/50 border-rose-200'
                          : isCooling
                          ? 'bg-amber-50/50 border-amber-200'
                          : 'bg-slate-50 border-slate-200 hover:border-emerald-300'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="font-mono text-xs font-bold text-slate-800">{node.keyMasked || '••••••••'}</div>
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase border ${
                          node.status === 'revoked'
                            ? 'bg-rose-100 text-rose-700 border-rose-300'
                            : isCooling
                            ? 'bg-amber-100 text-amber-800 border-amber-300 animate-pulse'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                        }`}>
                          {node.status === 'revoked' ? 'Revoked' : isCooling ? 'Cooldown' : 'Active'}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-200/60">
                        <div>
                          <span className="text-slate-400 block text-[10px]">Total Calls</span>
                          <span className="font-bold text-slate-700">{node.totalRequests || 0}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Active Load</span>
                          <span className="font-bold text-indigo-600">{node.activeRequests || 0} req</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Latensi Avg</span>
                          <span className="font-bold text-slate-700">{node.averageLatencyMs || 250} ms</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block text-[10px]">Sumber</span>
                          <span className="font-bold text-slate-600 capitalize">{node.source?.replace('_', ' ') || 'Pool'}</span>
                        </div>
                      </div>

                      {node.lastErrorReason && (
                        <div className="mt-2 text-[10px] text-amber-700 bg-amber-100/60 px-2 py-1 rounded border border-amber-200">
                          {node.lastErrorReason}
                        </div>
                      )}
                    </div>
                  );
                })
              ) : (
                <div className="col-span-full py-8 text-center text-slate-400 text-xs font-semibold">
                  Menghubungkan ke telemetri gateway backend... Silakan tunggu sejenak atau klik Refresh.
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD KEY MODAL */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-150 overflow-hidden">
            {/* Header */}
            <div className="flex items-start justify-between p-7 pb-5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <Key className="w-5 h-5 text-[#3525cd]" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 leading-tight">
                    Tambah API Key Gemini Baru
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">
                    Mode: {addMode === 'bulk' ? 'Tambah Massal (Multi-Baris)' : 'Input Satu per Satu'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-t border-slate-100" />

            <div className="p-7 pt-5 space-y-5">
              {/* Mode Switcher (compact segmented control) */}
              <div className="flex rounded-xl bg-slate-100 p-1 text-xs font-bold w-fit">
                <button
                  type="button"
                  onClick={() => setAddMode('single')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    addMode === 'single'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Satu per Satu
                </button>
                <button
                  type="button"
                  onClick={() => setAddMode('bulk')}
                  className={`px-3 py-1.5 rounded-lg transition-colors cursor-pointer ${
                    addMode === 'bulk'
                      ? 'bg-[#3525cd] text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Tambah Massal
                </button>
              </div>

              <form onSubmit={handleAddKey} className="space-y-5">
                {addMode === 'single' ? (
                  <>
                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">API Key (String Key Gemini)</label>
                      <input
                        type="text"
                        value={newKeyInput}
                        onChange={(e) => setNewKeyInput(e.target.value)}
                        placeholder="AIzaSy..."
                        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 focus:border-[#3525cd]"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-sm font-bold text-slate-700 block mb-1.5">Alias / Catatan</label>
                      <input
                        type="text"
                        value={newAliasInput}
                        onChange={(e) => setNewAliasInput(e.target.value)}
                        placeholder="misal: Gemini Key #3"
                        className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 focus:border-[#3525cd]"
                      />
                    </div>
                  </>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="text-sm text-slate-800">
                        <span className="font-bold">Daftar API Key</span>{' '}
                        <span className="text-slate-500 font-normal">(1 Key per Baris)</span>
                      </label>
                      <span className="text-xs text-slate-600 font-medium bg-slate-100 border border-slate-200 rounded-full px-3 py-1">
                        Auto-alias #1, #2...
                      </span>
                    </div>
                    <textarea
                      rows={6}
                      value={bulkText}
                      onChange={(e) => setBulkText(e.target.value)}
                      placeholder={`Paste banyak API Key Gemini di sini (satu key per baris):\n\nAIzaSyA123...\nAIzaSyB456...\nAIzaSyC789...`}
                      className="w-full px-4 py-3.5 rounded-2xl border border-slate-200 text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 focus:border-[#3525cd] resize-y"
                      required
                    />
                    <div className="flex items-start gap-2.5 mt-3">
                      <span className="mt-0.5 shrink-0 w-5 h-5 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      </span>
                      <p className="text-sm text-slate-600 leading-relaxed">
                        Sistem otomatis mem-parse tiap baris, men-check duplikasi, dan mengenerate alias otomatis.
                      </p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm font-bold text-slate-700 block mb-1.5">Limit Request Harian per Key</label>
                  <input
                    type="number"
                    min="100"
                    max="100000"
                    value={newDailyLimitInput}
                    onChange={(e) => setNewDailyLimitInput(Number(e.target.value))}
                    className="w-full px-4 py-2.5 rounded-2xl border border-slate-200 text-sm font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 focus:border-[#3525cd]"
                    required
                  />
                </div>

                <div className="border-t border-slate-100 pt-5 flex items-center justify-end gap-5">
                  <button
                    type="button"
                    onClick={() => setShowAddModal(false)}
                    disabled={isSavingKey}
                    className="text-sm font-semibold text-slate-600 hover:text-slate-900 disabled:opacity-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSavingKey}
                    className="px-6 py-2.5 rounded-full bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-sm font-bold shadow-xs cursor-pointer disabled:opacity-60 flex items-center gap-2"
                  >
                    {isSavingKey ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>Menyimpan ke Server & Database...</span>
                      </>
                    ) : (
                      <>
                        <Check className="w-4 h-4" />
                        <span>{addMode === 'bulk' ? 'Simpan Semua Key' : 'Simpan Key'}</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* ROTATE KEY MODAL */}
      {keyToRotate && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-7 sm:p-8 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center shrink-0">
                  <RotateCw className="w-5 h-5 text-[#3525cd]" />
                </div>
                <div>
                  <h3 className="text-lg font-extrabold text-slate-900 tracking-tight">
                    Rotasi API Key
                  </h3>
                  <p className="text-sm text-slate-500 font-medium mt-0.5">
                    Target: {keyToRotate.alias}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeyToRotate(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="border-b border-slate-100" />

            <form onSubmit={handleConfirmRotate} className="space-y-4">
              <p className="text-xs text-slate-600 leading-relaxed">
                Memutar key <span className="font-bold text-slate-900">{keyToRotate.alias}</span> akan menonaktifkan key lama ini dan menggantikannya dengan string key baru.
              </p>

              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1">API Key Baru</label>
                <input
                  type="text"
                  value={rotateNewKeyInput}
                  onChange={(e) => setRotateNewKeyInput(e.target.value)}
                  placeholder="AIzaSy..."
                  className="w-full px-4 py-3 rounded-2xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#3525cd]/20 focus:border-[#3525cd]"
                  required
                />
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <div className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-100">
                  <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                </div>
                <p className="text-xs text-slate-600 leading-relaxed">
                  Semua tool yang menggunakan key ini akan otomatis dialihkan ke key baru tanpa downtime.
                </p>
              </div>

              <div className="border-t border-slate-100 pt-4 mt-6 flex items-center justify-end gap-4">
                <button
                  type="button"
                  onClick={() => setKeyToRotate(null)}
                  className="text-sm font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-2 py-2"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-sm font-bold shadow-xs cursor-pointer flex items-center gap-2 transition-all"
                >
                  <RotateCw className="w-4 h-4" />
                  <span>Proses Rotasi</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REVOKE KEY MODAL */}
      {keyToRevoke && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl space-y-5 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <ShieldAlert className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Nonaktifkan API Key?
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5">
                    Target: {keyToRevoke.alias}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setKeyToRevoke(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              Apakah Anda yakin ingin menonaktifkan (<span className="font-bold text-rose-600">revoke</span>) API Key ini? Key yang dinonaktifkan tidak akan digunakan lagi dalam rotasi pemanggilan LLM.
            </p>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setKeyToRevoke(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  handleRevokeKey(keyToRevoke);
                  setKeyToRevoke(null);
                }}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <ShieldAlert className="w-4 h-4" />
                <span>Ya, Nonaktifkan Key</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[9999] max-w-md p-4 rounded-2xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
          toast.type === 'success'
            ? 'bg-slate-950 text-emerald-300 border-emerald-500/40'
            : toast.type === 'error'
            ? 'bg-slate-950 text-rose-300 border-rose-500/40'
            : 'bg-slate-950 text-indigo-300 border-indigo-500/40'
        }`}>
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Activity className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
          )}
          <div className="flex-1 text-xs leading-relaxed font-semibold text-white">
            {toast.message}
          </div>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

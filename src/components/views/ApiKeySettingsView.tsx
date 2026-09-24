import React, { useState, useEffect } from 'react';
import { Key, Sparkles, Trash2, Check, AlertCircle, Info, ShieldCheck, Lock, UserCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  getAntiLimitConfig, 
  saveAntiLimitConfig, 
  maskApiKey, 
  addApiKeysBulk, 
  removeApiKey 
} from '../../lib/antiLimit';
import { AntiLimitConfig } from '../../types';
import { getUserSession } from '../../lib/auth';

interface ApiKeySettingsViewProps {
  onKeysUpdated?: () => void;
}

export default function ApiKeySettingsView({ onKeysUpdated }: ApiKeySettingsViewProps) {
  const [bulkInput, setBulkInput] = useState('');
  const [config, setConfig] = useState<AntiLimitConfig>({
    enableCache: true,
    enableAutoRetry: true,
    customApiKey: '',
    apiKeys: [],
  });
  const [registeredKeys, setRegisteredKeys] = useState<string[]>([]);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const session = getUserSession();
  const currentAccessCode = session?.code || 'GUEST';
  const clientName = session?.name || (session?.role === 'admin' ? 'Administrator' : 'Klien Satset');

  const reloadKeys = () => {
    const cfg = getAntiLimitConfig();
    setConfig(cfg);
    let keys = cfg.apiKeys || [];
    if (keys.length === 0 && cfg.customApiKey) {
      keys = [cfg.customApiKey];
    }
    setRegisteredKeys(keys);
  };

  useEffect(() => {
    reloadKeys();

    const handleKeysUpdated = () => {
      reloadKeys();
    };

    window.addEventListener('api-keys-updated', handleKeysUpdated);
    return () => {
      window.removeEventListener('api-keys-updated', handleKeysUpdated);
    };
  }, []);

  const handleRegisterKeys = (e: React.FormEvent) => {
    e.preventDefault();
    if (!bulkInput.trim()) {
      return;
    }

    addApiKeysBulk(bulkInput);
    setBulkInput('');
    reloadKeys();
    if (onKeysUpdated) onKeysUpdated();

    setSuccessMsg('Kunci akses berhasil didaftarkan!');
    setTimeout(() => {
      setSuccessMsg(null);
    }, 3000);
  };

  const handleDeleteKey = (keyToDelete: string) => {
    removeApiKey(keyToDelete);
    reloadKeys();
    if (onKeysUpdated) onKeysUpdated();
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-12">
      {/* Page Title Header */}
      <div>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">API Key Setting</h1>
        <p className="text-sm text-slate-500 mt-1">Kelola kunci akses dan pantau status koneksi AI Anda.</p>
      </div>

      {/* Main Settings Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-xs space-y-6">
        
        {/* Success Alert */}
        <AnimatePresence>
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm font-medium flex items-center gap-2.5"
            >
              <Check className="w-5 h-5 text-emerald-600 flex-shrink-0" />
              <span>{successMsg}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Registration Form */}
        <form onSubmit={handleRegisterKeys} className="space-y-4 flex flex-col">
          <textarea
            rows={4}
            value={bulkInput}
            onChange={(e) => setBulkInput(e.target.value)}
            placeholder={`Masukkan API key Anda di sini (satu per baris)...`}
            className="w-full p-4 rounded-xl border border-slate-200 text-slate-900 text-sm font-mono placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#7c3aed]/20 focus:border-[#7c3aed] bg-white transition-all resize-none"
          />

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!bulkInput.trim()}
              className="bg-[#7c3aed] hover:bg-[#6d28d9] disabled:opacity-50 text-white font-semibold px-6 py-2.5 rounded-xl shadow-xs transition-all flex items-center gap-2 text-sm cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>Daftarkan Kunci</span>
            </button>
          </div>
        </form>

        {/* Divider */}
        <div className="border-t border-slate-100 pt-6">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-bold text-slate-900">Kunci Terdaftar</h3>
            {registeredKeys.length > 0 && (
              <span className="text-xs font-medium text-slate-500 bg-slate-100 px-2.5 py-0.5 rounded-full">
                {registeredKeys.length} Key
              </span>
            )}
          </div>

          {/* Registered Keys Table */}
          <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white">
            <table className="w-full text-left text-sm border-collapse">
              <thead>
                <tr className="border-b border-slate-200/80 bg-slate-50/70 text-slate-500 font-semibold text-xs">
                  <th className="py-3 px-6">API Key</th>
                  <th className="py-3 px-6 text-center">Status</th>
                  <th className="py-3 px-6 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registeredKeys.map((keyItem, index) => (
                  <tr key={index} className="hover:bg-slate-50/50 transition-colors">
                    <td className="py-3.5 px-6 font-mono font-medium text-slate-800 text-xs sm:text-sm">
                      {maskApiKey(keyItem)}
                    </td>
                    <td className="py-3.5 px-6 text-center">
                      <span className="inline-flex items-center px-3 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-700 tracking-wider">
                        AKTIF
                      </span>
                    </td>
                    <td className="py-3.5 px-6 text-right">
                      <button
                        type="button"
                        onClick={() => handleDeleteKey(keyItem)}
                        title="Hapus Kunci"
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors inline-flex items-center justify-center cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {registeredKeys.length === 0 && (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-slate-400 text-xs sm:text-sm">
                      Belum ada API key terdaftar. Silakan masukkan kunci akses Anda di atas.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Zap, 
  Sparkles, 
  Key, 
  Award, 
  ArrowRight, 
  Search, 
  Star, 
  Check,
  Copy, 
  ArrowLeft,
  MessageCircle,
  RefreshCw
} from 'lucide-react';
import CheckoutWizardView from './CheckoutWizardView';
import TransactionStatusView from './TransactionStatusView';
import { formatRupiah } from '../../lib/payment';
import { getUserSession } from '../../lib/auth';
import { getPackages, syncPackagesAsync, subscribeToPackages, PackageItem } from '../../lib/admin/packages';
import { getClients } from '../../lib/admin/clients';
import { sseManager } from '../../lib/sseManager';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { getWhatsAppUrl, getContactSettings } from '../../lib/admin/contactSettings';

interface PaketAksesViewProps {
  onSuccessLogin?: () => void;
  onBackToLogin?: () => void;
}

export default function PaketAksesView({ onSuccessLogin, onBackToLogin }: PaketAksesViewProps = {}) {
  const [viewState, setViewState] = useState<'plans' | 'checkout' | 'status'>('plans');
  const [selectedPlanId, setSelectedPlanId] = useState<string>('bulanan');
  const [statusTrxId, setStatusTrxId] = useState<string>('');
  const [packages, setPackages] = useState<PackageItem[]>(() => getPackages().filter((p) => p.isActive));
  const [copiedCode, setCopiedCode] = useState<boolean>(false);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const session = getUserSession();

  // Check member eligibility: must be logged in as user/admin or valid client with active/expiring_soon status
  const isMemberEligible = Boolean(
    session &&
      (session.role === 'admin' ||
        session.role === 'user' ||
        (session.code &&
          getClients().some(
            (c) =>
              c.accessCode.toUpperCase() === session.code.toUpperCase() &&
              (c.status === 'active' || c.status === 'expiring_soon')
          )))
  );

  const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'public' | 'member'>(() => {
    const sess = getUserSession();
    return sess ? 'member' : 'public';
  });

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // 1. Load cached packages immediately for instant UI
    const activePkgs = getPackages().filter((p) => p.isActive);
    if (activePkgs.length > 0) {
      setPackages(activePkgs);
    }

    // 2. Hydrate & Sync Realtime with Firestore & Backend
    setIsSyncing(true);
    subscribeToPackages();
    syncPackagesAsync()
      .then((res) => {
        if (res && Array.isArray(res.packages)) {
          setPackages(res.packages.filter((p) => p.isActive));
        }
      })
      .catch((err) => console.warn('[PaketAksesView] Initial sync notice:', err))
      .finally(() => setIsSyncing(false));

    // 3. Listen to real-time events (Firestore onSnapshot, Admin events, SSE)
    const handlePackageUpdate = () => {
      const fresh = getPackages().filter((p) => p.isActive);
      setPackages(fresh);
    };

    const unsubscribeSSE = sseManager.subscribe((data) => {
      if (data && data.type === 'packages_updated' && Array.isArray(data.packages)) {
        setPackages(data.packages.filter((p: PackageItem) => p.isActive));
      }
    });

    window.addEventListener('satset_packages_updated', handlePackageUpdate);
    window.addEventListener('storage', handlePackageUpdate);

    return () => {
      unsubscribeSSE();
      window.removeEventListener('satset_packages_updated', handlePackageUpdate);
      window.removeEventListener('storage', handlePackageUpdate);
    };
  }, []);

  const handleCopyCode = () => {
    if (!session?.code) return;
    navigator.clipboard.writeText(session.code);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
    setViewState('checkout');
  };

  const handleOpenStatus = (trxId?: string) => {
    if (trxId) setStatusTrxId(trxId);
    setViewState('status');
  };

  const handleConsultPlanWhatsApp = (planName: string, price: number) => {
    const cfg = getContactSettings();
    const customMessage = `Halo Admin Tools Satset, saya tertarik untuk berlangganan Paket *${planName}* (${formatRupiah(price)}). Boleh minta info dan panduan pembayarannya?`;
    const waUrl = getWhatsAppUrl({ ...cfg, whatsappTemplate: customMessage });
    window.open(waUrl, '_blank');
  };

  const displayPackages = packages.filter((p) => {
    // For logged-in User UI / Member eligible, strictly show member packages by default
    if (isMemberEligible) {
      if (activeCategoryFilter === 'public') return (p.targetCategory || 'public') === 'public';
      if (activeCategoryFilter === 'all') return true;
      return p.targetCategory === 'member';
    }
    // Public View (calon pembeli / login page)
    return (p.targetCategory || 'public') === 'public';
  });

  if (viewState === 'checkout') {
    return (
      <CheckoutWizardView
        selectedPlanId={selectedPlanId}
        onBackToPlans={() => setViewState('plans')}
        onOpenStatusCheck={handleOpenStatus}
        onSuccessLogin={onSuccessLogin}
      />
    );
  }

  if (viewState === 'status') {
    return (
      <TransactionStatusView
        initialTrxId={statusTrxId}
        onBackToPlans={() => setViewState('plans')}
        onSuccessLogin={onSuccessLogin}
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="max-w-5xl mx-auto space-y-8 pb-12 font-sans text-slate-800"
    >
      {/* Page Title & Status Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
              Paket & Akses Tools Satset
            </h1>
            {isSyncing && (
              <RefreshCw className="w-3.5 h-3.5 text-indigo-500 animate-spin" title="Menyinkronkan data paket terkini..." />
            )}
          </div>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Pilih paket berlangganan untuk mengaktifkan AI Creator Workspace tanpa batasan kuota.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap self-start md:self-auto">
          {onBackToLogin && (
            <button
              type="button"
              onClick={onBackToLogin}
              className="px-4 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all flex items-center gap-2 cursor-pointer shadow-2xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Halaman Login</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => handleOpenStatus()}
            className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-50 text-slate-800 text-xs font-bold border border-slate-200 transition-colors flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <Search className="w-4 h-4 text-[#3525cd]" />
            <span>Cek Status Transaksi 🔍</span>
          </button>
        </div>
      </div>

      {/* Active User Session Banner */}
      {session && (
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#3525cd] shrink-0">
              <Award className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <span>Status Akses:</span>
                  <span className="font-mono text-[#3525cd] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">
                    {maskAccessCode(session.code)}
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="p-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 transition-colors cursor-pointer"
                    title="Salin Kode Akses"
                  >
                    {copiedCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-black tracking-wider uppercase">
                  AKTIF
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Peran: <strong className="capitalize">{session.role}</strong> • Akses penuh ke semua fitur AI tanpa batasan kuota harian.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 3 PRICING CARDS GRID */}
      <div>
        <div className="text-center max-w-xl mx-auto mb-6 space-y-3">
          <span className="px-3 py-1 rounded-full bg-indigo-50 text-[#3525cd] text-xs font-black uppercase tracking-wider border border-indigo-100">
            {isMemberEligible ? 'PILIHAN PAKET KHUSUS MEMBER VIP 👑' : 'PILIHAN PAKET LISENSI'}
          </span>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight">
            {isMemberEligible ? 'Pilih Paket Perpanjangan & Upgrade Member' : 'Pilih Paket Sesuai Kebutuhan Anda'}
          </h2>
          <p className="text-xs text-slate-500">
            {isMemberEligible
              ? 'Penawaran harga spesial perpanjangan & upgrade lisensi untuk member terdaftar Satset AI.'
              : 'Proses otomatis dengan QRIS (BCA, Mandiri, GoPay, OVO, ShopeePay, Dana). Dapatkan Kode Akses dalam hitungan detik.'}
          </p>

          {/* Category Filter Tabs (Only shown for eligible members) */}
          {isMemberEligible && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('member')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeCategoryFilter === 'member'
                    ? 'bg-[#3525cd] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Khusus Member VIP 👑
              </button>
              <button
                type="button"
                onClick={() => setActiveCategoryFilter('all')}
                className={`px-4 py-1.5 rounded-full text-xs font-bold transition-all cursor-pointer ${
                  activeCategoryFilter === 'all'
                    ? 'bg-[#3525cd] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Semua Paket
              </button>
            </div>
          )}
        </div>

        {displayPackages.length === 0 ? (
          <div className="p-8 rounded-2xl bg-white border border-slate-200 text-center space-y-4 max-w-lg mx-auto shadow-sm">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 mx-auto">
              <Zap className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">Belum Ada Paket Aktif</h3>
              <p className="text-xs text-slate-500 mt-1">
                Admin saat ini sedang memperbarui opsi lisensi. Silakan hubungi dukungan pelanggan melalui WhatsApp untuk pendaftaran langsung.
              </p>
            </div>
            <button
              type="button"
              onClick={() => window.open(getWhatsAppUrl(), '_blank')}
              className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition-colors flex items-center justify-center gap-2 mx-auto shadow-sm cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Hubungi Admin via WhatsApp</span>
            </button>
          </div>
        ) : (
          <div className={
            displayPackages.length === 1
              ? 'flex justify-center'
              : displayPackages.length === 2
              ? 'grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto items-stretch'
              : 'grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch'
          }>
            {displayPackages.map((plan) => {
              const isPopular = plan.isPopular;
              return (
                <div
                  key={plan.id}
                  className={`rounded-2xl p-6 transition-all flex flex-col justify-between space-y-6 relative ${
                    displayPackages.length === 1 ? 'w-full max-w-md' : ''
                  } ${
                    isPopular
                      ? 'bg-gradient-to-b from-slate-900 to-indigo-950 text-white border-2 border-[#3525cd] shadow-xl transform scale-102'
                      : 'bg-white border border-slate-200 text-slate-800 shadow-sm hover:shadow-md'
                  }`}
                >
                  {plan.badgeLabel && (
                    <div className={`absolute -top-3.5 left-1/2 -translate-x-1/2 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-md flex items-center gap-1 ${
                      isPopular ? 'bg-[#3525cd] text-white' : 'bg-amber-400 text-slate-950'
                    }`}>
                      {isPopular && <Star className="w-3 h-3 text-amber-300 fill-amber-300" />}
                      <span>{plan.badgeLabel}</span>
                    </div>
                  )}

                  <div className="space-y-4 pt-2">
                    <div className="space-y-1">
                      <span className={`text-xs font-bold uppercase tracking-wider ${isPopular ? 'text-indigo-300' : 'text-slate-500'}`}>
                        {plan.durationDays >= 365 ? 'Paket Lifetime / Lanjutan' : `Akses ${plan.durationDays} Hari`}
                      </span>
                      <h3 className={`text-xl font-extrabold ${isPopular ? 'text-white' : 'text-slate-900'}`}>{plan.name}</h3>
                      <p className={`text-xs ${isPopular ? 'text-indigo-200/80' : 'text-slate-500'}`}>{plan.tagline || 'Paket pilihan untuk akselerasi konten.'}</p>
                    </div>

                    <div className="pt-2">
                      <span className={`text-3xl font-black ${isPopular ? 'text-amber-300' : 'text-slate-900'}`}>
                        {formatRupiah(plan.price)}
                      </span>
                      <span className={`text-xs font-medium ${isPopular ? 'text-indigo-200' : 'text-slate-400'}`}>
                        {' '}/ {plan.durationDays} hari
                      </span>
                    </div>

                    <div className={`pt-4 border-t space-y-2 text-xs ${
                      isPopular ? 'border-indigo-900/80 text-slate-200' : 'border-slate-100 text-slate-700'
                    }`}>
                      {(plan.features || []).map((feat, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <Check className={`w-4 h-4 shrink-0 ${isPopular ? 'text-amber-300' : 'text-emerald-600'}`} />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <button
                      type="button"
                      onClick={() => handleSelectPlan(plan.id)}
                      className={`w-full py-3 px-4 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 cursor-pointer ${
                        isPopular
                          ? 'bg-[#3525cd] hover:bg-[#2c1eb3] text-white font-black shadow-lg shadow-indigo-900/50'
                          : 'bg-slate-900 hover:bg-slate-800 text-white shadow-2xs'
                      }`}
                    >
                      <span>Pilih {plan.name}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={() => handleConsultPlanWhatsApp(plan.name, plan.price)}
                      className={`w-full py-2 px-3 rounded-lg text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer ${
                        isPopular
                          ? 'text-indigo-200 hover:text-white hover:bg-white/10'
                          : 'text-slate-500 hover:text-emerald-700 hover:bg-emerald-50'
                      }`}
                      title="Tanya Admin mengenai paket ini via WhatsApp"
                    >
                      <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Tanya Admin via WA</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
}


import React, { useState, useEffect, useMemo } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  Check, 
  Sparkles, 
  Eye, 
  ShieldCheck, 
  X, 
  ToggleLeft, 
  ToggleRight, 
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  Search,
  Tag,
  Clock,
  Layers,
  CheckCircle2,
  Sliders,
  MoveUp,
  MoveDown,
  RotateCcw
} from 'lucide-react';
import DataTable from '../../components/admin/DataTable';
import { 
  getPackages, 
  savePackageAsync, 
  deletePackageAsync, 
  togglePackageActiveAsync, 
  syncPackagesAsync,
  resetDefaultPackagesAsync,
  PackageItem,
  DEFAULT_PACKAGES
} from '../../lib/admin/packages';
import { formatRupiah } from '../../lib/payment';

const FEATURE_PRESETS = [
  'Akses 5 Tool AI Satset',
  'Generator Prompt Video 8K',
  'Generator Prompt Foto Ultra HD',
  'Video Frame Extractor',
  'TikTok Downloader No Watermark',
  'Bypass Kuota & Anti Limit Level 1',
  'Bypass Kuota VIP & Anti Limit Max',
  'Prioritas Server Kecepatan Tinggi',
  'Format Export JSON & TXT',
  'Server Dedicated AI Engine',
  'Grup Komunitas Exclusive VIP',
  'Lisensi Komersial Konten Kreator',
  'Dukungan Admin Fast Response'
];

export default function PackagePricingPanel() {
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [feedbackToast, setFeedbackToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<'all' | 'public' | 'member' | 'active'>('all');

  // Modal States
  const [editingPackage, setEditingPackage] = useState<PackageItem | null>(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [packageToDelete, setPackageToDelete] = useState<PackageItem | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  // Form State
  const [formId, setFormId] = useState('');
  const [formName, setFormName] = useState('');
  const [formTagline, setFormTagline] = useState('');
  const [formPrice, setFormPrice] = useState<number>(49000);
  const [formDurationDays, setFormDurationDays] = useState<number>(30);
  const [formBadgeLabel, setFormBadgeLabel] = useState('');
  const [formIsPopular, setFormIsPopular] = useState(false);
  const [formIsActive, setFormIsActive] = useState(true);
  const [formTargetCategory, setFormTargetCategory] = useState<'public' | 'member'>('public');
  const [formFeatures, setFormFeatures] = useState<string[]>([]);
  const [newFeatureInput, setNewFeatureInput] = useState('');

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setFeedbackToast({ message, type });
    setTimeout(() => {
      setFeedbackToast(null);
    }, 3500);
  };

  const loadPackages = async () => {
    const pkgs = getPackages();
    setPackages(pkgs);
  };

  const handleSyncRefresh = async () => {
    setIsLoading(true);
    try {
      const res = await syncPackagesAsync();
      if (res.success && res.packages) {
        setPackages(res.packages);
        showToast('Data paket berhasil disinkronkan dari database!');
      }
    } catch (err) {
      showToast('Gagal menyinkronkan paket', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPackages();
    handleSyncRefresh();

    const handleUpdateEvent = () => {
      loadPackages();
    };

    window.addEventListener('satset_packages_updated', handleUpdateEvent);
    window.addEventListener('storage', handleUpdateEvent);

    return () => {
      window.removeEventListener('satset_packages_updated', handleUpdateEvent);
      window.removeEventListener('storage', handleUpdateEvent);
    };
  }, []);

  // Filtered packages
  const filteredPackages = useMemo(() => {
    return packages.filter((pkg) => {
      // Search filter
      const matchesSearch = 
        !searchQuery.trim() ||
        pkg.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (pkg.tagline && pkg.tagline.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (pkg.features && pkg.features.some(f => f.toLowerCase().includes(searchQuery.toLowerCase())));

      if (!matchesSearch) return false;

      // Category / Status Filter
      if (categoryFilter === 'public') return (pkg.targetCategory || 'public') === 'public';
      if (categoryFilter === 'member') return pkg.targetCategory === 'member';
      if (categoryFilter === 'active') return pkg.isActive;
      return true;
    });
  }, [packages, searchQuery, categoryFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: packages.length,
      active: packages.filter(p => p.isActive).length,
      publicCount: packages.filter(p => (p.targetCategory || 'public') === 'public').length,
      memberCount: packages.filter(p => p.targetCategory === 'member').length,
    };
  }, [packages]);

  const handleOpenCreate = () => {
    setEditingPackage(null);
    setIsCreatingNew(true);
    const newId = `pkg_${Date.now()}`;
    setFormId(newId);
    setFormName('');
    setFormTagline('');
    setFormPrice(99000);
    setFormDurationDays(30);
    setFormBadgeLabel('Hot Deal');
    setFormIsPopular(false);
    setFormIsActive(true);
    setFormTargetCategory('public');
    setFormFeatures([
      'Akses 5 Tool AI Satset',
      'Generator Prompt Video 8K',
      'Generator Prompt Foto Ultra HD',
      'Bypass Kuota VIP & Anti Limit Max',
      'Dukungan Admin Fast Response'
    ]);
    setNewFeatureInput('');
  };

  const handleOpenEdit = (pkg: PackageItem) => {
    setIsCreatingNew(false);
    setEditingPackage(pkg);
    setFormId(pkg.id);
    setFormName(pkg.name);
    setFormTagline(pkg.tagline || '');
    setFormPrice(pkg.price);
    setFormDurationDays(pkg.durationDays);
    setFormBadgeLabel(pkg.badgeLabel || '');
    setFormIsPopular(Boolean(pkg.isPopular));
    setFormIsActive(pkg.isActive);
    setFormTargetCategory(pkg.targetCategory || 'public');
    setFormFeatures(Array.isArray(pkg.features) ? [...pkg.features] : []);
    setNewFeatureInput('');
  };

  const handleAddFeature = (featToAdd?: string) => {
    const feat = (featToAdd !== undefined ? featToAdd : newFeatureInput).trim();
    if (feat) {
      if (!formFeatures.includes(feat)) {
        setFormFeatures([...formFeatures, feat]);
      }
      setNewFeatureInput('');
    }
  };

  const handleRemoveFeature = (index: number) => {
    setFormFeatures(formFeatures.filter((_, idx) => idx !== index));
  };

  const handleMoveFeature = (index: number, direction: 'up' | 'down') => {
    if (direction === 'up' && index > 0) {
      const updated = [...formFeatures];
      const temp = updated[index - 1];
      updated[index - 1] = updated[index];
      updated[index] = temp;
      setFormFeatures(updated);
    } else if (direction === 'down' && index < formFeatures.length - 1) {
      const updated = [...formFeatures];
      const temp = updated[index + 1];
      updated[index + 1] = updated[index];
      updated[index] = temp;
      setFormFeatures(updated);
    }
  };

  const handleSaveForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      showToast('Mohon isi nama paket.', 'error');
      return;
    }

    if (formPrice < 0) {
      showToast('Harga paket tidak boleh bernilai negatif.', 'error');
      return;
    }

    if (formDurationDays <= 0) {
      showToast('Durasi paket harus minimal 1 hari.', 'error');
      return;
    }

    setIsSaving(true);
    const finalId = formId.trim() || (editingPackage ? editingPackage.id : `pkg_${Date.now()}`);

    const pkgItem: PackageItem = {
      id: finalId,
      name: formName.trim(),
      tagline: formTagline.trim(),
      price: Number(formPrice) || 0,
      durationDays: Number(formDurationDays) || 1,
      features: formFeatures.filter(Boolean),
      badgeLabel: formBadgeLabel.trim(),
      isPopular: formIsPopular,
      isActive: formIsActive,
      targetCategory: formTargetCategory
    };

    try {
      await savePackageAsync(pkgItem);
      showToast(`Paket "${pkgItem.name}" berhasil disimpan!`);
      setEditingPackage(null);
      setIsCreatingNew(false);
      loadPackages();
    } catch (err: any) {
      showToast(err?.message || 'Gagal menyimpan paket.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (pkg: PackageItem) => {
    try {
      await togglePackageActiveAsync(pkg.id);
      showToast(`Status paket "${pkg.name}" diubah menjadi ${!pkg.isActive ? 'Aktif' : 'Nonaktif'}.`);
      loadPackages();
    } catch (err) {
      showToast('Gagal mengubah status paket.', 'error');
    }
  };

  const handleConfirmDelete = async () => {
    if (!packageToDelete) return;
    setIsSaving(true);
    try {
      await deletePackageAsync(packageToDelete.id);
      showToast(`Paket "${packageToDelete.name}" berhasil dihapus.`);
      setPackageToDelete(null);
      loadPackages();
    } catch (err) {
      showToast('Gagal menghapus paket.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDefaults = async () => {
    setIsSaving(true);
    try {
      await resetDefaultPackagesAsync();
      showToast('Semua paket berhasil dikembalikan ke pengaturan default!');
      setShowResetConfirm(false);
      loadPackages();
    } catch (err) {
      showToast('Gagal mereset paket.', 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const columns = [
    {
      header: 'NAMA PAKET & TAGLINE',
      render: (pkg: PackageItem) => (
        <div className="space-y-1 py-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-extrabold text-slate-900 text-sm">{pkg.name}</span>
            {pkg.badgeLabel && (
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-extrabold uppercase tracking-wide border border-amber-200">
                {pkg.badgeLabel}
              </span>
            )}
            {pkg.isPopular && (
              <span className="px-2 py-0.5 rounded-full bg-[#3525cd] text-white text-[10px] font-extrabold uppercase tracking-wide shadow-2xs">
                POPULEER
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 max-w-sm line-clamp-2">{pkg.tagline || 'Tanpa deskripsi'}</p>
        </div>
      )
    },
    {
      header: 'HARGA & DURASI',
      render: (pkg: PackageItem) => (
        <div className="space-y-0.5">
          <div className="font-black text-[#3525cd] text-sm tracking-tight">{formatRupiah(pkg.price)}</div>
          <div className="text-xs text-slate-600 font-medium flex items-center gap-1">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>{pkg.durationDays >= 3650 ? 'Akses Seumur Hidup (Lifetime)' : `${pkg.durationDays} Hari Akses`}</span>
          </div>
        </div>
      )
    },
    {
      header: 'JUMLAH FITUR',
      render: (pkg: PackageItem) => (
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <Layers className="w-4 h-4 text-indigo-500" />
          <span>{(pkg.features || []).length} Fitur</span>
        </div>
      )
    },
    {
      header: 'TARGET KATEGORI',
      render: (pkg: PackageItem) => (
        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border inline-flex items-center gap-1 ${
          pkg.targetCategory === 'member'
            ? 'bg-purple-50 text-purple-700 border-purple-200'
            : 'bg-blue-50 text-blue-700 border-blue-200'
        }`}>
          <Tag className="w-3 h-3" />
          <span>{pkg.targetCategory === 'member' ? 'MEMBER VIP' : 'PUBLIC'}</span>
        </span>
      )
    },
    {
      header: 'STATUS',
      render: (pkg: PackageItem) => (
        <button
          type="button"
          onClick={() => handleToggleActive(pkg)}
          title="Klik untuk mengubah status aktif"
          className={`px-3 py-1.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 cursor-pointer border transition-all shadow-2xs ${
            pkg.isActive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
              : 'bg-slate-100 text-slate-500 border-slate-300 hover:bg-slate-200'
          }`}
        >
          {pkg.isActive ? <ToggleRight className="w-4 h-4 text-emerald-600" /> : <ToggleLeft className="w-4 h-4 text-slate-400" />}
          <span>{pkg.isActive ? 'AKTIF' : 'NONAKTIF'}</span>
        </button>
      )
    },
    {
      header: 'AKSI',
      render: (pkg: PackageItem) => (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => handleOpenEdit(pkg)}
            className="px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer border border-indigo-200 shadow-2xs"
            title="Edit Paket"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>

          <button
            type="button"
            onClick={() => setPackageToDelete(pkg)}
            className="p-1.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 border border-rose-200 transition-colors cursor-pointer shadow-2xs"
            title="Hapus Paket"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedbackToast && (
        <div className={`fixed top-5 right-5 z-50 px-4 py-3 rounded-2xl shadow-xl border flex items-center gap-2.5 text-xs font-bold transition-all animate-in fade-in slide-in-from-top-4 duration-200 ${
          feedbackToast.type === 'success' 
            ? 'bg-emerald-950 text-emerald-100 border-emerald-700' 
            : 'bg-rose-950 text-rose-100 border-rose-700'
        }`}>
          {feedbackToast.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />}
          <span>{feedbackToast.message}</span>
        </div>
      )}

      {/* Top Stats Overview Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Total Paket</div>
          <div className="text-2xl font-black text-slate-900">{stats.total}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-emerald-600 uppercase tracking-wider">Paket Aktif</div>
          <div className="text-2xl font-black text-emerald-600">{stats.active}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-blue-600 uppercase tracking-wider">Paket Public</div>
          <div className="text-2xl font-black text-blue-600">{stats.publicCount}</div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-1">
          <div className="text-[11px] font-bold text-purple-600 uppercase tracking-wider">Paket Member VIP</div>
          <div className="text-2xl font-black text-purple-600">{stats.memberCount}</div>
        </div>
      </div>

      {/* Main Filter & Action Bar */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Bar */}
        <div className="relative w-full md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Cari nama paket / fitur..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-slate-50 rounded-xl border border-slate-200 text-xs font-medium text-slate-800 focus:outline-none focus:border-[#3525cd] focus:bg-white transition-all"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 flex-wrap w-full md:w-auto">
          <button
            type="button"
            onClick={() => setCategoryFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              categoryFilter === 'all'
                ? 'bg-[#3525cd] text-white shadow-2xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({packages.length})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('public')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              categoryFilter === 'public'
                ? 'bg-blue-600 text-white shadow-2xs'
                : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
            }`}
          >
            Public ({stats.publicCount})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('member')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              categoryFilter === 'member'
                ? 'bg-purple-600 text-white shadow-2xs'
                : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
            }`}
          >
            Member VIP ({stats.memberCount})
          </button>
          <button
            type="button"
            onClick={() => setCategoryFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              categoryFilter === 'active'
                ? 'bg-emerald-600 text-white shadow-2xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Aktif ({stats.active})
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-end">
          <button
            type="button"
            onClick={handleSyncRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer disabled:opacity-50"
            title="Sinkronkan Ulang Data Paket"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#3525cd]' : ''}`} />
          </button>

          <button
            type="button"
            onClick={() => setShowResetConfirm(true)}
            className="p-2 rounded-xl bg-slate-100 hover:bg-amber-100 text-slate-600 hover:text-amber-700 text-xs font-bold transition-all cursor-pointer"
            title="Kembalikan Paket ke Standar Awal (Default)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-2xs cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Tambah Paket Baru</span>
          </button>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        title="Manajemen Paket & Harga"
        subtitle="Atur daftar paket berlangganan, ubah harga, durasi, dan fitur secara dinamis."
        columns={columns}
        data={filteredPackages}
        emptyMessage={
          searchQuery
            ? `Tidak ada paket yang cocok dengan pencarian "${searchQuery}".`
            : 'Belum ada paket yang tersimpan.'
        }
      />

      {/* EDIT / CREATE FORM MODAL WITH LIVE PREVIEW */}
      {(isCreatingNew || editingPackage) && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-5xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 my-8 max-h-[92vh] flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-4 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 text-[#3525cd] flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-[#3525cd]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isCreatingNew ? 'Buat Paket Akses Baru' : `Edit Paket "${editingPackage?.name}"`}
                  </h3>
                  <p className="text-xs text-slate-500">
                    Data paket akan langsung tersinkronisasi ke Firestore & halaman checkout pelanggan.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsCreatingNew(false);
                  setEditingPackage(null);
                }}
                className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 overflow-y-auto pr-1">
              {/* Left Column: Form Inputs (7 cols) */}
              <form onSubmit={handleSaveForm} className="lg:col-span-7 space-y-4">
                {/* Identifier Slug */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">
                      ID Paket (Kode Unik)
                    </label>
                    <input
                      type="text"
                      value={formId}
                      onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                      placeholder="misal: bulanan / pro_vip"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-mono font-bold text-slate-900 focus:outline-none focus:border-[#3525cd] bg-slate-50"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Target Kategori Paket</label>
                    <select
                      value={formTargetCategory}
                      onChange={(e) => setFormTargetCategory(e.target.value as 'public' | 'member')}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd] bg-white cursor-pointer"
                    >
                      <option value="public">Public (Calon Pembeli)</option>
                      <option value="member">Member VIP (Khusus Member Terdaftar)</option>
                    </select>
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Nama Paket</label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="misal: Akses Bulanan (VIP)"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                    required
                  />
                </div>

                {/* Tagline */}
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">Tagline / Deskripsi Singkat</label>
                  <input
                    type="text"
                    value={formTagline}
                    onChange={(e) => setFormTagline(e.target.value)}
                    placeholder="misal: Pilihan favorit kreator konten & agensi digital"
                    className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                  />
                </div>

                {/* Price & Duration */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-bold text-slate-700">Harga (Rp)</label>
                      <span className="text-[11px] font-black text-[#3525cd]">{formatRupiah(formPrice || 0)}</span>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="1000"
                      value={formPrice}
                      onChange={(e) => setFormPrice(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Durasi (Hari Akses)</label>
                    <input
                      type="number"
                      min="1"
                      value={formDurationDays}
                      onChange={(e) => setFormDurationDays(Number(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:outline-none focus:border-[#3525cd]"
                      required
                    />
                  </div>
                </div>

                {/* Quick Duration Buttons */}
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Preset Durasi Cepat:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                      { label: '7 Hari', days: 7 },
                      { label: '14 Hari', days: 14 },
                      { label: '30 Hari', days: 30 },
                      { label: '90 Hari', days: 90 },
                      { label: '365 Hari (1 Thn)', days: 365 },
                      { label: 'Lifetime (36500 Hari)', days: 36500 },
                    ].map((preset) => (
                      <button
                        key={preset.days}
                        type="button"
                        onClick={() => setFormDurationDays(preset.days)}
                        className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all cursor-pointer ${
                          formDurationDays === preset.days
                            ? 'bg-[#3525cd] text-white shadow-2xs'
                            : 'bg-slate-100 hover:bg-slate-200 text-slate-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Badge Label & Flags */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <label className="text-xs font-bold text-slate-700 block mb-1">Badge Label (Pill Khusus)</label>
                    <input
                      type="text"
                      value={formBadgeLabel}
                      onChange={(e) => setFormBadgeLabel(e.target.value)}
                      placeholder="misal: Paling Populer / Hemat 50%"
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 text-xs text-slate-800 focus:outline-none focus:border-[#3525cd]"
                    />
                  </div>

                  <div className="flex flex-col justify-center space-y-2 pt-2">
                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsPopular}
                        onChange={(e) => setFormIsPopular(e.target.checked)}
                        className="w-4 h-4 rounded text-[#3525cd] focus:ring-0 cursor-pointer"
                      />
                      <span>Highlight Paling Populer</span>
                    </label>

                    <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formIsActive}
                        onChange={(e) => setFormIsActive(e.target.checked)}
                        className="w-4 h-4 rounded text-[#3525cd] focus:ring-0 cursor-pointer"
                      />
                      <span className={formIsActive ? 'text-emerald-700 font-bold' : 'text-slate-500'}>
                        Status Aktif {formIsActive ? '(Ditampilkan)' : '(Disembunyikan)'}
                      </span>
                    </label>
                  </div>
                </div>

                {/* Features List Section */}
                <div className="space-y-2 pt-2 border-t border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800">
                      Daftar Fitur Paket ({formFeatures.length})
                    </label>
                    <span className="text-[10px] text-slate-400">Gunakan panah untuk mengubah urutan</span>
                  </div>

                  {/* Feature items */}
                  <div className="space-y-1.5 max-h-48 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-2xl">
                    {formFeatures.length === 0 ? (
                      <p className="text-xs text-slate-400 text-center py-3 italic">
                        Belum ada fitur ditambahkan ke paket ini.
                      </p>
                    ) : (
                      formFeatures.map((feat, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-2 p-2 bg-white rounded-xl border border-slate-200 text-xs shadow-2xs hover:border-slate-300 transition-colors"
                        >
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="w-5 h-5 rounded-full bg-indigo-50 text-[#3525cd] text-[10px] font-black flex items-center justify-center shrink-0">
                              {idx + 1}
                            </span>
                            <span className="text-slate-800 font-medium truncate">{feat}</span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveFeature(idx, 'up')}
                              disabled={idx === 0}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              title="Pindah ke Atas"
                            >
                              <MoveUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveFeature(idx, 'down')}
                              disabled={idx === formFeatures.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-700 disabled:opacity-30 cursor-pointer"
                              title="Pindah ke Bawah"
                            >
                              <MoveDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveFeature(idx)}
                              className="p-1 text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-md cursor-pointer"
                              title="Hapus Fitur"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Feature Input */}
                  <div className="flex items-center gap-2 pt-1">
                    <input
                      type="text"
                      value={newFeatureInput}
                      onChange={(e) => setNewFeatureInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddFeature();
                        }
                      }}
                      placeholder="Ketik poin fitur baru..."
                      className="flex-1 px-3 py-2 rounded-xl border border-slate-200 text-xs focus:outline-none focus:border-[#3525cd] bg-white"
                    />
                    <button
                      type="button"
                      onClick={() => handleAddFeature()}
                      className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer transition-colors shrink-0 shadow-2xs"
                    >
                      + Tambah Fitur
                    </button>
                  </div>

                  {/* Preset Suggestions */}
                  <div className="space-y-1 pt-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      Preset Fitur AI Satset Populer (Klik untuk tambah):
                    </span>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {FEATURE_PRESETS.filter(f => !formFeatures.includes(f)).slice(0, 5).map((preset, pIdx) => (
                        <button
                          key={pIdx}
                          type="button"
                          onClick={() => handleAddFeature(preset)}
                          className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#3525cd] text-[10px] font-bold transition-all cursor-pointer border border-indigo-100"
                        >
                          + {preset}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Form Actions */}
                <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreatingNew(false);
                      setEditingPackage(null);
                    }}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-6 py-2.5 rounded-xl bg-[#3525cd] hover:bg-[#2c1eb3] text-white text-xs font-bold shadow-xs cursor-pointer transition-all disabled:opacity-50 flex items-center gap-2"
                  >
                    {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>{isSaving ? 'Menyimpan...' : 'Simpan Paket'}</span>
                  </button>
                </div>
              </form>

              {/* Right Column: Live Card Preview (5 cols) */}
              <div className="lg:col-span-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-bold text-slate-500 uppercase tracking-wider">
                  <div className="flex items-center gap-1.5">
                    <Eye className="w-4 h-4 text-[#3525cd]" />
                    <span>Live Preview Card</span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                    formTargetCategory === 'member' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                  }`}>
                    {formTargetCategory === 'member' ? 'MEMBER VIEW' : 'PUBLIC VIEW'}
                  </span>
                </div>

                <div className={`p-6 sm:p-7 rounded-3xl border-2 transition-all relative space-y-5 bg-white ${
                  formIsPopular 
                    ? 'border-[#3525cd] shadow-xl ring-4 ring-indigo-50/50' 
                    : 'border-slate-200 shadow-sm'
                }`}>
                  {/* Badge */}
                  {formBadgeLabel && (
                    <div className="absolute -top-3.5 left-6 px-3.5 py-1 rounded-full bg-gradient-to-r from-amber-400 to-amber-500 text-slate-950 font-black text-[10px] uppercase tracking-wider shadow-sm">
                      {formBadgeLabel}
                    </div>
                  )}

                  {/* Header Title & Tagline */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xl font-black text-slate-900 tracking-tight">
                        {formName || 'Nama Paket Akses'}
                      </h4>
                      {formIsPopular && (
                        <span className="px-2.5 py-0.5 rounded-full bg-[#3525cd] text-white font-extrabold text-[9px] uppercase tracking-wider">
                          Populer
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 min-h-[36px] leading-relaxed">
                      {formTagline || 'Deskripsi singkat keunggulan paket bagi pengguna.'}
                    </p>
                  </div>

                  {/* Price Block */}
                  <div className="flex items-baseline gap-1.5 border-y border-slate-100 py-3.5">
                    <span className="text-2xl sm:text-3xl font-black text-[#3525cd] tracking-tight">
                      {formatRupiah(formPrice || 0)}
                    </span>
                    <span className="text-xs text-slate-500 font-bold">
                      / {formDurationDays >= 3650 ? 'Lifetime' : `${formDurationDays} Hari`}
                    </span>
                  </div>

                  {/* Feature Bullets */}
                  <div className="space-y-2.5">
                    <div className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                      Termasuk Fitur Unggulan:
                    </div>
                    <ul className="space-y-2 text-xs text-slate-700">
                      {formFeatures.length === 0 ? (
                        <li className="text-slate-400 italic">Belum ada fitur dimasukkan.</li>
                      ) : (
                        formFeatures.map((f, i) => (
                          <li key={i} className="flex items-start gap-2">
                            <div className="w-4 h-4 rounded-full bg-indigo-50 text-[#3525cd] flex items-center justify-center text-[10px] shrink-0 font-bold mt-0.5">
                              ✓
                            </div>
                            <span className="leading-tight">{f}</span>
                          </li>
                        ))
                      )}
                    </ul>
                  </div>

                  {/* Action CTA Button */}
                  <button
                    type="button"
                    disabled
                    className="w-full py-3 rounded-2xl bg-[#3525cd] text-white font-black text-xs flex items-center justify-center gap-2 shadow-sm opacity-95 cursor-not-allowed"
                  >
                    <span>Pilih Paket Ini</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL */}
      {packageToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Konfirmasi Hapus Paket</h3>
                <p className="text-xs text-slate-500">Tindakan ini tidak dapat dibatalkan.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              Apakah Anda yakin ingin menghapus paket <span className="font-bold text-slate-900">"{packageToDelete.name}"</span>? Menghapus paket ini akan menghapusnya dari daftar pilihan checkout pelanggan.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setPackageToDelete(null)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-2 shadow-2xs"
              >
                {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? 'Menghapus...' : 'Hapus Paket'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESET DEFAULT CONFIRMATION MODAL */}
      {showResetConfirm && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="w-10 h-10 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <RotateCcw className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold text-slate-900">Reset ke Paket Default</h3>
                <p className="text-xs text-slate-500">Pulihkan 4 paket bawaan sistem.</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
              Tindakan ini akan mengembalikan daftar paket ke konfigurasi default (Akses Mingguan, Bulanan VIP, Ultra VIP Lifetime, dan Perpanjang Member).
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                disabled={isSaving}
                className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleResetDefaults}
                disabled={isSaving}
                className="px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold cursor-pointer transition-all flex items-center gap-2 shadow-2xs"
              >
                {isSaving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>{isSaving ? 'Memproses...' : 'Reset Sekarang'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

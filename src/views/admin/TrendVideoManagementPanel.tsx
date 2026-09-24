import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  Edit2, 
  X, 
  Save, 
  Link as LinkIcon,
  Eye,
  EyeOff,
  Loader2,
  Globe,
  Search,
  Filter,
  RotateCcw,
  TrendingUp,
  Sparkles,
  CheckCircle2,
  AlertTriangle,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Layers,
  Flame,
  Check
} from 'lucide-react';
import { 
  TrendVideo, 
  TREND_CATEGORIES, 
  TREND_COUNTRIES,
  getCountryInfo,
  subscribeTrendVideos, 
  addTrendVideo, 
  updateTrendVideo, 
  softDeleteTrendVideo,
  hardDeleteTrendVideo,
  fetchTikTokMeta
} from '../../lib/trendVideos';

export default function TrendVideoManagementPanel() {
  const [videos, setVideos] = useState<TrendVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Live Meta Fetcher State
  const [fetchingMeta, setFetchingMeta] = useState(false);
  const [liveMetaPreview, setLiveMetaPreview] = useState<{
    title: string;
    thumbnailUrl: string;
    viewCount: string;
    likeCount: string;
    author?: string;
  } | null>(null);

  // Form state
  const [form, setForm] = useState({
    tiktokUrl: '',
    category: TREND_CATEGORIES[0] as string,
    country: 'ID'
  });

  // Filter states
  const [selectedCountry, setSelectedCountry] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<'ALL' | 'active' | 'inactive'>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal State for Deletion / Revoke
  const [videoToDelete, setVideoToDelete] = useState<TrendVideo | null>(null);
  const [deleteMode, setDeleteMode] = useState<'soft' | 'hard'>('soft');

  // Floating Toast Notification State
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  useEffect(() => {
    const unsubscribe = subscribeTrendVideos((data) => {
      setVideos(data);
      setLoading(false);
    }, false); // false = load all including inactive

    return () => unsubscribe();
  }, []);

  const resetForm = () => {
    setForm({
      tiktokUrl: '',
      category: TREND_CATEGORIES[0],
      country: 'ID'
    });
    setEditingId(null);
    setLiveMetaPreview(null);
  };

  const validLinks = useMemo(() => {
    return form.tiktokUrl
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0 && l.includes('tiktok.com'));
  }, [form.tiktokUrl]);

  // Preview single link metadata
  const handleCheckPreview = async () => {
    const singleLink = form.tiktokUrl.trim().split('\n')[0]?.trim();
    if (!singleLink || !singleLink.includes('tiktok.com')) {
      showToast('Masukkan minimal 1 tautan URL TikTok yang valid untuk melihat pratinjau.', 'error');
      return;
    }

    setFetchingMeta(true);
    try {
      const meta = await fetchTikTokMeta(singleLink);
      if (meta && (meta.title || meta.thumbnailUrl)) {
        setLiveMetaPreview(meta);
        showToast('Metadata video berhasil diambil!', 'success');
      } else {
        showToast('Gagal mengambil metadata otomatis dari TikTok. Video tetap dapat disimpan.', 'info');
      }
    } catch (e: any) {
      showToast('Terjadi kendala jaringan saat memuat data TikTok.', 'error');
    } finally {
      setFetchingMeta(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (editingId) {
      const singleLink = form.tiktokUrl.trim();
      if (!singleLink || !singleLink.includes('tiktok.com')) {
        showToast('Tautan TikTok wajib berupa URL tiktok.com yang valid.', 'error');
        return;
      }

      setSaving(true);
      try {
        const meta = liveMetaPreview || (await fetchTikTokMeta(singleLink));
        await updateTrendVideo(editingId, {
          tiktokUrl: singleLink,
          title: meta?.title || singleLink,
          category: form.category,
          country: form.country,
          thumbnailUrl: meta?.thumbnailUrl || '',
          viewCount: meta?.viewCount || '',
          likeCount: meta?.likeCount || ''
        });
        showToast('Data video berhasil diperbarui!', 'success');
        resetForm();
      } catch (err: any) {
        console.error(err);
        showToast('Gagal mengupdate data video: ' + (err?.message || ''), 'error');
      } finally {
        setSaving(false);
      }
      return;
    }

    // Bulk / Single Add Mode
    if (validLinks.length === 0) {
      showToast('Masukkan minimal 1 link TikTok yang valid (mengandung tiktok.com).', 'error');
      return;
    }

    setSaving(true);
    let successCount = 0;
    let failCount = 0;

    try {
      for (const link of validLinks) {
        try {
          const meta = (validLinks.length === 1 && liveMetaPreview) 
            ? liveMetaPreview 
            : await fetchTikTokMeta(link);

          await addTrendVideo({
            tiktokUrl: link,
            title: meta?.title || link,
            category: form.category,
            country: form.country,
            thumbnailUrl: meta?.thumbnailUrl || '',
            viewCount: meta?.viewCount || '',
            likeCount: meta?.likeCount || ''
          });
          successCount++;
        } catch (err) {
          console.error('Gagal proses link:', link, err);
          failCount++;
        }
      }

      const msg = `Berhasil menambahkan ${successCount} video viral!${failCount > 0 ? ` (${failCount} gagal)` : ''}`;
      showToast(msg, successCount > 0 ? 'success' : 'error');
      resetForm();
    } catch (err: any) {
      console.error(err);
      showToast('Terjadi kesalahan saat menyimpan video: ' + (err?.message || ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (video: TrendVideo) => {
    setEditingId(video.id);
    setForm({
      tiktokUrl: video.tiktokUrl || '',
      category: video.category || TREND_CATEGORIES[0],
      country: video.country || 'ID'
    });
    if (video.thumbnailUrl || video.title) {
      setLiveMetaPreview({
        title: video.title || '',
        thumbnailUrl: video.thumbnailUrl || '',
        viewCount: video.viewCount || '',
        likeCount: video.likeCount || ''
      });
    } else {
      setLiveMetaPreview(null);
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleConfirmDelete = async () => {
    if (!videoToDelete) return;
    try {
      if (deleteMode === 'hard') {
        await hardDeleteTrendVideo(videoToDelete.id);
        showToast('Video berhasil dihapus permanen dari database.', 'success');
      } else {
        await softDeleteTrendVideo(videoToDelete.id);
        showToast('Video berhasil dinonaktifkan (disembunyikan dari user).', 'info');
      }
    } catch (err: any) {
      console.error(err);
      showToast('Gagal memproses penghapusan video: ' + (err?.message || ''), 'error');
    } finally {
      setVideoToDelete(null);
    }
  };

  const handleToggleActive = async (video: TrendVideo) => {
    try {
      const nextState = !video.isActive;
      await updateTrendVideo(video.id, { isActive: nextState });
      showToast(
        nextState 
          ? `Video "${video.title || video.id}" kini aktif dan tampil ke user.` 
          : `Video "${video.title || video.id}" berhasil dinonaktifkan.`,
        nextState ? 'success' : 'info'
      );
    } catch (err: any) {
      console.error(err);
      showToast('Gagal mengubah status video: ' + (err?.message || ''), 'error');
    }
  };

  // Metric counts
  const totalCount = videos.length;
  const activeCount = videos.filter((v) => v.isActive).length;
  const inactiveCount = totalCount - activeCount;

  // Video counts by country
  const countryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    videos.forEach((v) => {
      const c = v.country || 'ID';
      counts[c] = (counts[c] || 0) + 1;
    });
    return counts;
  }, [videos]);

  const uniqueCountryCount = Object.keys(countryCounts).length;

  // Filtered list
  const filteredVideos = useMemo(() => {
    return videos.filter((video) => {
      const countryCode = video.country || 'ID';
      if (selectedCountry !== 'ALL' && countryCode !== selectedCountry) {
        return false;
      }
      if (selectedCategory !== 'ALL' && video.category !== selectedCategory) {
        return false;
      }
      if (selectedStatus === 'active' && !video.isActive) {
        return false;
      }
      if (selectedStatus === 'inactive' && video.isActive) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (video.title || '').toLowerCase().includes(q);
        const matchUrl = (video.tiktokUrl || '').toLowerCase().includes(q);
        const matchCat = (video.category || '').toLowerCase().includes(q);
        if (!matchTitle && !matchUrl && !matchCat) return false;
      }
      return true;
    });
  }, [videos, selectedCountry, selectedCategory, selectedStatus, searchQuery]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedCountry, selectedCategory, selectedStatus, searchQuery, pageSize]);

  // Paginated items
  const totalPages = Math.max(1, Math.ceil(filteredVideos.length / pageSize));
  const paginatedVideos = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredVideos.slice(start, start + pageSize);
  }, [filteredVideos, currentPage, pageSize]);

  const hasActiveFilters = selectedCountry !== 'ALL' || selectedCategory !== 'ALL' || selectedStatus !== 'ALL' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedCountry('ALL');
    setSelectedCategory('ALL');
    setSelectedStatus('ALL');
    setSearchQuery('');
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-8 shadow-2xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-900 flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 text-[#5b50e5] flex items-center justify-center">
                <Flame className="w-5 h-5 text-[#5b50e5]" />
              </div>
              <span>Manajemen Trend Video Viral</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Kurasi video TikTok viral global dan lokal berdasarkan negara serta kategori niche produk. Tautan ini disajikan kepada pengguna untuk ide konten & replika video.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Database Terintegrasi</span>
            </span>
          </div>
        </div>

        {/* Metric Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Total Video
            </span>
            <div className="text-xl font-extrabold text-slate-900 mt-1 flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-[#5b50e5]" />
              <span>{totalCount}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Video Aktif
            </span>
            <div className="text-xl font-extrabold text-emerald-600 mt-1 flex items-center gap-1.5">
              <Eye className="w-4 h-4 text-emerald-600" />
              <span>{activeCount}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Nonaktif / Draft
            </span>
            <div className="text-xl font-extrabold text-slate-500 mt-1 flex items-center gap-1.5">
              <EyeOff className="w-4 h-4 text-slate-400" />
              <span>{inactiveCount}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/70">
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
              Negara Terdaftar
            </span>
            <div className="text-xl font-extrabold text-[#5b50e5] mt-1 flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-[#5b50e5]" />
              <span>{uniqueCountryCount}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Form Tambah / Edit Video */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 sm:p-7 shadow-2xs space-y-5">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h3 className="font-extrabold text-slate-900 text-sm sm:text-base flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#5b50e5]" />
            <span>{editingId ? 'Edit Data Video Trend' : 'Tambah Video Trend TikTok'}</span>
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="text-xs font-bold text-slate-500 hover:text-slate-800 flex items-center gap-1 cursor-pointer px-2 py-1 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X size={14} /> Batal Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Form Inputs (8 cols) */}
          <div className="lg:col-span-8 space-y-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <LinkIcon className="w-3.5 h-3.5 text-[#5b50e5]" />
                  <span>Tautan Video TikTok</span>
                  <span className="text-rose-500">*</span>
                </label>
                {!editingId && (
                  <span className="text-[11px] text-slate-400 font-medium">
                    Mendukung bulk: 1 baris per link
                  </span>
                )}
              </div>

              {editingId ? (
                <input
                  type="url"
                  required
                  value={form.tiktokUrl}
                  onChange={(e) => setForm({ ...form, tiktokUrl: e.target.value })}
                  placeholder="https://www.tiktok.com/@creator/video/..."
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 transition-all"
                />
              ) : (
                <div className="space-y-1.5">
                  <textarea
                    rows={4}
                    required
                    value={form.tiktokUrl}
                    onChange={(e) => setForm({ ...form, tiktokUrl: e.target.value })}
                    placeholder="https://www.tiktok.com/@creator/video/1234567890&#10;https://www.tiktok.com/@creator/video/0987654321"
                    className="w-full p-3.5 rounded-xl border border-slate-200 text-xs font-mono text-slate-900 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 transition-all resize-y"
                  />
                  <div className="flex items-center justify-between text-[11px] text-slate-500">
                    <span>
                      Terdeteksi <strong className="text-[#5b50e5]">{validLinks.length} link</strong> valid
                    </span>
                    {validLinks.length === 1 && (
                      <button
                        type="button"
                        onClick={handleCheckPreview}
                        disabled={fetchingMeta}
                        className="text-[#5b50e5] hover:text-[#4f46e5] font-bold flex items-center gap-1 cursor-pointer"
                      >
                        {fetchingMeta ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Memuat Metadata...</span>
                          </>
                        ) : (
                          <>
                            <Eye className="w-3 h-3" />
                            <span>Cek Pratinjau Metadata</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Category Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5">
                  Kategori Niche Produk <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white cursor-pointer transition-all"
                >
                  {TREND_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Country Selection */}
              <div>
                <label className="text-xs font-bold text-slate-700 block mb-1.5 flex items-center gap-1.5">
                  <Globe size={14} className="text-[#5b50e5]" />
                  <span>Negara / Region Asal</span>
                  <span className="text-rose-500">*</span>
                </label>
                <select
                  value={form.country}
                  onChange={(e) => setForm({ ...form, country: e.target.value })}
                  className="w-full h-11 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white cursor-pointer transition-all"
                >
                  {TREND_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.flag} {c.name} ({c.code})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-bold shadow-xs transition-all cursor-pointer flex items-center gap-2 disabled:opacity-60"
              >
                {saving ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    <span>Menyimpan ke Database...</span>
                  </>
                ) : (
                  <>
                    <Save size={15} />
                    <span>
                      {editingId 
                        ? 'Simpan Perubahan' 
                        : validLinks.length > 1 
                          ? `Tambahkan ${validLinks.length} Video Sekaligus` 
                          : 'Tambahkan Video Trend'}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Right Column: Live Metadata Preview (4 cols) */}
          <div className="lg:col-span-4 bg-slate-50 rounded-2xl border border-slate-200/80 p-4 space-y-3">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block border-b border-slate-200/60 pb-2">
              Pratinjau Video Terpilih
            </span>

            {liveMetaPreview ? (
              <div className="space-y-3 bg-white p-3 rounded-xl border border-slate-200 shadow-2xs">
                <div className="aspect-[9/12] bg-slate-100 rounded-lg overflow-hidden relative">
                  {liveMetaPreview.thumbnailUrl ? (
                    <img 
                      src={liveMetaPreview.thumbnailUrl} 
                      alt="Thumbnail Preview" 
                      className="w-full h-full object-cover" 
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <TrendingUp size={36} />
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold bg-black/70 text-white backdrop-blur-xs">
                      {getCountryInfo(form.country).flag} {getCountryInfo(form.country).code}
                    </span>
                  </div>
                </div>

                <div className="space-y-1">
                  <h4 className="text-xs font-bold text-slate-900 line-clamp-2 leading-snug">
                    {liveMetaPreview.title || 'Judul video TikTok'}
                  </h4>
                  <div className="flex items-center gap-3 text-[11px] text-slate-500 font-semibold">
                    {liveMetaPreview.viewCount && <span>{liveMetaPreview.viewCount} views</span>}
                    {liveMetaPreview.likeCount && <span>{liveMetaPreview.likeCount} likes</span>}
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 text-center text-slate-400 space-y-2">
                <TrendingUp size={28} className="mx-auto text-slate-300" />
                <p className="text-xs font-medium">
                  Belum ada pratinjau. Metadata akan otomatis diunduh saat video disimpan.
                </p>
              </div>
            )}
          </div>
        </form>
      </div>

      {/* Filter Bar & Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-2xs overflow-hidden">
        <div className="p-5 sm:p-6 border-b border-slate-100 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="font-extrabold text-slate-900 text-sm sm:text-base">
                Daftar Video Trend ({filteredVideos.length}{filteredVideos.length !== videos.length ? ` dari total ${videos.length}` : ''})
              </h3>
              <p className="text-xs text-slate-500">
                Gunakan filter negara atau pencarian kata kunci untuk mengelola konten dengan cepat.
              </p>
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 transition-colors self-start cursor-pointer"
              >
                <RotateCcw size={13} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          {/* Quick Country Tabs */}
          <div>
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
              <Globe size={13} className="text-[#5b50e5]" />
              <span>Filter Berdasarkan Negara:</span>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => setSelectedCountry('ALL')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                  selectedCountry === 'ALL'
                    ? 'bg-[#5b50e5] text-white shadow-xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <span>Semua Negara</span>
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  selectedCountry === 'ALL' ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'
                }`}>
                  {videos.length}
                </span>
              </button>

              {TREND_COUNTRIES.map((c) => {
                const count = countryCounts[c.code] || 0;
                const isSelected = selectedCountry === c.code;
                return (
                  <button
                    type="button"
                    key={c.code}
                    onClick={() => setSelectedCountry(c.code)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 cursor-pointer ${
                      isSelected
                        ? 'bg-[#5b50e5] text-white font-bold shadow-xs'
                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                    }`}
                  >
                    <span>{c.flag}</span>
                    <span>{c.name.split(' ')[0]}</span>
                    {count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                        isSelected ? 'bg-white/25 text-white' : 'bg-slate-200 text-slate-600'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Search, Category, Status Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
            {/* Search Input */}
            <div className="relative">
              <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari judul, link, kata kunci..."
                className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white"
              />
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white cursor-pointer"
              >
                <option value="ALL">Semua Kategori</option>
                {TREND_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-2">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value as any)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white cursor-pointer"
              >
                <option value="ALL">Semua Status</option>
                <option value="active">Hanya Aktif</option>
                <option value="inactive">Hanya Nonaktif</option>
              </select>
            </div>
          </div>
        </div>

        {/* Table Content */}
        {loading ? (
          <div className="p-12 text-center text-slate-400 space-y-2">
            <Loader2 className="mx-auto animate-spin text-[#5b50e5]" size={28} />
            <p className="text-xs font-medium">Memuat katalog trend video viral...</p>
          </div>
        ) : filteredVideos.length === 0 ? (
          <div className="p-12 text-center text-slate-400 text-xs font-medium space-y-2">
            <TrendingUp size={32} className="mx-auto text-slate-300" />
            <p>
              {hasActiveFilters 
                ? 'Tidak ada video yang cocok dengan kombinasi filter yang dipilih.' 
                : 'Belum ada video trend tersimpan di database.'}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50/80 text-slate-600 text-[11px] uppercase tracking-wider font-extrabold border-b border-slate-100">
                <tr>
                  <th className="px-5 py-3.5">Video & Info</th>
                  <th className="px-4 py-3.5">Negara</th>
                  <th className="px-4 py-3.5">Kategori</th>
                  <th className="px-4 py-3.5">Engagement</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {paginatedVideos.map((video) => {
                  const country = getCountryInfo(video.country);
                  return (
                    <tr key={video.id} className="hover:bg-slate-50/70 transition-colors">
                      {/* Thumbnail & Title */}
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-14 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                            {video.thumbnailUrl ? (
                              <img 
                                src={video.thumbnailUrl} 
                                alt="Thumb" 
                                className="w-full h-full object-cover" 
                              />
                            ) : (
                              <TrendingUp className="w-4 h-4 text-slate-300" />
                            )}
                          </div>
                          <div className="max-w-xs sm:max-w-md">
                            <span className="font-extrabold text-slate-900 line-clamp-1 block leading-snug">
                              {video.title || 'Video TikTok'}
                            </span>
                            <a 
                              href={video.tiktokUrl} 
                              target="_blank" 
                              rel="noreferrer"
                              className="text-[11px] text-[#5b50e5] hover:underline font-mono inline-flex items-center gap-1 mt-0.5"
                            >
                              <ExternalLink size={11} />
                              <span className="line-clamp-1">{video.tiktokUrl}</span>
                            </a>
                          </div>
                        </div>
                      </td>

                      {/* Country */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-50 border border-indigo-100 text-[#5b50e5]">
                          <span>{country.flag}</span>
                          <span>{country.name}</span>
                        </span>
                      </td>

                      {/* Category */}
                      <td className="px-4 py-3.5">
                        <span className="inline-flex px-2.5 py-1 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700">
                          {video.category}
                        </span>
                      </td>

                      {/* Engagement */}
                      <td className="px-4 py-3.5 whitespace-nowrap text-[11px] text-slate-500 font-semibold">
                        <div>{video.viewCount ? `${video.viewCount} views` : '-'}</div>
                        <div className="text-slate-400">{video.likeCount ? `${video.likeCount} likes` : '-'}</div>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3.5 whitespace-nowrap">
                        {video.isActive ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Eye size={12} className="text-emerald-600" />
                            <span>Aktif</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                            <EyeOff size={12} className="text-slate-400" />
                            <span>Nonaktif</span>
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="px-5 py-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleEdit(video)}
                            className="p-1.5 text-slate-500 hover:text-[#5b50e5] hover:bg-indigo-50 rounded-lg transition-colors cursor-pointer"
                            title="Edit Data Video"
                          >
                            <Edit2 size={15} />
                          </button>

                          <button
                            type="button"
                            onClick={() => handleToggleActive(video)}
                            className="p-1.5 text-slate-500 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer"
                            title={video.isActive ? 'Nonaktifkan dari User' : 'Aktifkan ke User'}
                          >
                            {video.isActive ? <EyeOff size={15} /> : <Eye size={15} />}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setVideoToDelete(video);
                              setDeleteMode('soft');
                            }}
                            className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                            title="Hapus / Nonaktifkan"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Footer */}
        {filteredVideos.length > 0 && (
          <div className="p-4 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 font-medium">
            <div className="flex items-center gap-2">
              <span>Tampilkan:</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 rounded-lg border border-slate-200 font-bold bg-white text-slate-800 focus:outline-none cursor-pointer"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
              </select>
              <span>
                Menampilkan {(currentPage - 1) * pageSize + 1} - {Math.min(currentPage * pageSize, filteredVideos.length)} dari {filteredVideos.length} video
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman Sebelumnya"
              >
                <ChevronLeft size={16} />
              </button>

              <span className="px-3 font-bold text-slate-800">
                {currentPage} / {totalPages}
              </span>

              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
                title="Halaman Berikutnya"
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* CONFIRMATION MODAL FOR DELETION */}
      {videoToDelete && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-7 shadow-2xl space-y-5 border border-slate-100 animate-in zoom-in-95 duration-150">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-rose-600" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    {deleteMode === 'hard' ? 'Hapus Permanen Video?' : 'Nonaktifkan Video Trend?'}
                  </h3>
                  <p className="text-xs text-slate-500 font-medium mt-0.5 line-clamp-1">
                    {videoToDelete.title || videoToDelete.tiktokUrl}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600 leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-200">
                {deleteMode === 'hard'
                  ? 'Data video ini akan dihapus secara permanen dari basis data Firebase dan tidak dapat dikembalikan.'
                  : 'Video ini akan dinonaktifkan sehingga tidak akan lagi muncul pada katalog pengguna, namun tetap tersimpan di riwayat admin.'}
              </p>

              <div className="flex items-center gap-3 pt-1">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'soft'}
                    onChange={() => setDeleteMode('soft')}
                    className="text-[#5b50e5] focus:ring-[#5b50e5]"
                  />
                  <span>Nonaktifkan Saja (Disarankan)</span>
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-rose-600 cursor-pointer">
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={deleteMode === 'hard'}
                    onChange={() => setDeleteMode('hard')}
                    className="text-rose-600 focus:ring-rose-500"
                  />
                  <span>Hapus Permanen</span>
                </label>
              </div>
            </div>

            <div className="border-t border-slate-100 pt-3 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setVideoToDelete(null)}
                className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors cursor-pointer px-3 py-2"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold shadow-xs cursor-pointer flex items-center gap-1.5 transition-all"
              >
                <Trash2 className="w-4 h-4" />
                <span>{deleteMode === 'hard' ? 'Ya, Hapus Permanen' : 'Ya, Nonaktifkan'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] max-w-md p-4 rounded-2xl shadow-2xl border flex items-start gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-950 text-emerald-300 border-emerald-500/40'
              : toast.type === 'error'
              ? 'bg-slate-950 text-rose-300 border-rose-500/40'
              : 'bg-slate-950 text-indigo-300 border-indigo-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
          ) : toast.type === 'error' ? (
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
          ) : (
            <Flame className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
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

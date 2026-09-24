import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  Copy, 
  Check, 
  Link as LinkIcon, 
  Filter,
  Loader2,
  TrendingUp,
  ExternalLink,
  Flame,
  Sparkles,
  Globe,
  Search,
  RotateCcw,
  Video,
  Eye,
  Heart,
  ArrowRight
} from 'lucide-react';
import { 
  TrendVideo, 
  TREND_CATEGORIES, 
  getCountryInfo,
  subscribeTrendVideos 
} from '../../lib/trendVideos';

export default function TrendVideoTool() {
  const [videos, setVideos] = useState<TrendVideo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('Semua');
  const [selectedCountry, setSelectedCountry] = useState<string>('Semua');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Floating Toast Notification
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'info' } | null>(null);
  const toastTimeoutRef = useRef<any>(null);

  const showToast = (message: string, type: 'success' | 'info' = 'info') => {
    if (toastTimeoutRef.current) clearTimeout(toastTimeoutRef.current);
    setToast({ message, type });
    toastTimeoutRef.current = setTimeout(() => {
      setToast(null);
    }, 3500);
  };

  useEffect(() => {
    const unsubscribe = subscribeTrendVideos((data) => {
      setVideos(data);
      setLoading(false);
    }, true); // true = hanya yang aktif

    return () => unsubscribe();
  }, []);

  // Hanya tampilkan negara yang memiliki video aktif
  const availableCountries = useMemo(() => {
    const map = new Map<string, { code: string; name: string; flag: string; count: number }>();
    videos.forEach((v) => {
      const code = (v.country || 'ID').toUpperCase();
      const existing = map.get(code);
      if (existing) {
        existing.count += 1;
      } else {
        const info = getCountryInfo(code);
        map.set(code, {
          code: info.code,
          name: info.name,
          flag: info.flag,
          count: 1
        });
      }
    });
    return Array.from(map.values());
  }, [videos]);

  // Jika negara yang sedang dipilih tidak ada lagi di daftar negara aktif, reset ke 'Semua'
  useEffect(() => {
    if (selectedCountry !== 'Semua' && !availableCountries.some((c) => c.code === selectedCountry)) {
      setSelectedCountry('Semua');
    }
  }, [availableCountries, selectedCountry]);

  const filteredVideos = useMemo(() => {
    return videos.filter((v) => {
      const matchCat = selectedCategory === 'Semua' || v.category === selectedCategory;
      const vCountry = (v.country || 'ID').toUpperCase();
      const matchCountry = selectedCountry === 'Semua' || vCountry === selectedCountry;

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchTitle = (v.title || '').toLowerCase().includes(q);
        const matchCatName = (v.category || '').toLowerCase().includes(q);
        const matchUrl = (v.tiktokUrl || '').toLowerCase().includes(q);
        if (!matchTitle && !matchCatName && !matchUrl) return false;
      }

      return matchCat && matchCountry;
    });
  }, [videos, selectedCategory, selectedCountry, searchQuery]);

  const handleCopy = async (video: TrendVideo) => {
    try {
      await navigator.clipboard.writeText(video.tiktokUrl);
      setCopiedId(video.id);
      showToast('Tautan TikTok berhasil disalin ke clipboard!', 'success');
      setTimeout(() => setCopiedId(null), 2500);
    } catch (err) {
      console.error('Gagal copy:', err);
      showToast('Tautan gagal disalin otomatis.', 'info');
    }
  };

  const handleUseInReplica = async (video: TrendVideo) => {
    try {
      await navigator.clipboard.writeText(video.tiktokUrl);
      showToast('Tautan disalin! Membuka tool Replika Video...', 'success');
      // Dispatch custom event to switch tab in UserLayout
      window.dispatchEvent(new CustomEvent('satset_switch_tab', { detail: 'ideas' }));
    } catch (e) {
      window.dispatchEvent(new CustomEvent('satset_switch_tab', { detail: 'ideas' }));
    }
  };

  const hasActiveFilters = selectedCategory !== 'Semua' || selectedCountry !== 'Semua' || searchQuery.trim() !== '';

  const handleResetFilters = () => {
    setSelectedCategory('Semua');
    setSelectedCountry('Semua');
    setSearchQuery('');
  };

  return (
    <div className="h-full flex flex-col space-y-5">
      {/* Header Banner */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-[#5b50e5] flex items-center justify-center">
                <Flame className="w-4 h-4 text-[#5b50e5]" />
              </div>
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Trend Video Viral TikTok
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 max-w-2xl">
              Koleksi video viral pilihan per negara & kategori niche. Salin link atau gunakan langsung ke tool <strong className="text-slate-700">Replika Video</strong> atau <strong className="text-slate-700">Ekstrak Prompt</strong>.
            </p>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-auto">
            <span className="px-3 py-1.5 rounded-xl bg-indigo-50 text-[#5b50e5] border border-indigo-100 text-xs font-bold flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4" />
              <span>{videos.length} Video FYP Tersedia</span>
            </span>
          </div>
        </div>

        {/* Filter Controls Bar */}
        <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
          {/* Search Box (5 cols) */}
          <div className="sm:col-span-5 relative">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari topik, judul, atau kata kunci..."
              className="w-full h-10 pl-9 pr-3 rounded-xl border border-slate-200 text-xs font-medium focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-slate-50/50 hover:bg-white focus:bg-white transition-all"
            />
          </div>

          {/* Country Selector (3 cols) */}
          {availableCountries.length > 0 && (
            <div className="sm:col-span-3">
              <select
                value={selectedCountry}
                onChange={(e) => setSelectedCountry(e.target.value)}
                className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white cursor-pointer transition-all"
              >
                {availableCountries.length > 1 && (
                  <option value="Semua">Semua Negara ({videos.length})</option>
                )}
                {availableCountries.map((c) => (
                  <option key={c.code} value={c.code}>
                    {c.flag} {c.name} ({c.count})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Category Selector (3 cols) */}
          <div className={availableCountries.length > 0 ? "sm:col-span-3" : "sm:col-span-6"}>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full h-10 px-3 rounded-xl border border-slate-200 text-xs font-bold text-slate-800 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 bg-white cursor-pointer transition-all"
            >
              <option value="Semua">Semua Kategori</option>
              {TREND_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>
          </div>

          {/* Reset Action (1 col or button) */}
          {hasActiveFilters && (
            <div className="sm:col-span-1 flex justify-end">
              <button
                type="button"
                onClick={handleResetFilters}
                className="w-full h-10 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
                title="Reset Semua Filter"
              >
                <RotateCcw size={13} />
                <span className="sm:hidden">Reset</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Content */}
      {loading ? (
        <div className="space-y-4">
          <div className="p-4 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[#5b50e5] flex items-center justify-center text-white shadow-xs">
                <Flame className="w-4 h-4 animate-pulse" />
              </div>
              <div>
                <p className="text-xs font-bold text-slate-800">Menyinkronkan Video Trend TikTok Terkini</p>
                <p className="text-[11px] text-slate-500">Mengambil referensi konten viral, audio sound, dan kategori FYP...</p>
              </div>
            </div>
            <div className="hidden sm:flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-[#5b50e5] animate-ping" />
              <span className="text-xs font-bold text-[#5b50e5]">Live Sync</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
              <div
                key={n}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs flex flex-col animate-pulse"
              >
                <div className="aspect-[9/12] bg-slate-100 relative" />
                <div className="p-4 space-y-2.5">
                  <div className="w-full h-3.5 bg-slate-100 rounded-md" />
                  <div className="w-2/3 h-3 bg-slate-100 rounded-md" />
                  <div className="w-full h-8 bg-slate-100 rounded-xl mt-3" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredVideos.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-12 text-center text-slate-400 space-y-3 flex-1 flex flex-col items-center justify-center">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400">
            <TrendingUp size={24} />
          </div>
          <div>
            <h4 className="text-sm font-bold text-slate-700">Belum ada video trend yang sesuai</h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Coba ganti filter negara, ubah kategori, atau ketik kata kunci lain.
            </p>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={handleResetFilters}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all cursor-pointer"
            >
              Reset Semua Filter
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 pb-8 overflow-y-auto">
          {filteredVideos.map((video) => {
            const country = getCountryInfo(video.country);
            return (
              <div
                key={video.id}
                className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-2xs hover:shadow-md transition-all duration-200 flex flex-col group"
              >
                {/* Video Poster Thumbnail */}
                <div className="aspect-[9/12] bg-slate-100 relative overflow-hidden">
                  {video.thumbnailUrl ? (
                    <img
                      src={video.thumbnailUrl}
                      alt={video.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = 'none';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300">
                      <TrendingUp size={44} />
                    </div>
                  )}

                  {/* Gradient Shadow Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30 pointer-events-none" />

                  {/* Badges: Kategori & Negara (Top) */}
                  <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between gap-1">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-black/60 text-white backdrop-blur-xs border border-white/10">
                      <span>{country.flag}</span>
                      <span>{country.code}</span>
                    </span>

                    <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-bold bg-white/90 text-slate-800 backdrop-blur-xs shadow-xs max-w-[140px] truncate">
                      {video.category}
                    </span>
                  </div>

                  {/* Stats (Bottom on thumbnail) */}
                  <div className="absolute bottom-2.5 left-2.5 right-2.5 flex items-center gap-3 text-white text-xs font-semibold drop-shadow-sm">
                    {video.viewCount && (
                      <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                        <Eye className="w-3.5 h-3.5 text-white/90" />
                        <span>{video.viewCount}</span>
                      </span>
                    )}
                    {video.likeCount && (
                      <span className="flex items-center gap-1 bg-black/40 px-2 py-0.5 rounded-md backdrop-blur-xs">
                        <Heart className="w-3.5 h-3.5 text-rose-400 fill-rose-400" />
                        <span>{video.likeCount}</span>
                      </span>
                    )}
                  </div>
                </div>

                {/* Card Body */}
                <div className="p-4 flex flex-col flex-1 space-y-3">
                  <h3 
                    className="text-xs font-extrabold text-slate-900 line-clamp-2 leading-snug tracking-tight"
                    title={video.title}
                  >
                    {video.title || 'Video Tren TikTok'}
                  </h3>

                  {/* Fast Action Buttons */}
                  <div className="mt-auto pt-2 space-y-2 border-t border-slate-100">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleCopy(video)}
                        className={`flex-1 h-9 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shadow-2xs ${
                          copiedId === video.id
                            ? 'bg-emerald-600 text-white'
                            : 'bg-[#5b50e5] hover:bg-[#4f46e5] text-white'
                        }`}
                      >
                        {copiedId === video.id ? (
                          <>
                            <Check size={14} />
                            <span>Tersalin!</span>
                          </>
                        ) : (
                          <>
                            <Copy size={14} />
                            <span>Salin Link</span>
                          </>
                        )}
                      </button>

                      <a
                        href={video.tiktokUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="w-9 h-9 rounded-xl border border-slate-200 hover:border-slate-300 bg-slate-50 hover:bg-slate-100 text-slate-600 hover:text-slate-900 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Tonton langsung di TikTok"
                      >
                        <ExternalLink size={14} />
                      </a>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleUseInReplica(video)}
                      className="w-full h-8 rounded-xl bg-slate-100 hover:bg-indigo-50 hover:text-[#5b50e5] border border-slate-200/80 text-[11px] font-bold text-slate-700 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={12} className="text-[#5b50e5]" />
                      <span>Buat Replika Konten</span>
                      <ArrowRight size={12} className="opacity-60" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 z-[9999] max-w-md p-4 rounded-2xl shadow-2xl border flex items-center gap-3 animate-in slide-in-from-bottom-5 duration-200 ${
            toast.type === 'success'
              ? 'bg-slate-950 text-emerald-300 border-emerald-500/40'
              : 'bg-slate-950 text-indigo-300 border-indigo-500/40'
          }`}
        >
          {toast.type === 'success' ? (
            <Check className="w-5 h-5 text-emerald-400 shrink-0" />
          ) : (
            <Sparkles className="w-5 h-5 text-indigo-400 shrink-0" />
          )}
          <div className="flex-1 text-xs font-bold text-white">
            {toast.message}
          </div>
        </div>
      )}
    </div>
  );
}

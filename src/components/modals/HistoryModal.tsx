import React, { useState, useEffect, useMemo } from 'react';
import { 
  History, 
  Search, 
  Trash2, 
  Download, 
  X, 
  Copy, 
  Check, 
  Camera, 
  Scissors, 
  Sparkles, 
  Clock, 
  RefreshCw, 
  Lightbulb, 
  Clapperboard, 
  ChevronLeft, 
  ShoppingBag,
  Eye,
  EyeOff,
  ChevronDown,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HistoryItem, HistoryCategory } from '../../types';
import { 
  getHistory, 
  deleteHistoryItem, 
  clearAllHistory
} from '../../lib/history';

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRestoreItem?: (item: HistoryItem) => void;
}

export default function HistoryModal({ isOpen, onClose, onRestoreItem }: HistoryModalProps) {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmClearOpen, setConfirmClearOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setItems(getHistory());
      setSearchQuery('');
      setConfirmClearOpen(false);
    }

    const handleUpdate = () => {
      setItems(getHistory());
    };
    window.addEventListener('satset_history_updated', handleUpdate);
    return () => {
      window.removeEventListener('satset_history_updated', handleUpdate);
    };
  }, [isOpen]);

  // Normalizer: correctly classify items even if legacy data tagged them differently
  const getItemCategory = (item: HistoryItem): string => {
    if (item.category === 'tiktok_shop_ideas' || item.title.startsWith('Produk to Video')) {
      return 'tiktok_shop_ideas';
    }
    return item.category;
  };

  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = deleteHistoryItem(id);
    setItems(updated);
    if (expandedId === id) {
      setExpandedId(null);
    }
  };

  const handleClearAll = () => {
    clearAllHistory();
    setItems([]);
    setExpandedId(null);
    setConfirmClearOpen(false);
  };

  const handleCopyPrompt = (text: string, id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Compute live counts per category
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: items.length,
      tiktok_shop_ideas: 0,
      content_ideas: 0,
      video_prompt: 0,
      photo_prompt: 0,
      tiktok_download: 0,
      frame_extraction: 0,
    };
    items.forEach(item => {
      const cat = getItemCategory(item);
      if (counts[cat] !== undefined) {
        counts[cat]++;
      }
    });
    return counts;
  }, [items]);

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      const actualCat = getItemCategory(item);
      const matchesCategory = activeCategory === 'all' || actualCat === activeCategory;
      const query = searchQuery.toLowerCase().trim();
      if (!query) return matchesCategory;

      const matchesTitle = item.title?.toLowerCase().includes(query);
      const matchesSubtitle = item.subtitle?.toLowerCase().includes(query);
      const matchesPrompt = item.data?.prompt?.toLowerCase().includes(query);
      const matchesIdeas = item.data?.contentIdeasResult?.toLowerCase().includes(query);
      const matchesTiktok = item.data?.tiktokTitle?.toLowerCase().includes(query);

      return matchesCategory && (matchesTitle || matchesSubtitle || matchesPrompt || matchesIdeas || matchesTiktok);
    });
  }, [items, activeCategory, searchQuery]);

  const getCategoryBadge = (item: HistoryItem) => {
    const cat = getItemCategory(item);
    switch (cat) {
      case 'tiktok_shop_ideas':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-indigo-50 text-[#5b50e5] border border-indigo-200/80 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <ShoppingBag className="w-3 h-3 text-[#5b50e5]" />
            <span>Produk to Video</span>
          </span>
        );
      case 'content_ideas':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/80 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <Lightbulb className="w-3 h-3 text-emerald-600" />
            <span>Replika Video Viral</span>
          </span>
        );
      case 'video_prompt':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200/80 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <Clapperboard className="w-3 h-3 text-violet-600" />
            <span>Ekstrak Prompt Video</span>
          </span>
        );
      case 'photo_prompt':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200/80 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <Camera className="w-3 h-3 text-purple-600" />
            <span>Prompt Foto</span>
          </span>
        );
      case 'tiktok_download':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-pink-50 text-pink-700 border border-pink-200/80 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <Download className="w-3 h-3 text-pink-600" />
            <span>TikTok Downloader</span>
          </span>
        );
      case 'frame_extraction':
        return (
          <span className="px-2.5 py-0.5 rounded-full bg-cyan-50 text-cyan-700 border border-cyan-200/80 text-[11px] font-bold flex items-center gap-1.5 shadow-2xs">
            <Scissors className="w-3 h-3 text-cyan-600" />
            <span>Ekstraktor Frame</span>
          </span>
        );
      default:
        return null;
    }
  };

  const getTargetToolName = (item: HistoryItem): string => {
    const cat = getItemCategory(item);
    switch (cat) {
      case 'tiktok_shop_ideas': return 'Produk to Video';
      case 'content_ideas': return 'Replika Video';
      case 'video_prompt': return 'Ekstrak Prompt';
      case 'photo_prompt': return 'Prompt Foto';
      case 'tiktok_download': return 'Downloader';
      case 'frame_extraction': return 'Ekstraktor Frame';
      default: return 'Gunakan';
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 md:p-6 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: 10 }}
        transition={{ duration: 0.2 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl max-h-[92vh] sm:max-h-[90vh] bg-white border border-slate-200 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-slate-800 my-auto"
      >
        {/* Header (Clean SaaS Aesthetic) */}
        <div className="p-4 sm:p-6 border-b border-slate-100 bg-white">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-[#5b50e5] font-bold shadow-xs shrink-0">
                <History className="w-5 h-5 text-[#5b50e5]" />
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                    Riwayat Aktivitas & Konten
                  </h2>
                  <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-[#5b50e5] border border-indigo-200/80 text-xs font-bold">
                    {items.length} Tersimpan
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5 truncate">
                  Kelola, pratinjau, dan gunakan kembali prompt AI serta ide konten yang telah Anda buat.
                </p>
              </div>
            </div>

            {/* Actions Top Right */}
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
                title="Tutup Riwayat"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Toolbar: Search & Dynamic Categories */}
        <div className="p-3 sm:p-5 border-b border-slate-100 bg-slate-50/70 space-y-3">
          {/* Search bar + Clear All */}
          <div className="flex flex-col sm:flex-row items-center gap-2.5">
            <div className="relative flex-1 w-full">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari prompt, topik, judul video, hashtag, model..."
                className="w-full pl-10 pr-9 py-2.5 rounded-xl bg-white border border-slate-200 text-slate-900 text-xs sm:text-sm placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 shadow-2xs"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {items.length > 0 && (
              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                {confirmClearOpen ? (
                  <div className="flex items-center gap-2 bg-white p-1 rounded-xl border border-rose-200 shadow-2xs w-full sm:w-auto">
                    <span className="text-xs text-rose-700 font-semibold px-2">Hapus semua?</span>
                    <button
                      type="button"
                      onClick={handleClearAll}
                      className="px-2.5 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition-all cursor-pointer"
                    >
                      Ya, Kosongkan
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmClearOpen(false)}
                      className="px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-semibold cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmClearOpen(true)}
                    className="w-full sm:w-auto px-3.5 py-2.5 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-600 hover:text-rose-600 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Kosongkan</span>
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Category Filter Pills with Live SaaS Count Badges */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
            {[
              { id: 'all', label: 'Semua Riwayat', count: categoryCounts.all },
              { id: 'tiktok_shop_ideas', label: 'Produk to Video', count: categoryCounts.tiktok_shop_ideas },
              { id: 'content_ideas', label: 'Replika Video Viral', count: categoryCounts.content_ideas },
              { id: 'video_prompt', label: 'Ekstrak Prompt Video', count: categoryCounts.video_prompt },
              { id: 'photo_prompt', label: 'Photo Prompt', count: categoryCounts.photo_prompt },
              { id: 'tiktok_download', label: 'TikTok Downloader', count: categoryCounts.tiktok_download },
              { id: 'frame_extraction', label: 'Ekstraktor Frame', count: categoryCounts.frame_extraction },
            ].map(tab => {
              const isSelected = activeCategory === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveCategory(tab.id)}
                  className={`px-3 py-1.5 rounded-xl font-semibold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-[#5b50e5] text-white shadow-2xs'
                      : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    isSelected ? 'bg-white/25 text-white' : 'bg-slate-100 text-slate-500'
                  }`}>
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* History Item List */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-3 bg-[#f8fafc]">
          {filteredItems.length === 0 ? (
            <div className="text-center py-16 sm:py-20 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-white border border-slate-200 flex items-center justify-center mx-auto text-slate-400 shadow-2xs">
                <History className="w-7 h-7" />
              </div>
              <h3 className="text-base font-bold text-slate-800">
                {searchQuery ? 'Tidak ada hasil yang cocok' : 'Belum ada riwayat tersimpan'}
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {searchQuery 
                  ? `Tidak ditemukan riwayat dengan kata kunci "${searchQuery}". Coba kata kunci lain atau pilih tab filter berbeda.` 
                  : 'Hasil generator AI, ekstraksi prompt, dan unduhan video Anda akan otomatis tersimpan rapi di sini.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setActiveCategory('all');
                  }}
                  className="px-4 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-bold transition-all shadow-xs cursor-pointer inline-flex items-center gap-1.5"
                >
                  <Filter className="w-3.5 h-3.5" />
                  <span>Reset Filter & Pencarian</span>
                </button>
              )}
            </div>
          ) : (
            filteredItems.map((item) => {
              const promptContent = item.data?.prompt || item.data?.contentIdeasResult || '';
              const isExpanded = expandedId === item.id;
              const hasPrompt = Boolean(promptContent);

              return (
                <div
                  key={item.id}
                  className={`p-4 sm:p-5 rounded-2xl border transition-all duration-200 bg-white ${
                    isExpanded
                      ? 'border-[#5b50e5] ring-2 ring-[#5b50e5]/10 shadow-md'
                      : 'border-slate-200/90 hover:border-slate-300 shadow-2xs'
                  }`}
                >
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Item Details */}
                    <div className="space-y-2 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {getCategoryBadge(item)}

                        <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {new Date(item.timestamp).toLocaleString('id-ID', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>

                      <h4 className="text-sm sm:text-[15px] font-bold text-slate-900 tracking-tight leading-snug">
                        {item.title}
                      </h4>

                      {item.subtitle && (
                        <p className="text-xs text-slate-500 font-medium line-clamp-1">
                          {item.subtitle}
                        </p>
                      )}
                    </div>

                    {/* SaaS Control Action Buttons */}
                    <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
                      {/* Pratinjau Accordion */}
                      {hasPrompt && (
                        <button
                          type="button"
                          onClick={() => setExpandedId(isExpanded ? null : item.id)}
                          className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                            isExpanded
                              ? 'bg-indigo-50 border-indigo-200 text-[#5b50e5]'
                              : 'bg-white hover:bg-slate-50 border-slate-200 text-slate-700'
                          }`}
                          title={isExpanded ? 'Tutup Pratinjau' : 'Lihat Isi Prompt Lengkap'}
                        >
                          {isExpanded ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                          <span className="hidden sm:inline">{isExpanded ? 'Tutup' : 'Pratinjau'}</span>
                          <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </button>
                      )}

                      {/* Salin Button */}
                      {hasPrompt && (
                        <button
                          type="button"
                          onClick={(e) => handleCopyPrompt(promptContent, item.id, e)}
                          className="px-3 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 hover:text-slate-900 transition-all text-xs font-semibold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                          title="Salin Prompt ke Clipboard"
                        >
                          {copiedId === item.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                              <span className="text-emerald-600 font-bold">Tersalin</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5 text-slate-500" />
                              <span className="hidden sm:inline">Salin</span>
                            </>
                          )}
                        </button>
                      )}

                      {/* Gunakan Ulang Button */}
                      {onRestoreItem && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onRestoreItem(item);
                            onClose();
                          }}
                          className="px-3.5 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white transition-all text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer"
                          title={`Buka kembali di tool ${getTargetToolName(item)}`}
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Gunakan</span>
                        </button>
                      )}

                      {/* Hapus Button */}
                      <button
                        type="button"
                        onClick={(e) => handleDelete(item.id, e)}
                        className="p-2 rounded-xl bg-white hover:bg-rose-50 border border-slate-200 hover:border-rose-200 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                        title="Hapus riwayat ini"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Accordion Preview */}
                  <AnimatePresence>
                    {isExpanded && hasPrompt && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-slate-100 space-y-2.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-[#5b50e5]" />
                              Pratinjau Hasil Prompt ({promptContent.length.toLocaleString()} karakter)
                            </span>
                            <button
                              type="button"
                              onClick={(e) => handleCopyPrompt(promptContent, item.id, e)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[#5b50e5] text-[11px] font-bold transition-all flex items-center gap-1 cursor-pointer"
                            >
                              {copiedId === item.id ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" />
                                  <span>Tersalin!</span>
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" />
                                  <span>Salin Teks Lengkap</span>
                                </>
                              )}
                            </button>
                          </div>

                          <div className="p-4 rounded-xl bg-slate-900 text-slate-100 font-mono text-xs max-h-64 overflow-y-auto leading-relaxed shadow-inner selection:bg-[#5b50e5] selection:text-white">
                            <pre className="whitespace-pre-wrap font-sans text-xs sm:text-[13px] leading-relaxed">
                              {promptContent}
                            </pre>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-3.5 sm:p-5 border-t border-slate-100 bg-white flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500 font-medium">
            Menampilkan <span className="font-bold text-slate-800">{filteredItems.length}</span> dari {items.length} riwayat
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Kembali ke Aplikasi</span>
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

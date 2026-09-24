import React, { useState } from 'react';
import { Camera, Sparkles, X, Sliders, Wand2, Layers, Check, Video } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface ClipSummaryItem {
  id: number | string;
  title: string;
  timeRange?: string;
  actionAndVO?: string;
  aiPrompt?: string;
}

export interface BatchPhotoPromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  conceptTitle: string;
  clips: ClipSummaryItem[];
  referenceImage?: File | null;
  initialSubjectReference?: string;
  initialProductReference?: string;
  onConfirm: (options: {
    aspectRatio: string;
    photoStyle: string;
    targetGenerator: string;
    negativePrompt?: string;
    subjectReference?: string;
    productReference?: string;
  }) => void;
}

const ASPECT_RATIO_OPTIONS = [
  { id: '--ar 9:16', label: '9:16', desc: 'Vertikal (TikTok, Reels, Shorts)', icon: '📱', isDefault: true },
  { id: '--ar 16:9', label: '16:9', desc: 'Horizontal (YouTube, Landscape)', icon: '🖥️' },
  { id: '--ar 1:1', label: '1:1', desc: 'Persegi (Feed Instagram, Carousel)', icon: '⏹️' },
  { id: '--ar 4:5', label: '4:5', desc: 'Portrait Feed (Instagram)', icon: '📸' },
  { id: '--ar 3:4', label: '3:4', desc: 'Portrait Standar', icon: '🖼️' },
  { id: '--ar 2:3', label: '2:3', desc: 'Editorial / Poster', icon: '🎨' },
];

const PHOTO_STYLES = [
  { id: 'commercial', label: 'Commercial E-Commerce', desc: 'Terang, bersih, tajam & fokus pada daya tarik produk' },
  { id: 'cinematic', label: 'Cinematic Realism', desc: 'Nuansa film 35mm, atmospheric lighting & color grading' },
  { id: 'portrait', label: 'Studio Portrait', desc: 'Lensa 85mm f/1.2, creamy bokeh & tekstur kulit mikro' },
  { id: 'fashion', label: 'Fashion & High-End Editorial', desc: 'Gaya majalah mode dengan estetika modern' },
  { id: 'product', label: 'Product Macro Details', desc: 'Close-up detail material, kemasan & fitur produk' },
];

const TARGET_GENERATORS = [
  { id: 'nanobananapro', label: 'Nano Banana Pro / TikTok AI', badge: 'Recommended' },
  { id: 'midjourney', label: 'Midjourney v6.1 (Raw Style)', badge: 'Ultra Quality' },
  { id: 'flux', label: 'Flux.1 Dev / Schnell', badge: 'Open Source' },
  { id: 'dalle3', label: 'DALL-E 3 / OpenAI', badge: 'High Semantic' },
];

export default function BatchPhotoPromptModal({
  isOpen,
  onClose,
  conceptTitle,
  clips,
  referenceImage,
  initialSubjectReference,
  initialProductReference,
  onConfirm,
}: BatchPhotoPromptModalProps) {
  const [selectedAspectRatio, setSelectedAspectRatio] = useState<string>('--ar 9:16');
  const [selectedStyle, setSelectedStyle] = useState<string>('commercial');
  const [selectedGenerator, setSelectedGenerator] = useState<string>('nanobananapro');
  const [subjectReference, setSubjectReference] = useState<string>(initialSubjectReference || '');
  const [productReference, setProductReference] = useState<string>(initialProductReference || '');
  const [negativePrompt, setNegativePrompt] = useState<string>('');

  if (!isOpen) return null;

  const clipCount = clips.length > 0 ? clips.length : 1;

  const handleGenerate = () => {
    onConfirm({
      aspectRatio: selectedAspectRatio,
      photoStyle: selectedStyle,
      targetGenerator: selectedGenerator,
      negativePrompt: negativePrompt.trim() || undefined,
      subjectReference: subjectReference.trim() || undefined,
      productReference: productReference.trim() || undefined,
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-slate-900/70 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          transition={{ duration: 0.2 }}
          className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-2xl overflow-hidden my-auto flex flex-col max-h-[90vh]"
        >
          {/* Modal Header */}
          <div className="p-5 sm:p-6 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white flex items-start justify-between gap-4 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-2xl bg-purple-500/20 border border-purple-400/40 flex items-center justify-center text-purple-300 shrink-0 shadow-inner">
                <Camera className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-full bg-purple-500/30 text-purple-200 text-[11px] font-bold border border-purple-400/30">
                    Konfigurasi Multi-Klip
                  </span>
                  <span className="text-xs font-mono text-purple-200">
                    {clipCount} Klip Segmen
                  </span>
                </div>
                <h3 className="text-base sm:text-lg font-bold text-white mt-1">
                  Generate Prompt Foto ({clipCount} Klip Terhubung)
                </h3>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-5 flex-1 text-slate-800">
            {/* Concept & Clips Overview Card */}
            <div className="p-4 rounded-2xl bg-purple-50/60 border border-purple-200/80 space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] uppercase font-bold text-purple-900 tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-700" /> Konsep Naskah Video
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-200/70 text-purple-900 font-bold text-[11px]">
                  Tepat {clipCount} Prompt Foto
                </span>
              </div>
              <h4 className="text-xs sm:text-sm font-bold text-slate-900 line-clamp-2">
                {conceptTitle || 'Ide Konten Video'}
              </h4>
              
              {/* Clips Badge Strip */}
              {clips.length > 0 && (
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  {clips.map((c, idx) => (
                    <span
                      key={c.id || idx}
                      className="px-2.5 py-1 rounded-lg bg-white border border-purple-200 text-[11px] font-semibold text-purple-900 shadow-2xs flex items-center gap-1"
                    >
                      <Video className="w-3 h-3 text-purple-600" />
                      <span>Klip {idx + 1} {c.timeRange ? `(${c.timeRange})` : ''}</span>
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Step 1: Aspect Ratio Selection (Highlighted) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-600" /> 1. Pilih Rasio Foto (Aspect Ratio)
                </label>
                <span className="text-[11px] text-purple-700 font-bold">
                  {ASPECT_RATIO_OPTIONS.find(a => a.id === selectedAspectRatio)?.label} ({ASPECT_RATIO_OPTIONS.find(a => a.id === selectedAspectRatio)?.desc})
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                {ASPECT_RATIO_OPTIONS.map((ar) => {
                  const isSelected = selectedAspectRatio === ar.id;
                  return (
                    <button
                      type="button"
                      key={ar.id}
                      onClick={() => setSelectedAspectRatio(ar.id)}
                      className={`p-3 rounded-2xl border text-left transition-all cursor-pointer relative flex flex-col justify-between ${
                        isSelected
                          ? 'bg-purple-50/90 border-purple-500 ring-2 ring-purple-500/20 shadow-sm'
                          : 'bg-white border-slate-200 hover:border-purple-300 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-base">{ar.icon}</span>
                        {isSelected && (
                          <span className="w-4 h-4 rounded-full bg-purple-600 text-white flex items-center justify-center">
                            <Check className="w-2.5 h-2.5" />
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-bold ${isSelected ? 'text-purple-950' : 'text-slate-900'}`}>
                        {ar.label}
                      </span>
                      <span className="text-[10px] text-slate-500 leading-tight mt-0.5">
                        {ar.desc}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 2: Photo Style Preset */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Wand2 className="w-4 h-4 text-purple-600" /> 2. Preset Gaya Visual Foto
              </label>
              <select
                value={selectedStyle}
                onChange={(e) => setSelectedStyle(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-slate-300 text-xs sm:text-sm text-slate-900 focus:outline-none focus:border-purple-600 focus:ring-2 focus:ring-purple-600/20 font-medium cursor-pointer"
              >
                {PHOTO_STYLES.map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.label} — {st.desc}
                  </option>
                ))}
              </select>
            </div>

            {/* Step 3: Target Generator Engine */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-amber-500" /> 3. Target AI Image Generator
              </label>
              <div className="grid grid-cols-2 gap-2">
                {TARGET_GENERATORS.map((gen) => {
                  const isSelected = selectedGenerator === gen.id;
                  return (
                    <button
                      type="button"
                      key={gen.id}
                      onClick={() => setSelectedGenerator(gen.id)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center justify-between ${
                        isSelected
                          ? 'bg-indigo-50 border-indigo-500 text-indigo-950 font-bold ring-1 ring-indigo-500'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-indigo-300'
                      }`}
                    >
                      <span className="text-xs">{gen.label}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {gen.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Step 4: Reference Anchors (Anti-Flicker & Zero-Morphing Lock) */}
            <div className="space-y-3 p-3.5 rounded-2xl bg-indigo-50/50 border border-indigo-100">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" /> 4. Reference Anchors (Kunci Karakter & Produk)
                </label>
                <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/80 px-2 py-0.5 rounded-full">
                  Anti-Flicker
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">
                    👤 Subject / Talent Reference:
                  </label>
                  <input
                    type="text"
                    value={subjectReference}
                    onChange={(e) => setSubjectReference(e.target.value)}
                    placeholder="Contoh: Wanita 24th, rambut hitam wavy sebahu, kemeja putih"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-800">
                    📦 Product Reference:
                  </label>
                  <input
                    type="text"
                    value={productReference}
                    onChange={(e) => setProductReference(e.target.value)}
                    placeholder="Contoh: Botol serum frosted glass 30ml tutup putih doff"
                    className="w-full px-3 py-2 rounded-lg bg-white border border-slate-300 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  />
                </div>
              </div>
            </div>

            {/* Visual Continuity Guarantee Notice */}
            <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-xs space-y-1">
              <div className="font-bold flex items-center gap-1.5">
                <span>🔗 Jaminan Konektivitas Alur & Konsistensi Visual:</span>
              </div>
              <p className="text-[11px] text-amber-800 leading-relaxed">
                Sistem DoP AI akan menjaga identitas karakter, wajah, pakaian (wardrobe), dan produk 100% konsisten dari Klip 1 sampai Klip {clipCount}, selaras dengan alur cerita dan naskah video Anda.
              </p>
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl bg-white hover:bg-slate-100 border border-slate-300 text-slate-700 text-xs sm:text-sm font-semibold transition-colors cursor-pointer"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleGenerate}
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-700 active:scale-98 text-white text-xs sm:text-sm font-bold transition-all shadow-lg shadow-purple-600/30 flex items-center gap-2 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-amber-300" />
              <span>🚀 Generate {clipCount} Prompt Foto ({selectedAspectRatio.replace('--ar ', '')})</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Flame, ShoppingBag, ChevronDown, ChevronUp, Sparkles, Target, Eye, Video, Volume2 } from 'lucide-react';
import { ViralAnalysisData, ProductAnalysisData } from '@/src/types/viralReplicaContracts';

interface ReplicaAnalysisSummaryCardProps {
  viralAnalysis: ViralAnalysisData;
  productAnalysis: ProductAnalysisData;
}

export const ReplicaAnalysisSummaryCard: React.FC<ReplicaAnalysisSummaryCardProps> = ({
  viralAnalysis,
  productAnalysis,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl shadow-xs overflow-hidden transition-all">
      {/* Header bar that toggles analysis details */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 sm:p-5 flex items-center justify-between text-left hover:bg-slate-50/70 transition-colors cursor-pointer select-none"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-amber-50 border border-amber-200/70 text-amber-600 flex items-center justify-center shrink-0">
            <Flame className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm font-bold text-slate-900">
                Bedah DNA Viral & Target Produk
              </span>
              <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-semibold">
                Agent 1 Intel
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Hook: <span className="text-slate-700 italic">"{viralAnalysis.hook?.slice(0, 70)}..."</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          <span className="text-xs text-slate-500 font-medium hidden sm:inline">
            {isOpen ? 'Tutup Detail' : 'Buka Detail Analisis'}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {/* Expandable Content */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-100 p-4 sm:p-6 space-y-6 bg-slate-50/30"
          >
            {/* Grid 2 Columns: Viral Analysis & Product Analysis */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Left Column: Viral Video DNA */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-amber-200/60 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-amber-100">
                  <Flame className="w-4 h-4 text-amber-600" />
                  <h5 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                    Formula Video Viral Referensi
                  </h5>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 text-[10px] uppercase block">
                      Hook 3 Detik Pertama:
                    </span>
                    <p className="text-slate-800 font-medium leading-relaxed bg-amber-50/40 p-2 rounded-lg border border-amber-100/60 mt-0.5">
                      "{viralAnalysis.hook}"
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                        <Sparkles className="w-3 h-3 text-amber-500" /> Emotional Trigger
                      </span>
                      <p className="text-slate-700 font-medium text-[11px] mt-0.5">
                        {viralAnalysis.emotional_trigger}
                      </p>
                    </div>

                    <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                      <span className="text-[10px] font-semibold text-slate-400 uppercase flex items-center gap-1">
                        <Target className="w-3 h-3 text-indigo-500" /> Pola Retensi
                      </span>
                      <p className="text-slate-700 font-medium text-[11px] mt-0.5">
                        {viralAnalysis.retention_pattern}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1.5 pt-1 text-[11px]">
                    <div className="flex items-start gap-2 text-slate-600">
                      <Eye className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-700">Visual:</strong> {viralAnalysis.visual_style}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <Video className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-700">Kamera:</strong> {viralAnalysis.camera_style}</span>
                    </div>
                    <div className="flex items-start gap-2 text-slate-600">
                      <Volume2 className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                      <span><strong className="text-slate-700">Audio:</strong> {viralAnalysis.audio_style}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Target Product DNA */}
              <div className="p-4 sm:p-5 rounded-xl bg-white border border-blue-200/60 shadow-2xs space-y-3">
                <div className="flex items-center gap-2 pb-2 border-b border-blue-100">
                  <ShoppingBag className="w-4 h-4 text-blue-600" />
                  <h5 className="text-xs font-bold text-blue-900 uppercase tracking-wider">
                    DNA Produk Target User
                  </h5>
                </div>

                <div className="space-y-2.5 text-xs">
                  <div>
                    <span className="font-semibold text-slate-500 text-[10px] uppercase block">
                      Produk & Kategori:
                    </span>
                    <p className="text-slate-900 font-bold text-sm mt-0.5">
                      {productAnalysis.product_name}
                      <span className="ml-2 text-xs font-normal text-slate-500">
                        ({productAnalysis.category})
                      </span>
                    </p>
                  </div>

                  <div className="bg-blue-50/50 p-2.5 rounded-lg border border-blue-100 text-[11px]">
                    <span className="font-semibold text-blue-800 text-[10px] uppercase block">
                      Sudut Penjualan Utama (Selling Angle):
                    </span>
                    <p className="text-blue-950 font-medium mt-0.5">
                      {productAnalysis.selling_angle_primary}
                    </p>
                  </div>

                  <div>
                    <span className="font-semibold text-slate-400 text-[10px] uppercase block mb-1">
                      Keyword Relevan Produk (Bukan Generik):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[...(productAnalysis.keyword_core || []), ...(productAnalysis.keyword_niche || [])].slice(0, 6).map((kw, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[11px] font-medium border border-slate-200"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>

                  {productAnalysis.value_proposition && (
                    <div className="text-[11px] text-slate-600 pt-1">
                      <strong className="text-slate-700">Value Proposition:</strong> {productAnalysis.value_proposition}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

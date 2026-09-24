import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ShieldCheck,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  RefreshCw,
  CheckCircle2,
  HelpCircle
} from 'lucide-react';
import { QualityControlResult } from '@/src/types/viralReplicaContracts';

interface QualityControlBadgeProps {
  qc: QualityControlResult;
}

export const QualityControlBadge: React.FC<QualityControlBadgeProps> = ({ qc }) => {
  const [expanded, setExpanded] = useState(false);

  const { total_score, passed, quality_score, issues, refinement_attempted, extracted_keywords } = qc;

  // Determine badge color theme based on score
  const isHighQuality = total_score >= 85;
  const isGoodQuality = total_score >= 80;

  const scoreBadgeBg = isHighQuality
    ? 'bg-emerald-50 text-emerald-800 border-emerald-200'
    : isGoodQuality
    ? 'bg-sky-50 text-sky-800 border-sky-200'
    : 'bg-amber-50 text-amber-800 border-amber-200';

  const scoreBarColor = isHighQuality
    ? 'bg-emerald-500'
    : isGoodQuality
    ? 'bg-sky-500'
    : 'bg-amber-500';

  const scoreItems = [
    { label: 'Relevansi Produk', score: quality_score.product_relevance, weight: '25%' },
    { label: 'Relevansi Visual', score: quality_score.visual_relevance, weight: '20%' },
    { label: 'Caption Storytelling', score: quality_score.caption_relevance, weight: '20%' },
    { label: 'Hashtag Intelligence', score: quality_score.hashtag_relevance, weight: '15%' },
    { label: 'Audio & ASMR', score: quality_score.audio_relevance, weight: '10%' },
    { label: 'Scene Timing Accuracy', score: quality_score.scene_accuracy, weight: '10%' },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white border border-slate-200/90 shadow-xs overflow-hidden"
    >
      <div className="p-5 sm:p-6 bg-gradient-to-r from-slate-50/80 via-white to-sky-50/30">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-start sm:items-center gap-3.5">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 border ${
                passed ? 'bg-emerald-50 border-emerald-200 text-emerald-600' : 'bg-amber-50 border-amber-200 text-amber-600'
              }`}
            >
              {passed ? <ShieldCheck className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  Quality Control Intelligence
                </span>
                {refinement_attempted && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                    <RefreshCw className="w-2.5 h-2.5" />
                    Auto-Refined
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-bold border ${scoreBadgeBg}`}
                >
                  Skor {total_score}/100 • {passed ? 'Terverifikasi Siap Pakai' : 'Perlu Tinjauan'}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {passed
                  ? 'Output telah lolos 8 parameter uji kualitas AI: bebas hashtag generik (#fyp), visual anti-halusinasi, dan audio selaras.'
                  : 'Output telah disanitasi secara otomatis oleh Quality Control untuk membuang hashtag spam dan ketidaksesuaian.'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="self-start sm:self-center px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <span>{expanded ? 'Tutup Detail QC' : 'Lihat Skor Detail'}</span>
            {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
          </button>
        </div>

        {/* Progress Bar Header */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex items-center gap-3">
          <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${total_score}%` }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              className={`h-full rounded-full ${scoreBarColor}`}
            />
          </div>
          <span className="text-xs font-bold text-slate-700 shrink-0">{total_score}%</span>
        </div>
      </div>

      {/* Accordion Detail Breakdown */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-slate-200/80 bg-slate-50/40 p-5 sm:p-6 space-y-6"
          >
            {/* 6 Score Dimensions */}
            <div>
              <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3">
                Rincian 6 Dimensi Penilaian Kualitas (Min. 80/100)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {scoreItems.map((item, idx) => {
                  const itemColor =
                    item.score >= 85
                      ? 'text-emerald-700 bg-emerald-500'
                      : item.score >= 80
                      ? 'text-sky-700 bg-sky-500'
                      : 'text-amber-700 bg-amber-500';

                  return (
                    <div
                      key={idx}
                      className="p-3.5 rounded-xl bg-white border border-slate-200/80 space-y-1.5 shadow-2xs"
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-semibold text-slate-700">{item.label}</span>
                        <span className="font-bold text-slate-900">{item.score}/100</span>
                      </div>
                      <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${itemColor.split(' ')[1]}`}
                          style={{ width: `${item.score}%` }}
                        />
                      </div>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span>Bobot {item.weight}</span>
                        <span>{item.score >= 80 ? 'Optimal' : 'Tersanitasi'}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Extracted SEO Keywords */}
            {extracted_keywords && (
              <div className="p-4 rounded-xl bg-white border border-slate-200/80 space-y-2">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
                  <Sparkles className="w-3.5 h-3.5 text-sky-600" />
                  <span>Keyword Intelligence Terverifikasi</span>
                </div>
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {extracted_keywords.core.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-sky-50 text-sky-700 border border-sky-200/80"
                    >
                      🔑 {kw}
                    </span>
                  ))}
                  {extracted_keywords.related.map((kw, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-50 text-slate-600 border border-slate-200"
                    >
                      🏷️ {kw}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Quality Issues / Sanitization Log */}
            {issues && issues.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Log Validasi & Sanitasi Otomatis
                </h4>
                <div className="space-y-2">
                  {issues.map((iss, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 ${
                        iss.severity === 'critical'
                          ? 'bg-rose-50/60 border-rose-200 text-rose-800'
                          : 'bg-amber-50/50 border-amber-200 text-amber-800'
                      }`}
                    >
                      <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600" />
                      <div>
                        <p className="font-semibold">{iss.message}</p>
                        {iss.suggestion && (
                          <p className="text-[11px] opacity-80 mt-0.5">
                            Tindakan QC: {iss.suggestion}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

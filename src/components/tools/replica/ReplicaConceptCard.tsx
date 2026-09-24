import React, { useState } from 'react';
import { Lightbulb, Copy, Check, Compass, Radio } from 'lucide-react';
import { AdaptedConceptData } from '@/src/types/viralReplicaContracts';

interface ReplicaConceptCardProps {
  adaptedConcept: AdaptedConceptData;
}

export const ReplicaConceptCard: React.FC<ReplicaConceptCardProps> = ({ adaptedConcept }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyConcept = () => {
    const text = `KONSEP ADAPTASI: ${adaptedConcept.concept_title}\n\n` +
      `Ringkasan: ${adaptedConcept.concept_summary}\n` +
      `Strategi: ${adaptedConcept.strategy_summary}\n` +
      `Hook: ${adaptedConcept.hook_strategy}\n` +
      `CTA: ${adaptedConcept.cta_strategy}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center shrink-0">
            <Lightbulb className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold text-indigo-600 uppercase tracking-wider">
                Konsep Video Adaptasi
              </span>
              <span className="px-2 py-0.2 rounded-full bg-indigo-50 text-indigo-700 text-[10px] font-semibold border border-indigo-200">
                Agent 2 Result
              </span>
            </div>
            <h4 className="text-sm sm:text-base font-bold text-slate-900 leading-snug mt-0.5">
              {adaptedConcept.concept_title}
            </h4>
          </div>
        </div>

        <button
          type="button"
          onClick={handleCopyConcept}
          className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer self-end sm:self-auto shadow-2xs"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
          <span>{copied ? 'Tersalin' : 'Salin Konsep'}</span>
        </button>
      </div>

      <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-normal">
        {adaptedConcept.concept_summary}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
        <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
          <span className="text-[10px] font-bold text-amber-800 uppercase tracking-wider flex items-center gap-1">
            <Radio className="w-3 h-3 text-amber-600" /> Hook Strategy (0–3 Detik)
          </span>
          <p className="text-xs text-amber-950 font-medium italic">
            "{adaptedConcept.hook_strategy}"
          </p>
        </div>

        <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
          <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1">
            <Compass className="w-3 h-3 text-emerald-600" /> Call to Action (CTA)
          </span>
          <p className="text-xs text-emerald-950 font-medium">
            {adaptedConcept.cta_strategy}
          </p>
        </div>
      </div>
    </div>
  );
};

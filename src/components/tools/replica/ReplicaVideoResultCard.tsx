import React, { useState } from 'react';
import { motion } from 'motion/react';
import {
  FileText,
  Hash,
  Film,
  Copy,
  Check,
  Camera,
  Layers,
  Sparkles,
  Sliders,
  ListFilter,
  Download,
} from 'lucide-react';
import { ReplicaVideoResponse } from '@/src/types/viralReplicaContracts';
import { ReplicaAnalysisSummaryCard } from './ReplicaAnalysisSummaryCard';
import { ReplicaConceptCard } from './ReplicaConceptCard';
import { ReplicaClipCard } from './ReplicaClipCard';
import { CopyAllButtons } from './CopyAllButtons';
import { QualityControlBadge } from './QualityControlBadge';

interface ReplicaVideoResultCardProps {
  data: ReplicaVideoResponse;
  rawMarkdownText?: string;
  targetAI?: string;
  segmentDuration?: string;
  maxDuration?: number;
  refImageFile?: File | null;
  onSendToPhotoPrompt?: (
    prompt: string,
    options?: {
      negativePrompt?: string;
      referenceImage?: File;
      autoGenerate?: boolean;
      aspectRatio?: string;
      photoStyle?: string;
      targetGenerator?: string;
    }
  ) => void;
  onOpenBatchPhotoModal?: (data: {
    conceptTitle: string;
    clips: {
      id: number;
      title: string;
      timeRange: string;
      actionAndVO: string;
      aiPrompt: string;
    }[];
  }) => void;
}

export const ReplicaVideoResultCard: React.FC<ReplicaVideoResultCardProps> = ({
  data,
  rawMarkdownText,
  targetAI = 'general',
  segmentDuration = '5',
  maxDuration = 60,
  refImageFile,
  onSendToPhotoPrompt,
  onOpenBatchPhotoModal,
}) => {
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);

  const { viral_analysis, product_analysis, adapted_concept, seo, clips, request_meta } = data;

  const handleCopyCaption = () => {
    if (!seo.caption) return;
    navigator.clipboard.writeText(seo.caption.trim());
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyHashtags = () => {
    if (!seo.hashtags || seo.hashtags.length === 0) return;
    const textToCopy = seo.hashtags.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    navigator.clipboard.writeText(textToCopy);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  const handleCopySingleTag = (tag: string) => {
    const clean = tag.startsWith('#') ? tag : `#${tag}`;
    navigator.clipboard.writeText(clean);
    setCopiedTag(clean);
    setTimeout(() => setCopiedTag(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* 0. QUALITY CONTROL INTELLIGENCE BADGE & AUDIT SCORE */}
      {data.quality_control && (
        <QualityControlBadge qc={data.quality_control} />
      )}

      {/* 1. AGENT 1: RINGKASAN ANALISIS VIRAL & PRODUK */}
      {viral_analysis && product_analysis && (
        <ReplicaAnalysisSummaryCard
          viralAnalysis={viral_analysis}
          productAnalysis={product_analysis}
        />
      )}

      {/* 2. AGENT 2: KONSEP ADAPTASI VIDEO */}
      {adapted_concept && (
        <ReplicaConceptCard adaptedConcept={adapted_concept} />
      )}

      {/* 3. CAPTION SEO TIKTOK / REELS / SHORTS */}
      {seo?.caption && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-sky-600" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Caption SEO TikTok / Reels / Shorts
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyCaption}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedCaption ? 'Tersalin' : 'Salin Caption'}</span>
            </button>
          </div>
          <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-normal">
            {seo.caption}
          </p>
        </motion.div>
      )}

      {/* 4. HASHTAG RELEVAN PRODUK & NICHE (MAX 5-8 TAG, NO GENERIC) */}
      {seo?.hashtags && seo.hashtags.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-3"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <Hash className="w-4 h-4 text-sky-600" />
              <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                Hashtag Relevan Produk & Niche (Bukan Generik)
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyHashtags}
              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            >
              {copiedHashtags ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
              <span>{copiedHashtags ? 'Tersalin' : 'Salin Hashtag'}</span>
            </button>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
            {seo.hashtags.map((tag, tIdx) => {
              const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
              const isThisCopied = copiedTag === cleanTag;
              return (
                <button
                  key={tIdx}
                  type="button"
                  onClick={() => handleCopySingleTag(cleanTag)}
                  className="group px-3 py-1.5 rounded-lg bg-sky-50/80 hover:bg-sky-100 text-sky-700 border border-sky-200/60 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer"
                  title={`Salin ${cleanTag}`}
                >
                  <span>{cleanTag}</span>
                  {isThisCopied ? (
                    <Check className="w-3 h-3 text-emerald-600" />
                  ) : (
                    <Copy className="w-3 h-3 text-sky-400 group-hover:text-sky-600 opacity-70 group-hover:opacity-100 transition-opacity" />
                  )}
                </button>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* 5. HASIL SPLIT PROMPT VIDEO PER KLIP */}
      {clips && clips.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4 pt-1"
        >
          {/* Section Header */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pt-2">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-blue-600 shadow-2xs">
                <Film className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                  Hasil Split Prompt Video ({clips.length} Klip)
                </h4>
                <p className="text-xs text-slate-500 mt-0.5">
                  Dipecah per {request_meta?.split_duration_seconds || segmentDuration} detik • Total: {request_meta?.target_duration_seconds || maxDuration}s • Target AI: {targetAI.toUpperCase()}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
              {onOpenBatchPhotoModal && (
                <button
                  type="button"
                  onClick={() => {
                    onOpenBatchPhotoModal({
                      conceptTitle: adapted_concept?.concept_title || 'Replika Video Viral',
                      clips: clips.map((c) => ({
                        id: c.clip_number,
                        title: `Klip ${c.clip_number}`,
                        timeRange: c.duration_label || `${c.start_second}–${c.end_second} detik`,
                        actionAndVO: (c.scenes || []).map((s) => s.action).join('. '),
                        aiPrompt: c.master_prompt,
                      })),
                    });
                  }}
                  className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                  title="Generate prompt foto untuk seluruh klip ini sekaligus"
                >
                  <Camera className="w-4 h-4 text-slate-600" />
                  <span>Prompt Foto ({clips.length} Klip)</span>
                </button>
              )}

              <CopyAllButtons
                clips={clips}
                seo={seo}
                adaptedConcept={adapted_concept}
                rawMarkdownText={rawMarkdownText}
                totalDuration={request_meta?.target_duration_seconds || maxDuration}
                targetAI={targetAI}
              />
            </div>
          </div>

          {/* List of Clips */}
          <div className="space-y-4">
            {clips.map((clip) => (
              <ReplicaClipCard
                key={clip.clip_number}
                clip={clip}
                targetAI={targetAI}
                refImageFile={refImageFile}
                onSendToPhotoPrompt={onSendToPhotoPrompt}
              />
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

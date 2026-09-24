import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  FileText,
  Hash,
  Film,
  Copy,
  Check,
  Camera,
  Download,
  ListFilter,
  Sparkles,
  Sliders,
} from 'lucide-react';
import type { ParsedIdea } from './ContentIdeasTool';
import { ReplicaVideoResponse } from '@/src/types/viralReplicaContracts';
import { ReplicaVideoResultCard } from './replica/ReplicaVideoResultCard';

interface ViralReplicaOutputViewProps {
  parsedIdeas: ParsedIdea[];
  rawResult: string;
  structuredResult?: ReplicaVideoResponse | null;
  targetAI: string;
  segmentDuration: string;
  maxDuration: number;
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

export const ViralReplicaOutputView: React.FC<ViralReplicaOutputViewProps> = ({
  parsedIdeas,
  rawResult,
  structuredResult,
  targetAI,
  segmentDuration,
  maxDuration,
  refImageFile,
  onSendToPhotoPrompt,
  onOpenBatchPhotoModal,
}) => {
  const [activeIdeaIndex, setActiveIdeaIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [copiedAllPrompts, setCopiedAllPrompts] = useState(false);
  const [copiedClipKey, setCopiedClipKey] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [showStrategicDetails, setShowStrategicDetails] = useState(false);

  // Attempt to parse structured result from rawResult if not passed directly
  const resolvedStructured: ReplicaVideoResponse | null = useMemo(() => {
    if (structuredResult && structuredResult.clips && structuredResult.clips.length > 0) {
      return structuredResult;
    }
    if (rawResult && rawResult.trim().startsWith('{')) {
      try {
        const parsed = JSON.parse(rawResult.trim());
        if (parsed.clips && parsed.seo) {
          return parsed as ReplicaVideoResponse;
        }
      } catch (e) {
        // Not a pure JSON string
      }
    }
    return null;
  }, [structuredResult, rawResult]);

  // If structured data is available and user wants visual cards mode
  if (resolvedStructured && viewMode === 'cards') {
    return (
      <div className="space-y-6">
        <ReplicaVideoResultCard
          data={resolvedStructured}
          rawMarkdownText={rawResult}
          targetAI={targetAI}
          segmentDuration={segmentDuration}
          maxDuration={maxDuration}
          refImageFile={refImageFile}
          onSendToPhotoPrompt={onSendToPhotoPrompt}
          onOpenBatchPhotoModal={onOpenBatchPhotoModal}
        />

        <div className="flex items-center justify-end pt-2 text-xs">
          <button
            type="button"
            onClick={() => setViewMode('raw')}
            className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
          >
            <ListFilter className="w-3.5 h-3.5 text-slate-400" />
            <span>Format Markdown Asli</span>
          </button>
        </div>
      </div>
    );
  }

  if (!parsedIdeas || parsedIdeas.length === 0) {
    return (
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm">
        <div className="markdown-body text-slate-800 text-xs sm:text-sm leading-relaxed space-y-4">
          <ReactMarkdown>{rawResult}</ReactMarkdown>
        </div>
      </div>
    );
  }

  const currentIdea = parsedIdeas[activeIdeaIndex] || parsedIdeas[0];

  // Extract max 5 clean hashtags
  const hashtagChips = (
    currentIdea.hashtags
      ? (currentIdea.hashtags.match(/#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+/g) ||
          currentIdea.hashtags.split(/\s+/).filter(Boolean))
      : []
  ).slice(0, 5);

  // Clips to render
  const clipsToRender =
    currentIdea.clips && currentIdea.clips.length > 0
      ? currentIdea.clips
      : [
          {
            id: 1,
            timeRange: `0–${segmentDuration === 'auto' ? '10' : segmentDuration} detik`,
            title: 'Segmen 1',
            actionAndVO: currentIdea.scenePrompts,
            aiPrompt: currentIdea.scenePrompts,
          },
        ];

  // Copy single hashtag
  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  // Copy caption only
  const handleCopyCaption = () => {
    if (!currentIdea.caption) return;
    navigator.clipboard.writeText(currentIdea.caption.trim());
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  // Copy hashtags only
  const handleCopyHashtags = () => {
    if (!currentIdea.hashtags) return;
    const textToCopy = hashtagChips.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    navigator.clipboard.writeText(textToCopy);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  // Copy all clips prompts
  const handleCopyAllPrompts = () => {
    const combined = clipsToRender
      .map((clip) => {
        const p = (clip.aiPrompt || clip.actionAndVO || '').trim().replace(/^```(?:text)?\n?|```$/g, '');
        return `[Klip ${clip.id} - ${clip.timeRange}]\n${p}`;
      })
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(combined);
    setCopiedAllPrompts(true);
    setTimeout(() => setCopiedAllPrompts(false), 2500);
  };

  // Copy individual clip prompt
  const handleCopyClipPrompt = (clipId: number, text: string) => {
    const cleanText = text.trim().replace(/^```(?:text)?\n?|```$/g, '');
    navigator.clipboard.writeText(cleanText);
    const key = `clip_${clipId}`;
    setCopiedClipKey(key);
    setTimeout(() => setCopiedClipKey(null), 2000);
  };

  // Download idea as TXT
  const handleDownloadTxt = () => {
    const text = [
      `=== REPLIKA VIDEO VIRAL: ${currentIdea.title} ===`,
      `Target AI: ${targetAI.toUpperCase()}`,
      `Durasi Total: ${maxDuration} Detik\n`,
      `--- CAPTION SEO ---`,
      currentIdea.caption,
      `\n--- HASHTAG ---`,
      currentIdea.hashtags,
      `\n--- MASTER PROMPTS PER KLIP ---`,
      ...clipsToRender.map(
        (c) =>
          `\n[KLIP ${c.id} - ${c.timeRange}]\n${(c.aiPrompt || c.actionAndVO || '').trim().replace(/^```(?:text)?\n?|```$/g, '')}`
      ),
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `replika-video-${currentIdea.id || 1}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Concept Selector Tabs if multiple concepts */}
      {parsedIdeas.length > 1 && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          {parsedIdeas.map((idea, idx) => (
            <button
              key={idea.id || idx}
              type="button"
              onClick={() => setActiveIdeaIndex(idx)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-2 shrink-0 ${
                activeIdeaIndex === idx
                  ? 'bg-[#005ab3] text-white shadow-xs'
                  : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-200'
              }`}
            >
              <span>Konsep #{idea.id || idx + 1}</span>
              <span className="text-[11px] opacity-80 max-w-[140px] truncate">{idea.title}</span>
            </button>
          ))}
        </div>
      )}

      {viewMode === 'raw' ? (
        /* Markdown View */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Format Output Markdown Mentah
            </span>
            <button
              type="button"
              onClick={() => setViewMode('cards')}
              className="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-semibold cursor-pointer hover:bg-blue-100 transition-colors"
            >
              Kembali ke Tampilan Kartu
            </button>
          </div>
          <div className="markdown-body text-slate-800 text-xs sm:text-sm leading-relaxed space-y-4">
            <ReactMarkdown>{rawResult}</ReactMarkdown>
          </div>
        </div>
      ) : (
        /* Visual Cards View matching user's exact design */
        <div className="space-y-6">
          {/* 1. CAPTION SEO TIKTOK / REELS / SHORTS CARD */}
          {currentIdea.caption && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
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
                  {copiedCaption ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{copiedCaption ? 'Tersalin' : 'Salin Caption'}</span>
                </button>
              </div>
              <p className="text-slate-800 text-sm leading-relaxed whitespace-pre-wrap font-normal">
                {currentIdea.caption}
              </p>
            </motion.div>
          )}

          {/* 2. HASHTAG RELEVAN & SEO SEARCH (MAX 5 TAG) CARD */}
          {currentIdea.hashtags && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-sky-600" />
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Hashtag Relevan & SEO Search (Max 5 Tag)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyHashtags}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedHashtags ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{copiedHashtags ? 'Tersalin' : 'Salin Hashtag'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2.5 flex-wrap pt-0.5">
                {hashtagChips.map((tag, tIdx) => {
                  const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
                  const isThisCopied = copiedTag === cleanTag;
                  return (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => handleCopyTag(cleanTag)}
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

          {/* 3. HASIL SPLIT PROMPT VIDEO SECTION */}
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
                    Hasil Split Prompt Video
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Dipecah per {segmentDuration === 'auto' ? '10 detik' : `${segmentDuration} detik`} • Target: {targetAI.toUpperCase()}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap self-end sm:self-auto">
                {onOpenBatchPhotoModal && (
                  <button
                    type="button"
                    onClick={() => {
                      onOpenBatchPhotoModal({
                        conceptTitle: currentIdea.title,
                        clips: clipsToRender.map((c) => ({
                          id: c.id,
                          title: c.title,
                          timeRange: c.timeRange,
                          actionAndVO: c.actionAndVO,
                          aiPrompt: c.aiPrompt,
                        })),
                      });
                    }}
                    className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                    title="Generate prompt foto untuk seluruh klip ini sekaligus"
                  >
                    <Camera className="w-4 h-4 text-slate-600" />
                    <span>Generate Semua Prompt Foto ({clipsToRender.length} Klip)</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={handleCopyAllPrompts}
                  className="px-4 py-2 rounded-xl bg-[#005ab3] hover:bg-[#004d9c] text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
                >
                  {copiedAllPrompts ? (
                    <Check className="w-4 h-4 text-emerald-200" />
                  ) : (
                    <Copy className="w-4 h-4 text-white" />
                  )}
                  <span>
                    {copiedAllPrompts ? 'Tersalin' : `Salin Semua ${clipsToRender.length} Prompt`}
                  </span>
                </button>
              </div>
            </div>

            {/* Clip Cards List */}
            <div className="space-y-4">
              {clipsToRender.map((clip, cIdx) => {
                const clipKey = `clip_${clip.id}`;
                const isCopied = copiedClipKey === clipKey;
                const promptText = (clip.aiPrompt || clip.actionAndVO || '')
                  .trim()
                  .replace(/^```(?:text)?\n?|```$/g, '');

                return (
                  <div
                    key={clip.id || cIdx}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3.5 hover:border-slate-300 transition-all"
                  >
                    {/* Card Top Row */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pb-2 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">
                          #{clip.id}
                        </span>
                        <span className="text-sm sm:text-base font-bold text-slate-900">
                          Segmen Prompt Klip {clip.id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
                          {clip.timeRange}
                        </span>
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {onSendToPhotoPrompt && (
                          <button
                            type="button"
                            onClick={() => {
                              let promptToPass = `Visual adegan klip [${clip.timeRange}]: ${promptText}`;
                              const negMatch = promptText.match(
                                /\[Negative Prompt\]:\s*([\s\S]*?)(?=\n\[|$)/i
                              );
                              let negPrompt = '';
                              if (negMatch && negMatch[1]) {
                                negPrompt = negMatch[1].trim();
                                promptToPass += `\n\nNegative Prompt: ${negPrompt}`;
                              }
                              onSendToPhotoPrompt(promptToPass, {
                                negativePrompt: negPrompt || undefined,
                                referenceImage: refImageFile || undefined,
                              });
                            }}
                            className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Camera className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ke Prompt Foto</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyClipPrompt(clip.id, promptText)}
                          className="px-3 py-1.5 rounded-lg bg-blue-50/70 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                        >
                          {isCopied ? (
                            <Check className="w-3.5 h-3.5 text-emerald-600" />
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-blue-600" />
                          )}
                          <span>{isCopied ? 'Tersalin' : 'Salin Prompt Klip'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Subheader Label */}
                    <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                      <Sparkles className="w-3 h-3 text-slate-400" />
                      <span>Master Prompt AI Klip {clip.id} (Siap Copy)</span>
                    </div>

                    {/* Prompt Body Box */}
                    <div className="p-4 sm:p-5 rounded-xl bg-[#f8fafc] border border-slate-100 text-slate-800 text-sm leading-relaxed whitespace-pre-wrap select-text font-normal">
                      {promptText}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* Bottom Utilities & Expandable Strategic Details */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs border-t border-slate-200/80">
            <button
              type="button"
              onClick={() => setShowStrategicDetails(!showStrategicDetails)}
              className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
            >
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>
                {showStrategicDetails
                  ? 'Sembunyikan Riset & Detail AEO'
                  : 'Lihat Riset & Detail AEO (Angle, Audiens, BLUFF Hook)'}
              </span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setViewMode('raw')}
                className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <ListFilter className="w-3.5 h-3.5 text-slate-400" />
                <span>Format Markdown Asli</span>
              </button>

              <button
                type="button"
                onClick={handleDownloadTxt}
                className="text-slate-500 hover:text-slate-900 flex items-center gap-1.5 font-medium transition-colors cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-slate-400" />
                <span>Unduh (.TXT)</span>
              </button>
            </div>
          </div>

          {/* Collapsible Strategic Details if user expands */}
          {showStrategicDetails && (
            <motion.div
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 rounded-2xl bg-white border border-slate-200 space-y-3 text-xs"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {currentIdea.typeAndAngle && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-indigo-700 tracking-wider">
                      Tipe & Angle
                    </span>
                    <p className="text-slate-800 font-medium">{currentIdea.typeAndAngle}</p>
                  </div>
                )}
                {currentIdea.targetAudience && (
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 space-y-1">
                    <span className="text-[10px] uppercase font-bold text-emerald-700 tracking-wider">
                      Target Audiens
                    </span>
                    <p className="text-slate-800 font-medium">{currentIdea.targetAudience}</p>
                  </div>
                )}
              </div>
              {currentIdea.hook && (
                <div className="p-3.5 rounded-xl bg-amber-50/60 border border-amber-200/60 space-y-1">
                  <span className="text-[10px] uppercase font-bold text-amber-800 tracking-wider">
                    BLUFF Hook (0–3 Detik)
                  </span>
                  <p className="text-amber-950 font-bold italic">"{currentIdea.hook}"</p>
                </div>
              )}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
};
export default ViralReplicaOutputView;

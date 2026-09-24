import React, { useState } from 'react';
import { Copy, Check, Camera, Sparkles, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { ReplicaClip } from '@/src/types/viralReplicaContracts';
import { SceneBreakdownCard } from './SceneBreakdownCard';

interface ReplicaClipCardProps {
  clip: ReplicaClip;
  targetAI?: string;
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
}

export const ReplicaClipCard: React.FC<ReplicaClipCardProps> = ({
  clip,
  targetAI = 'general',
  refImageFile,
  onSendToPhotoPrompt,
}) => {
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [copiedBreakdown, setCopiedBreakdown] = useState(false);
  const [showScenes, setShowScenes] = useState(true);

  const durationStr = clip.duration_label || `${clip.start_second}–${clip.end_second} detik`;
  const cleanPrompt = (clip.master_prompt || '').trim().replace(/^```(?:text)?\n?|```$/g, '');

  const handleCopyPrompt = () => {
    navigator.clipboard.writeText(cleanPrompt);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 2000);
  };

  const handleCopyBreakdown = () => {
    const textToCopy = clip.copy_text_full || [
      `=== SEGMENT PROMPT KLIP ${clip.clip_number} (${durationStr}) ===`,
      `[Master Prompt AI Video (${targetAI.toUpperCase()})]:`,
      cleanPrompt,
      `\n[Breakdown Scene]:`,
      ...(clip.scenes || []).map((s) => s.copy_text_scene || `Scene ${s.scene_number} (${s.start_second}-${s.end_second}s): ${s.visual}`),
    ].join('\n\n');

    navigator.clipboard.writeText(textToCopy);
    setCopiedBreakdown(true);
    setTimeout(() => setCopiedBreakdown(false), 2000);
  };

  return (
    <div className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/90 shadow-xs space-y-4 hover:border-slate-300 transition-all">
      {/* Top Header Row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5 flex-wrap">
          <span className="px-2.5 py-0.5 rounded-lg bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100 shadow-2xs">
            #{clip.clip_number}
          </span>
          <h4 className="text-sm sm:text-base font-bold text-slate-900">
            Segmen Prompt Klip {clip.clip_number}
          </h4>
          <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium">
            {durationStr}
          </span>
        </div>

        {/* Action Buttons for this clip */}
        <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
          {onSendToPhotoPrompt && (
            <button
              type="button"
              onClick={() => {
                let promptToPass = `Visual adegan klip [${durationStr}]: ${cleanPrompt}`;
                const negMatch = cleanPrompt.match(/\[Negative Prompt\]:\s*([\s\S]*?)(?=\n\[|$)/i);
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
              <span className="hidden sm:inline">Ke Prompt Foto</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleCopyBreakdown}
            className="px-3 py-1.5 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
            title="Salin Prompt + Breakdown Scene Klip Ini"
          >
            {copiedBreakdown ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Layers className="w-3.5 h-3.5 text-slate-500" />}
            <span>{copiedBreakdown ? 'Tersalin' : 'Salin Breakdown Klip'}</span>
          </button>

          <button
            type="button"
            onClick={handleCopyPrompt}
            className="px-3.5 py-1.5 rounded-lg bg-blue-50/80 hover:bg-blue-100 border border-blue-200 text-blue-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
          >
            {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
            <span>{copiedPrompt ? 'Tersalin' : 'Salin Prompt Klip'}</span>
          </button>
        </div>
      </div>

      {/* Master Prompt Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5 text-blue-600" />
          <span>Master Prompt AI Klip {clip.clip_number} ({targetAI.toUpperCase()})</span>
        </div>

        <div className="p-4 sm:p-4.5 rounded-xl bg-[#f8fafc] border border-slate-200/80 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text font-normal">
          {cleanPrompt}
        </div>
      </div>

      {/* Scene Breakdown within this clip */}
      {clip.scenes && clip.scenes.length > 0 && (
        <div className="space-y-3 pt-1">
          <button
            type="button"
            onClick={() => setShowScenes(!showScenes)}
            className="flex items-center gap-2 text-xs font-bold text-slate-700 hover:text-slate-900 cursor-pointer select-none"
          >
            <span>Rincian Adegan Klip ({clip.scenes.length} Scene)</span>
            {showScenes ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>

          {showScenes && (
            <div className="space-y-2.5 pl-0 sm:pl-2 border-l-0 sm:border-l-2 sm:border-slate-100">
              {clip.scenes.map((scene) => (
                <SceneBreakdownCard key={scene.scene_number} scene={scene} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

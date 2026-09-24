import React, { useState } from 'react';
import { Copy, Check, Eye, Move, Video, Volume2, Type, MessageSquare, Target } from 'lucide-react';
import { ReplicaScene } from '@/src/types/viralReplicaContracts';

interface SceneBreakdownCardProps {
  scene: ReplicaScene;
}

export const SceneBreakdownCard: React.FC<SceneBreakdownCardProps> = ({ scene }) => {
  const [copied, setCopied] = useState(false);

  const handleCopyScene = () => {
    const textToCopy = scene.copy_text_scene || [
      `[Scene ${scene.scene_number} (${scene.start_second}–${scene.end_second}s)]`,
      `Visual: ${scene.visual}`,
      `Aksi: ${scene.action}`,
      `Kamera: ${scene.camera}`,
      `Audio: ${scene.audio}`,
      scene.text_overlay ? `Text Overlay: "${scene.text_overlay}"` : '',
      scene.dialogue_or_subtitle ? `Voice Over: "${scene.dialogue_or_subtitle}"` : '',
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="p-3.5 sm:p-4 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2.5 text-xs hover:border-slate-300 transition-colors">
      <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[11px]">
            Scene {scene.scene_number}
          </span>
          <span className="text-[11px] text-slate-500 font-medium">
            {scene.start_second}–{scene.end_second} detik
          </span>
          {scene.scene_goal && (
            <span className="px-2 py-0.5 rounded-full bg-slate-50 text-slate-600 text-[10px] hidden sm:inline-flex items-center gap-1 border border-slate-200">
              <Target className="w-2.5 h-2.5 text-slate-400" /> {scene.scene_goal}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={handleCopyScene}
          className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 text-slate-600 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer border border-slate-200 shadow-2xs"
          title="Salin Rincian Scene Ini"
        >
          {copied ? <Check className="w-3 h-3 text-emerald-600" /> : <Copy className="w-3 h-3 text-slate-400" />}
          <span>{copied ? 'Tersalin' : 'Salin Scene'}</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-[11px]">
        <div className="space-y-1.5">
          <div className="flex items-start gap-1.5 text-slate-700">
            <Eye className="w-3.5 h-3.5 text-blue-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Visual:</strong> {scene.visual}
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-slate-700">
            <Move className="w-3.5 h-3.5 text-indigo-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Aksi:</strong> {scene.action}
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-start gap-1.5 text-slate-700">
            <Video className="w-3.5 h-3.5 text-purple-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Kamera:</strong> {scene.camera}
            </div>
          </div>

          <div className="flex items-start gap-1.5 text-slate-700">
            <Volume2 className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <strong className="text-slate-800">Audio:</strong> {scene.audio}
            </div>
          </div>
        </div>
      </div>

      {(scene.text_overlay || scene.dialogue_or_subtitle) && (
        <div className="pt-1.5 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
          {scene.text_overlay && (
            <div className="p-2 rounded-lg bg-amber-50/50 border border-amber-100 flex items-start gap-1.5 text-amber-900">
              <Type className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-amber-950 font-semibold block text-[10px] uppercase">Text Overlay</strong>
                "{scene.text_overlay}"
              </div>
            </div>
          )}

          {scene.dialogue_or_subtitle && (
            <div className="p-2 rounded-lg bg-blue-50/50 border border-blue-100 flex items-start gap-1.5 text-blue-900">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-950 font-semibold block text-[10px] uppercase">Voice Over</strong>
                "{scene.dialogue_or_subtitle}"
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

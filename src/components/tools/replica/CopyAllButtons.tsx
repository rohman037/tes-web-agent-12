import React, { useState } from 'react';
import { Copy, Check, Download, FileText } from 'lucide-react';
import { ReplicaClip, SeoData, AdaptedConceptData } from '@/src/types/viralReplicaContracts';

interface CopyAllButtonsProps {
  clips: ReplicaClip[];
  seo: SeoData;
  adaptedConcept: AdaptedConceptData;
  rawMarkdownText?: string;
  totalDuration: number;
  targetAI?: string;
}

export const CopyAllButtons: React.FC<CopyAllButtonsProps> = ({
  clips,
  seo,
  adaptedConcept,
  rawMarkdownText,
  totalDuration,
  targetAI = 'general',
}) => {
  const [copiedAllPrompts, setCopiedAllPrompts] = useState(false);
  const [copiedFullDoc, setCopiedFullDoc] = useState(false);

  const handleCopyAllPrompts = () => {
    const text = clips
      .map((clip) => {
        const dur = clip.duration_label || `${clip.start_second}–${clip.end_second} detik`;
        const prompt = (clip.master_prompt || '').trim().replace(/^```(?:text)?\n?|```$/g, '');
        return `[Klip ${clip.clip_number} - ${dur}]\n${prompt}`;
      })
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(text);
    setCopiedAllPrompts(true);
    setTimeout(() => setCopiedAllPrompts(false), 2000);
  };

  const handleCopyFullDoc = () => {
    if (rawMarkdownText) {
      navigator.clipboard.writeText(rawMarkdownText);
    } else {
      const full = [
        `=== REPLIKA VIDEO VIRAL: ${adaptedConcept.concept_title} ===`,
        `Durasi Total: ${totalDuration} Detik • Target AI: ${targetAI.toUpperCase()}`,
        `\n--- CAPTION SEO ---`,
        seo.caption,
        `\n--- HASHTAG RELEVAN ---`,
        seo.hashtags.join(' '),
        `\n--- MASTER PROMPTS PER KLIP ---`,
        ...clips.map((c) => c.copy_text_full || c.master_prompt),
      ].join('\n\n');
      navigator.clipboard.writeText(full);
    }

    setCopiedFullDoc(true);
    setTimeout(() => setCopiedFullDoc(false), 2000);
  };

  const handleDownloadTxt = () => {
    const fullText = rawMarkdownText || [
      `=== REPLIKA VIDEO VIRAL: ${adaptedConcept.concept_title} ===`,
      `Durasi Total: ${totalDuration} Detik • Target AI: ${targetAI.toUpperCase()}`,
      `\n--- CAPTION SEO ---`,
      seo.caption,
      `\n--- HASHTAG RELEVAN ---`,
      seo.hashtags.join(' '),
      `\n--- MASTER PROMPTS PER KLIP ---`,
      ...clips.map((c) => c.copy_text_full || c.master_prompt),
    ].join('\n\n');

    const blob = new Blob([fullText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Replika_Video_${adaptedConcept.concept_title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex items-center gap-2.5 flex-wrap">
      <button
        type="button"
        onClick={handleCopyAllPrompts}
        className="px-4 py-2 rounded-xl bg-[#005ab3] hover:bg-[#004d9c] text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
      >
        {copiedAllPrompts ? <Check className="w-4 h-4 text-emerald-200" /> : <Copy className="w-4 h-4 text-white" />}
        <span>{copiedAllPrompts ? 'Tersalin' : `Salin Semua ${clips.length} Prompt Klip`}</span>
      </button>

      <button
        type="button"
        onClick={handleCopyFullDoc}
        className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
        title="Salin seluruh dokumen mencakup analisis, caption, hashtag, dan prompt"
      >
        {copiedFullDoc ? <Check className="w-4 h-4 text-emerald-600" /> : <FileText className="w-4 h-4 text-slate-500" />}
        <span>{copiedFullDoc ? 'Tersalin' : 'Salin Semua'}</span>
      </button>

      <button
        type="button"
        onClick={handleDownloadTxt}
        className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
        title="Unduh sebagai file .TXT"
      >
        <Download className="w-4 h-4 text-slate-500" />
        <span>Unduh (.TXT)</span>
      </button>
    </div>
  );
};

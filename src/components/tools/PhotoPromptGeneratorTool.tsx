import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, Sparkles, Copy, Check, Loader2, AlertCircle, RefreshCw, Wand2, Sliders, FileText, Cpu, Layers, Share2, Eye, Download, ChevronDown, ChevronUp, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Markdown from 'react-markdown';
import { getAntiLimitHeaders } from '../../lib/antiLimit';
import { saveHistoryItem } from '../../lib/history';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { useGenerationLog } from '../../hooks/useGenerationLog';
import { reportActiveGenerationStatus } from '../../events/generationEvent';
import EngagingLoadingState from '../common/EngagingLoadingState';

export interface PhotoPromptClipItem {
  id: number;
  timeRange: string;
  title: string;
  promptText: string;
  analysis?: string;
  sourceText?: string;
}

export interface PhotoPromptBatchResult {
  isBatch: boolean;
  conceptTitle: string;
  clips: PhotoPromptClipItem[];
  commonNegativePrompt?: string;
}

interface PhotoPromptGeneratorToolProps {
  initialConcept?: string;
  initialNegativePrompt?: string;
  initialReferenceImage?: File | null;
  initialSubjectReference?: string;
  initialProductReference?: string;
  autoGenerate?: boolean;
  initialAspectRatio?: string;
  initialPhotoStyle?: string;
  initialTargetGenerator?: string;
}

const cleanPromptText = (text: string): string => {
  if (!text) return '';
  return text
    .replace(/^```(?:text|markdown)?\s*/i, '')
    .replace(/```$/i, '')
    .replace(/^\[.*?Photorealistic Master Engine\]\s*/i, '')
    .replace(/^\[.*?Nano Banana.*?\]\s*/i, '')
    .trim();
};

function parsePhotoPromptOutput(rawText: string | null) {
  if (!rawText) {
    return {
      nanobananapro: '',
      analysis: '',
      isMultiClip: false,
      clips: [] as { id: number; title: string; timeRange: string; prompt: string; raw: string }[],
    };
  }

  const cleanCodeFence = (text: string): string => {
    if (!text) return '';
    const match = text.match(/```(?:text|markdown)?\s*\n?([\s\S]*?)\n?```/i);
    if (match && match[1]) {
      return match[1].trim();
    }
    return text.replace(/```(?:text|markdown)?/gi, '').replace(/```/g, '').trim();
  };

  // Check if rawText contains multi-clip sections (e.g. "### 🎬 KLIP 1", "### KLIP 1", "### Klip 1")
  const clipHeaderRegex = /###\s*(?:🎬\s*)?(?:KLIP|Klip|Clip|Segmen)\s*(\d+)[:\s\-—]*([^\n]*)/gi;
  const matches = Array.from(rawText.matchAll(clipHeaderRegex));

  const parsedClips: { id: number; title: string; timeRange: string; prompt: string; raw: string }[] = [];

  if (matches.length > 0) {
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const clipId = parseInt(match[1], 10) || (i + 1);
      const rawHeaderExtra = match[2] || '';
      
      const startIndex = match.index! + match[0].length;
      const nextMatch = matches[i + 1];
      const endIndex = nextMatch ? nextMatch.index! : rawText.length;
      
      const block = rawText.slice(startIndex, endIndex).trim();
      
      // Extract timeRange if present (e.g. "(00:00 - 00:05)" or "[00:00 - 00:05]")
      const timeMatch = rawHeaderExtra.match(/[\(\[]\s*(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\s*[\)\]]/) || block.match(/[\(\[]\s*(\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2})\s*[\)\]]/);
      const timeRange = timeMatch ? timeMatch[1].trim() : `Klip ${clipId}`;
      
      const cleanTitle = rawHeaderExtra
        .replace(/[\(\[]\s*\d{1,2}:\d{2}\s*-\s*\d{1,2}:\d{2}\s*[\)\]]/g, '')
        .replace(/^[\s\-—:]+/, '')
        .trim() || `Visual Klip ${clipId}`;

      const promptCode = cleanCodeFence(block);

      parsedClips.push({
        id: clipId,
        title: cleanTitle,
        timeRange,
        prompt: cleanPromptText(promptCode || block),
        raw: block,
      });
    }
  }

  const sections = rawText.split(/(?=###|\n---)/);

  let nanobananapro = '';
  let analysis = '';

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;

    if (/TIKTOK|GOOGLE|AEO|NANO BANANA|MASTER PROMPT|IMAGEN|AI PROMPT/i.test(trimmed) && !/ANALISIS/i.test(trimmed)) {
      nanobananapro = cleanCodeFence(trimmed);
    } else if (/ANALISIS/i.test(trimmed)) {
      analysis = trimmed
        .replace(/^(?:###|---|\s)*.*ANALISIS.*$/im, '')
        .trim();
    }
  }

  if (!nanobananapro && parsedClips.length === 0) {
    const nanoMatch = rawText.match(/(?:TIKTOK|GOOGLE|AEO|MASTER PROMPT)[\s\S]*?```(?:text)?\s*([\s\S]*?)```/i);
    if (nanoMatch) nanobananapro = nanoMatch[1].trim();
  }
  if (!analysis) {
    const analMatch = rawText.match(/ANALISIS(?: MENDALAM RELEVANSI SCENE & ALGORITMA| ESTETIKA & RELEVANSI TIKTOK| DETAIL VISUAL FOTO| KONTEN & KONSISTENSI VISUAL BATCH)[\s\S]*?(?=\n###|\n---|$)/i);
    if (analMatch) {
      analysis = analMatch[0].replace(/.*ANALISIS.*/i, '').trim();
    }
  }

  if (!nanobananapro && parsedClips.length === 0) {
    const codeBlocks = rawText.match(/```(?:text|markdown)?\s*([\s\S]*?)```/gi);
    if (codeBlocks && codeBlocks.length > 0) {
      nanobananapro = cleanCodeFence(codeBlocks[0]);
    } else {
      nanobananapro = rawText.trim();
    }
  }

  return {
    nanobananapro: cleanPromptText(nanobananapro || (parsedClips.length === 0 ? rawText : '')),
    analysis: analysis || '',
    isMultiClip: parsedClips.length > 0,
    clips: parsedClips,
  };
}

export default function PhotoPromptGeneratorTool({
  initialConcept,
  initialNegativePrompt,
  initialReferenceImage,
  initialSubjectReference,
  initialProductReference,
  autoGenerate,
  initialAspectRatio,
  initialPhotoStyle,
  initialTargetGenerator,
}: PhotoPromptGeneratorToolProps) {
  const { logGeneration } = useGenerationLog();
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);
  const [textInput, setTextInput] = useState<string>('');
  const [negativeTextInput, setNegativeTextInput] = useState<string>('');
  const [subjectReference, setSubjectReference] = useState<string>(initialSubjectReference || '');
  const [productReference, setProductReference] = useState<string>(initialProductReference || '');

  // Configuration options
  const [targetGenerator, setTargetGenerator] = useState<string>(initialTargetGenerator || 'nanobananapro');
  const [photoStyle, setPhotoStyle] = useState<string>(initialPhotoStyle || 'commercial');
  const [aspectRatio, setAspectRatio] = useState<string>(initialAspectRatio || '--ar 9:16');

  // State for generation
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [generatedPrompt, setGeneratedPrompt] = useState<string | null>(null);
  const [activeModelUsed, setActiveModelUsed] = useState<string | null>(null);
  const [tierUsed, setTierUsed] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isAnalysisOpen, setIsAnalysisOpen] = useState<boolean>(false);

  // Copy state trackers
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [copiedClipId, setCopiedClipId] = useState<number | null>(null);
  const [copiedAllClips, setCopiedAllClips] = useState<boolean>(false);

  const hasAutoGeneratedRef = useRef<boolean>(false);

  useEffect(() => {
    let combinedText = '';
    if (initialConcept && initialConcept.trim()) {
      combinedText = initialConcept.trim();
    }
    
    if (combinedText) {
      setTextInput(combinedText);
    }

    if (initialNegativePrompt && initialNegativePrompt.trim()) {
      setNegativeTextInput(initialNegativePrompt.trim());
    }

    if (initialSubjectReference && initialSubjectReference.trim()) {
      setSubjectReference(initialSubjectReference.trim());
    }

    if (initialProductReference && initialProductReference.trim()) {
      setProductReference(initialProductReference.trim());
    }

    if (initialReferenceImage) {
      setImageFile(initialReferenceImage);
      setImagePreviewUrl(URL.createObjectURL(initialReferenceImage));
    }

    if (initialAspectRatio) {
      setAspectRatio(initialAspectRatio);
    }
    if (initialPhotoStyle) {
      setPhotoStyle(initialPhotoStyle);
    }
    if (initialTargetGenerator) {
      setTargetGenerator(initialTargetGenerator);
    }

    if (autoGenerate && combinedText && !hasAutoGeneratedRef.current) {
      hasAutoGeneratedRef.current = true;
      setTimeout(() => {
        handleGeneratePhotoPromptWithText(
          combinedText,
          initialNegativePrompt,
          initialReferenceImage,
          initialAspectRatio,
          initialPhotoStyle,
          initialTargetGenerator,
          initialSubjectReference,
          initialProductReference
        );
      }, 200);
    }
  }, [initialConcept, initialNegativePrompt, initialReferenceImage, initialSubjectReference, initialProductReference, autoGenerate, initialAspectRatio, initialPhotoStyle, initialTargetGenerator]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Gagal mengonversi file gambar'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGeneratePhotoPromptWithText = async (
    overrideText?: string,
    overrideNeg?: string,
    overrideRefImg?: File | null,
    overrideAr?: string,
    overrideStyle?: string,
    overrideGen?: string,
    overrideSubjRef?: string,
    overrideProdRef?: string
  ) => {
    setIsGenerating(true);
    setError(null);
    const startTime = Date.now();
    const activeId = `gen_photo_${Date.now()}`;
    const targetText = overrideText || textInput;
    const effectiveAr = overrideAr || aspectRatio;
    const effectiveStyle = overrideStyle || photoStyle;
    const effectiveGen = overrideGen || targetGenerator;
    const effectiveSubj = overrideSubjRef !== undefined ? overrideSubjRef : subjectReference;
    const effectiveProd = overrideProdRef !== undefined ? overrideProdRef : productReference;

    const titleName = targetText.slice(0, 40) + '...';
    reportActiveGenerationStatus(activeId, 'generating', `Prompt Foto Multi-Klip (${effectiveGen})`);

    try {
      if (!targetText.trim()) {
        setError('Silakan ketik deskripsi atau konsep foto yang ingin dibuat.');
        setIsGenerating(false);
        reportActiveGenerationStatus(activeId, 'completed');
        return;
      }

      const mimeType = 'text/plain';
      const base64Data = btoa(unescape(encodeURIComponent(targetText)));
      let referenceImageBase64: string | undefined = undefined;
      let referenceImageMimeType: string | undefined = undefined;

      const activeRefImg = overrideRefImg !== undefined ? overrideRefImg : imageFile;
      if (activeRefImg) {
        referenceImageBase64 = await fileToBase64(activeRefImg);
        referenceImageMimeType = activeRefImg.type;
      }

      const response = await fetch('/api/generate-photo-prompt', {
        method: 'POST',
        headers: getAntiLimitHeaders(),
        body: JSON.stringify({
          mimeType,
          base64Data,
          subjectReference: effectiveSubj.trim() || undefined,
          productReference: effectiveProd.trim() || undefined,
          model: 'auto',
          targetGenerator: effectiveGen,
          photoStyle: effectiveStyle,
          aspectRatio: effectiveAr,
          negativePrompt: overrideNeg || negativeTextInput,
          referenceImageBase64,
          referenceImageMimeType,
        }),
      });

      const data = await safeParseJson(response);

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Terjadi kesalahan saat membuat prompt foto.');
      }

      if (!data.prompt) {
        throw new Error('Hasil prompt foto kosong. Silakan coba lagi.');
      }

      setGeneratedPrompt(data.prompt);
      setActiveModelUsed(data.modelUsed || 'Auto-Routing');
      setTierUsed(data.tierUsed || null);
      setLatencyMs(data.latencyMs || null);

      reportActiveGenerationStatus(activeId, 'completed');

      logGeneration({
        tool: 'prompt_foto',
        productName: titleName,
        caption: data.prompt,
        topic: titleName,
        toneOfVoice: photoStyle,
        modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
        latencyMs: Date.now() - startTime,
        outcome: 'success',
      });

      learningSync.track('photo_prompt_generated', {
        targetGenerator,
        photoStyle,
        aspectRatio,
        title: targetText.slice(0, 30),
      });

      saveHistoryItem({
        category: 'photo_prompt',
        title: `Prompt Foto: ${titleName}`,
        subtitle: `${targetGenerator.toUpperCase()} • ${photoStyle.toUpperCase()} • ${aspectRatio}`,
        data: {
          prompt: data.prompt,
          modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
          targetGenerator,
          photoStyle,
          aspectRatio,
          sourceText: targetText,
        },
      });
    } catch (err: any) {
      console.error(err);
      const errMsg = err.message || 'Terjadi kesalahan saat membuat prompt foto.';
      setError(errMsg);
      reportActiveGenerationStatus(activeId, 'completed');
      logGeneration({
        tool: 'prompt_foto',
        productName: titleName,
        topic: titleName,
        toneOfVoice: photoStyle,
        latencyMs: Date.now() - startTime,
        outcome: 'error',
        errorMessage: errMsg,
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleGeneratePhotoPrompt = () => {
    return handleGeneratePhotoPromptWithText();
  };

  const resetImage = () => {
    setImageFile(null);
    if (imagePreviewUrl) URL.revokeObjectURL(imagePreviewUrl);
    setImagePreviewUrl(null);
    setGeneratedPrompt(null);
    setError(null);
  };

  const handleCopyOnlyPrompt = (promptText: string, sectionKey: string) => {
    if (!promptText) return;
    const cleaned = cleanPromptText(promptText);

    navigator.clipboard.writeText(cleaned);
    setCopiedSection(sectionKey);

    learningSync.track('prompt_copied', {
      type: 'photo_prompt',
      label: sectionKey,
      text: cleaned,
    });

    setTimeout(() => setCopiedSection(null), 2000);
  };

  const handleCopyClipPrompt = (clip: { id: number; title: string; timeRange: string; prompt: string }) => {
    const textToCopy = `[PROMPT FOTO AI - KLIP ${clip.id} (${clip.timeRange})]\n${clip.prompt}`;
    navigator.clipboard.writeText(clip.prompt || textToCopy);
    setCopiedClipId(clip.id);

    learningSync.track('prompt_clip_copied', {
      type: 'photo_clip_prompt',
      clipIndex: clip.id,
      promptSnippet: clip.prompt.slice(0, 100),
      text: clip.prompt,
    });

    setTimeout(() => setCopiedClipId(null), 2000);
  };

  const handleCopyAllBatchPrompts = (clips: { id: number; title: string; timeRange: string; prompt: string }[]) => {
    const allFormatted = clips
      .map((c) => `========================================\n📸 KLIP ${c.id} (${c.timeRange}): ${c.title.toUpperCase()}\n========================================\n${c.prompt}\n`)
      .join('\n');

    navigator.clipboard.writeText(allFormatted);
    setCopiedAllClips(true);

    learningSync.track('prompt_copied', {
      type: 'batch_photo_prompts_all',
      totalClips: clips.length,
      text: allFormatted,
    });

    setTimeout(() => setCopiedAllClips(false), 2000);
  };

  const handleDownloadClipsAsTxt = (clips: { id: number; title: string; timeRange: string; prompt: string }[]) => {
    const textContent = `==================================================
BATCH PROMPT FOTO AI MULTI-KLIP (SIAP GENERATE)
==================================================
Target Generator: ${targetGenerator.toUpperCase()}
Gaya Visual: ${photoStyle.toUpperCase()}
Aspect Ratio: ${aspectRatio}
Jumlah Klip: ${clips.length} Klip
Waktu Dibuat: ${new Date().toLocaleString('id-ID')}
==================================================

` + clips.map(c => `--------------------------------------------------
📸 KLIP ${c.id} [${c.timeRange}]: ${c.title.toUpperCase()}
--------------------------------------------------
${c.prompt}
`).join('\n\n');

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Batch_Prompt_Foto_${clips.length}_Klip_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Main Form & Configuration */}
      <div className="space-y-5 rounded-2xl bg-white border border-slate-200/80 p-5 sm:p-6 shadow-sm">
        {/* Text Concept Input */}
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-[#5b50e5]" /> Konsep / Deskripsi Ide Foto
            </label>
            <textarea
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Ketik deskripsi ide foto secara bebas (contoh: 'Model pria mengenakan kemeja linen putih santai di pantai Bali saat matahari terbenam...')"
              rows={4}
              className="w-full p-4 rounded-xl bg-white border border-slate-200 text-xs sm:text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 leading-relaxed"
            />
          </div>
          {imagePreviewUrl && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img src={imagePreviewUrl} alt="Reference" className="w-10 h-10 object-cover rounded-lg border border-slate-300" />
                <div className="text-xs">
                  <p className="font-bold text-slate-900">Reference Image Terlampir</p>
                  <p className="text-slate-500">Akan digunakan sebagai Identity Anchor</p>
                </div>
              </div>
              <button
                type="button"
                onClick={resetImage}
                className="text-xs text-rose-600 hover:text-rose-700 font-semibold px-2 py-1 rounded hover:bg-rose-50 cursor-pointer"
              >
                Hapus
              </button>
            </div>
          )}
        </div>

        {/* Target Aspect Ratio */}
        <div className="space-y-2 pt-3 border-t border-slate-100">
          <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-[#5b50e5]" /> Rasio Foto (Aspect Ratio)
          </label>
          <div className="grid grid-cols-5 gap-1 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-semibold max-w-lg">
            {[
              { id: '--ar 16:9', label: '16:9' },
              { id: '--ar 9:16', label: '9:16' },
              { id: '--ar 1:1', label: '1:1' },
              { id: '--ar 4:5', label: '4:5' },
              { id: '--ar 21:9', label: '21:9' },
            ].map((ar) => (
              <button
                type="button"
                key={ar.id}
                onClick={() => setAspectRatio(ar.id)}
                className={`py-1.5 rounded-lg text-center transition-all cursor-pointer ${
                  aspectRatio === ar.id
                    ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {ar.label}
              </button>
            ))}
          </div>
        </div>

        {/* Action Generate Button */}
        <button
          type="button"
          onClick={handleGeneratePhotoPrompt}
          disabled={isGenerating || !textInput.trim()}
          className="w-full py-3.5 px-6 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] disabled:bg-slate-200 disabled:text-slate-400 text-white font-bold flex items-center justify-center gap-2.5 transition-all shadow-md shadow-[#5b50e5]/20 cursor-pointer"
        >
          {isGenerating ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Menganalisis & Membuat Prompt Foto Sinematik...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-amber-300" />
              <span>Hasilkan Prompt Foto Siap Salin</span>
            </>
          )}
        </button>
      </div>

      {/* Error Banner */}
      {error && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs sm:text-sm"
        >
          <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
          <p>{error}</p>
        </motion.div>
      )}

      {/* Engaging Loading State */}
      <AnimatePresence>
        {isGenerating && (
          <EngagingLoadingState
            title="Menganalisis & Meracik Prompt Foto Sinematik"
            subtitle="AI sedang mengekstrak komposisi, rasio lensa kamera, tata cahaya, dan menyusun prompt anti-glitch..."
            badgeText="AI PHOTO PROMPT ENGINE"
            icon={Camera}
            steps={[
              'Menganalisis konsep visual & komposisi subjek',
              'Menentukan rasio lensa, focal length & aperture',
              'Menyusun skema pencahayaan (volumetric / rim light)',
              'Mengoptimasi prompt 8K photorealistic siap salin'
            ]}
            tips={[
              'Tambahkan detail lensa seperti 85mm f/1.4 untuk bokeh latar belakang yang sangat halus dan fokus tajam pada mata.',
              'Gunakan pencahayaan "Rembrandt Lighting" untuk bayangan segitiga artistik pada pipi subjek manusia.',
              'Deskripsikan tekstur nyata seperti "pores, subtle peach fuzz, fabric weave" untuk mencegah kesan wajah lilin AI.',
              'Gunakan negative prompt seperti "bad anatomy, blurry, extra fingers, cartoon" untuk menjaga hasil tetap fotorealistik.'
            ]}
            estimatedSeconds={12}
          />
        )}
      </AnimatePresence>

      {/* Generated Results Output */}
      {!isGenerating && generatedPrompt && (() => {
        const parsed = parsePhotoPromptOutput(generatedPrompt);
        const heroPrompt = cleanPromptText(parsed.nanobananapro || generatedPrompt);
        const isMultiClip = parsed.isMultiClip && parsed.clips.length > 0;

        return (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
            className="space-y-6"
          >
            {/* MULTI-CLIP BATCH MODE VIEW */}
            {isMultiClip ? (
              <div className="space-y-4">
                {/* Batch Top Header Action Bar */}
                <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-slate-900 via-indigo-950 to-slate-900 text-white border border-indigo-500/30 shadow-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-xl bg-indigo-600/30 border border-indigo-400/40 flex items-center justify-center text-2xl shrink-0 shadow-inner">
                      ⚡
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/30">
                          Batch Auto-Generated
                        </span>
                        <span className="text-xs text-indigo-200 font-mono">
                          {parsed.clips.length} Klip Siap Pakai
                        </span>
                        {activeModelUsed && (
                          <span className="px-2 py-0.5 rounded-full bg-slate-800/80 border border-slate-700 text-[10px] font-mono text-indigo-200 flex items-center gap-1">
                            <Cpu className="w-3 h-3 text-indigo-400" />
                            {activeModelUsed}
                          </span>
                        )}
                        {tierUsed && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[9px] font-bold uppercase tracking-wider border border-emerald-500/30">
                            {tierUsed}
                          </span>
                        )}
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                        📸 Master Prompt Foto ({parsed.clips.length} Klip Sekaligus)
                      </h3>
                    </div>
                  </div>

                  {/* Batch Action Buttons */}
                  <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                    <button
                      type="button"
                      onClick={() => handleDownloadClipsAsTxt(parsed.clips)}
                      className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 transition-all flex items-center gap-1.5 cursor-pointer shadow-sm"
                      title="Unduh seluruh prompt klip ini sebagai file teks"
                    >
                      <Download className="w-3.5 h-3.5 text-cyan-400" />
                      <span>Unduh .TXT</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleCopyAllBatchPrompts(parsed.clips)}
                      className="px-4 py-2 rounded-xl bg-[#5b50e5] hover:bg-indigo-600 border border-indigo-400 text-xs font-bold text-white transition-all flex items-center gap-2 cursor-pointer shadow-md shadow-indigo-600/30"
                      title="Salin seluruh prompt dari klip 1 sampai klip terakhir"
                    >
                      {copiedAllClips ? (
                        <>
                          <Check className="w-4 h-4 text-emerald-300" />
                          <span>Semua Klip Tersalin!</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-4 h-4" />
                          <span>Salin Semua Klip ({parsed.clips.length})</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Grid List of Clip Prompt Cards */}
                <div className="grid grid-cols-1 gap-4">
                  {parsed.clips.map((clip) => {
                    const isClipCopied = copiedClipId === clip.id;

                    return (
                      <div
                        key={clip.id}
                        className="p-4 sm:p-5 rounded-2xl bg-white border border-slate-200/90 hover:border-indigo-300 shadow-sm transition-all space-y-3 relative group"
                      >
                        {/* Clip Header */}
                        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
                          <div className="flex items-center gap-2.5">
                            <span className="px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-200 font-mono font-bold text-xs text-[#5b50e5]">
                              {clip.timeRange}
                            </span>
                            <h4 className="text-sm font-bold text-slate-900">
                              🎬 Klip {clip.id}: {clip.title}
                            </h4>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleCopyClipPrompt(clip)}
                            className="px-3.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-xs font-bold text-[#5b50e5] transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs self-end sm:self-auto"
                            title={`Salin Prompt Foto Klip ${clip.id}`}
                          >
                            {isClipCopied ? (
                              <>
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Tersalin!</span>
                              </>
                            ) : (
                              <>
                                <Copy className="w-3.5 h-3.5 text-[#5b50e5]" />
                                <span>Salin Klip {clip.id}</span>
                              </>
                            )}
                          </button>
                        </div>

                        {/* Prompt Code Block */}
                        <div className="p-3.5 rounded-xl bg-slate-900 font-mono text-xs text-indigo-100 leading-relaxed whitespace-pre-wrap selection:bg-indigo-500 selection:text-white max-h-64 overflow-y-auto border border-slate-800">
                          {clip.prompt}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ) : (
              /* SINGLE PROMPT CARD (FALLBACK / SINGLE INPUT) */
              <div className="rounded-2xl bg-slate-900 text-white border border-slate-800 p-5 sm:p-6 shadow-xl relative overflow-hidden space-y-4">
                {/* Ambient Glow */}
                <div className="absolute -top-24 -right-24 w-60 h-60 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 relative z-10 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-indigo-600/30 border border-indigo-400/30 flex items-center justify-center text-xl shrink-0 shadow-inner">
                      🎬
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold text-indigo-300 uppercase tracking-widest bg-indigo-500/20 px-2 py-0.5 rounded border border-indigo-500/30">
                          Target Utama AI
                        </span>
                        <span className="text-xs text-slate-400 font-mono">
                          Midjourney v6 / Flux / DALL-E 3
                        </span>
                      </div>
                      <h3 className="text-base sm:text-lg font-bold text-white mt-0.5">
                        📸 TikTok & Google AEO Master Prompt
                      </h3>
                    </div>
                  </div>

                  {activeModelUsed && (
                    <div className="flex items-center gap-1.5 flex-wrap self-start sm:self-auto">
                      <span className="px-3 py-1 rounded-full bg-slate-800 border border-slate-700 text-[11px] font-medium text-slate-300 flex items-center gap-1.5">
                        <Cpu className="w-3.5 h-3.5 text-indigo-400" />
                        <span>{activeModelUsed}</span>
                      </span>
                      {tierUsed && (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 text-[10px] font-semibold text-emerald-300 uppercase tracking-wider">
                          {tierUsed}
                        </span>
                      )}
                      {latencyMs !== null && latencyMs !== undefined && (
                        <span className="px-2 py-0.5 rounded-full bg-slate-800 border border-slate-700 text-[10px] font-mono text-slate-400">
                          {(latencyMs / 1000).toFixed(1)}s
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Main Prompt Text Container */}
                <div className="relative group">
                  <div className="p-4 sm:p-5 rounded-xl bg-black/50 border border-white/10 font-mono text-xs sm:text-sm text-indigo-100 leading-relaxed whitespace-pre-wrap max-h-80 overflow-y-auto selection:bg-indigo-500 selection:text-white">
                    {heroPrompt}
                  </div>
                </div>

                {/* Hero Action Button: Copy Prompt Only */}
                <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span>Format presisi tinggi untuk Midjourney v6.1 / Flux.1 / DALL-E 3</span>
                  </p>

                  <button
                    type="button"
                    onClick={() => handleCopyOnlyPrompt(heroPrompt, 'hero_nanobananapro')}
                    className="w-full sm:w-auto px-6 py-3 rounded-xl bg-gradient-to-r from-[#5b50e5] to-indigo-600 hover:from-[#4f46e5] hover:to-indigo-700 text-white font-bold text-xs sm:text-sm transition-all flex items-center justify-center gap-2.5 shadow-lg shadow-indigo-500/25 cursor-pointer"
                  >
                    {copiedSection === 'hero_nanobananapro' ? (
                      <>
                        <Check className="w-4 h-4 text-emerald-300" />
                        <span>Prompt Utama Tersalin!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>📋 Salin Master Prompt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* ACCORDION COLLAPSIBLE: ANALISIS ESTETIKA & RELEVANSI TIKTOK & GOOGLE AEO */}
            {parsed.analysis && (
              <div className="rounded-2xl bg-white border border-slate-200/80 overflow-hidden shadow-sm transition-all">
                <button
                  type="button"
                  onClick={() => setIsAnalysisOpen(!isAnalysisOpen)}
                  className="w-full px-5 py-4 bg-slate-50 hover:bg-slate-100/80 transition-colors flex items-center justify-between text-left cursor-pointer border-b border-slate-200/60"
                >
                  <div className="flex items-center gap-2.5">
                    <FileText className="w-4 h-4 text-[#5b50e5]" />
                    <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                      Analisis Relevansi Scene & Algoritma (TikTok FYP & Google AEO)
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-[#5b50e5] text-[10px] font-semibold border border-indigo-100">
                      Laporan Algoritma
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-500 text-xs font-semibold">
                    <span>{isAnalysisOpen ? 'Tutup Analisis' : 'Buka Analisis'}</span>
                    {isAnalysisOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>
                </button>

                {isAnalysisOpen && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    transition={{ duration: 0.2 }}
                    className="p-5 sm:p-6 bg-white text-slate-800 text-xs sm:text-sm leading-relaxed markdown-body border-t border-slate-100"
                  >
                    <Markdown>{parsed.analysis}</Markdown>
                  </motion.div>
                )}
              </div>
            )}
          </motion.div>
        );
      })()}
    </div>
  );
}

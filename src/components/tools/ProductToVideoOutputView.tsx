import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import {
  FileText,
  Hash,
  Film,
  Copy,
  Check,
  Camera,
  Download,
  Sparkles,
  Sliders,
  ChevronDown,
  ChevronUp,
  Package,
  Search,
  Target,
  Megaphone,
  Eye,
  Mic,
  ShieldCheck,
  Zap,
  TrendingUp,
  Users,
  CheckCircle2,
  Video,
  Layers,
  Award,
  HelpCircle,
  AlertCircle,
  EyeOff,
} from 'lucide-react';
import type { IdeaClipSegment, TikTokShopIdea } from './TikTokShopToIdeasTool';

interface AnalysisData {
  category?: string;
  ingredients?: string;
  problemSolved?: string;
  benefit?: string;
  targetUser?: string;
  priceRating?: string;
  bpom?: string;
  usp?: string;
  moodTone?: string;
  summaryParagraph?: string;
}

interface QuerySection {
  title: string;
  queries: string[];
}

interface ProductToVideoOutputViewProps {
  parsedIdeas: TikTokShopIdea[];
  rawResult: string;
  totalDuration?: string;
  promptSplitSec?: string;
  targetAI?: string;
  analysisData?: AnalysisData | null;
  querySections?: QuerySection[];
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
  onSendToVideoPrompt?: (prompt: string) => void;
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

interface StructuredCommercialData {
  product_intelligence?: {
    product_identity: {
      name: string;
      category: string;
      brand: string;
      material: string;
      color: string;
      shape: string;
      texture?: string;
      size?: string;
      features: string[];
    };
    visual_anchor?: {
      shape: string;
      color: string;
      material: string;
      texture: string;
      unique_detail: string;
    };
    features_and_benefits: {
      features: string[];
      benefits: string[];
    };
    buyer_psychology?: {
      audience: string;
      pain_point: string;
      desire: string;
      objection: string;
      purchase_trigger: string;
    };
    audience_profile?: {
      gender: string;
      age_range: string;
      lifestyle: string;
      core_needs: string;
      pain_points: string[];
      buying_motivation: string;
    };
    seo_keywords: {
      primary: string;
      secondary: string;
      category?: string;
      problem?: string;
      buying_intent?: string;
      search_intent?: string;
      problem_keyword?: string;
      audience_keyword?: string;
    };
    selling_angle: string;
  };
  content_strategy?: {
    content_formula: string | { formula: string; reason: string };
    formula_rationale?: string;
    retention_intelligence?: {
      hook: string;
      retention_trigger: string;
      curiosity_gap: string;
    };
    hook?: {
      category: string;
      hook_text: string;
      visual_hook: string;
    };
    story_structure: {
      phase: string;
      time_range: string;
      focus: string;
    }[];
    script: {
      voice_over?: string;
      full_voice_over?: string;
      dialogue?: string;
      subtitle?: string[];
      subtitles?: string[];
      cta: string;
      audio_mood: string;
    };
  };
  video_prompt_seo?: {
    master_video_prompt: string;
    negative_prompt: string;
    micro_scene_breakdown?: {
      clip_number: number;
      duration: string;
      visual: string;
      action: string;
      camera: string;
      lens: string;
      lighting: string;
      audio: string;
      text_overlay: string;
      voice_over?: string;
      prompt: string;
    }[];
    clips?: {
      clip_number: number;
      duration: string;
      start_time?: number;
      end_time?: number;
      stage_label?: string;
      visual: string;
      action: string;
      camera: string;
      lens: string;
      lighting: string;
      audio: string;
      text_overlay: string;
      voice_over?: string;
      prompt: string;
    }[];
    caption_seo?: {
      caption: string;
      keyword_used: string[];
    };
    seo?: {
      caption: string;
      hashtags: string[];
      keywords: string[];
    };
    hashtags?: string[];
  };
  quality_score?: {
    product_score: number;
    prompt_score: number;
    seo_score: number;
    visual_score: number;
    overall_score: number;
    passed: boolean;
    issues: string[];
    improvements_applied: string[];
  };
}

export const ProductToVideoOutputView: React.FC<ProductToVideoOutputViewProps> = ({
  parsedIdeas,
  rawResult,
  totalDuration = '60',
  promptSplitSec = '10',
  targetAI = 'GENERAL',
  analysisData,
  querySections = [],
  refImageFile,
  onSendToPhotoPrompt,
  onSendToVideoPrompt,
  onOpenBatchPhotoModal,
}) => {
  const [activeIdeaIndex, setActiveIdeaIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [copiedAllPrompts, setCopiedAllPrompts] = useState(false);
  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState(false);
  const [copiedClipKey, setCopiedClipKey] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [copiedRawAll, setCopiedRawAll] = useState(false);
  const [copiedStrategy, setCopiedStrategy] = useState(false);
  const [copiedProductInfo, setCopiedProductInfo] = useState(false);
  const [showQcDetails, setShowQcDetails] = useState(false);
  const [showStrategicDetails, setShowStrategicDetails] = useState(false);

  // Extract structured data from markdown if present
  const structuredData: StructuredCommercialData | null = useMemo(() => {
    if (!rawResult) return null;
    const match = rawResult.match(/<!-- STRUCTURED_DATA:\s*([\s\S]*?)\s*-->/);
    if (match && match[1]) {
      try {
        return JSON.parse(match[1]);
      } catch (e) {
        console.error('Failed to parse structured commercial data:', e);
      }
    }
    return null;
  }, [rawResult]);

  const pIntel = structuredData?.product_intelligence;
  const cStrat = structuredData?.content_strategy;
  const vPrompt = structuredData?.video_prompt_seo;
  const qScore = structuredData?.quality_score;

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

  // Extract clean max 5 hashtags
  const hashtagChips = (
    vPrompt?.hashtags && vPrompt.hashtags.length > 0
      ? vPrompt.hashtags
      : vPrompt?.seo?.hashtags && vPrompt.seo.hashtags.length > 0
      ? vPrompt.seo.hashtags
      : currentIdea.hashtags
      ? currentIdea.hashtags.match(/#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+/g) ||
        currentIdea.hashtags.split(/\s+/).filter(Boolean)
      : []
  ).slice(0, 5);

  const getStageBadgeStyle = (stage?: string) => {
    if (!stage) return 'bg-slate-100 text-slate-700 border-slate-200';
    const s = stage.toLowerCase();
    if (s.includes('hook')) return 'bg-violet-50 text-violet-700 border-violet-200';
    if (s.includes('problem') || s.includes('masalah') || s.includes('pain')) return 'bg-amber-50 text-amber-700 border-amber-200';
    if (s.includes('demo') || s.includes('solut') || s.includes('solusi')) return 'bg-blue-50 text-blue-700 border-blue-200';
    if (s.includes('benefit') || s.includes('proof') || s.includes('bukti') || s.includes('manfaat')) return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    if (s.includes('cta') || s.includes('action') || s.includes('call') || s.includes('keranjang')) return 'bg-rose-50 text-rose-700 border-rose-200';
    return 'bg-indigo-50 text-indigo-700 border-indigo-200';
  };

  const rawClipsList = vPrompt?.micro_scene_breakdown || vPrompt?.clips || [];

  const clipsToRender =
    rawClipsList.length > 0
      ? rawClipsList.map((c: any, i: number) => ({
          id: c.clip_number || i + 1,
          title: `Klip ${c.clip_number || i + 1}`,
          timeRange: c.duration,
          stageLabel: c.stage_label || (i === 0 ? 'HOOK' : i === rawClipsList.length - 1 ? 'CTA' : 'DEMO'),
          hookType: typeof cStrat?.content_formula === 'object' ? cStrat.content_formula.formula : cStrat?.content_formula,
          visual: c.visual,
          action: c.action,
          camera: c.camera,
          lens: c.lens,
          lighting: c.lighting,
          audio: c.audio,
          textOverlay: c.text_overlay,
          voiceOver: c.voice_over,
          aiPrompt: c.prompt,
          actionAndVO: `${c.action}\nVO: ${c.voice_over || ''}`,
        }))
      : currentIdea.clips && currentIdea.clips.length > 0
      ? currentIdea.clips
      : currentIdea.scenePrompts && currentIdea.scenePrompts.trim()
      ? [
          {
            id: 1,
            timeRange: `0–${promptSplitSec === 'auto' ? '10' : promptSplitSec} detik`,
            title: 'Segmen 1',
            actionAndVO: currentIdea.scenePrompts.trim(),
            aiPrompt: currentIdea.scenePrompts.trim(),
          },
        ]
      : [];

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const captionText = vPrompt?.caption_seo?.caption || vPrompt?.seo?.caption || currentIdea.caption || '';

  const handleCopyCaption = () => {
    if (!captionText) return;
    navigator.clipboard.writeText(captionText.trim());
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
  };

  const handleCopyHashtags = () => {
    if (hashtagChips.length === 0) return;
    const textToCopy = hashtagChips.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    navigator.clipboard.writeText(textToCopy);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  const handleCopyMasterPrompt = () => {
    const master = vPrompt?.master_video_prompt || '';
    if (!master) return;
    navigator.clipboard.writeText(master.trim());
    setCopiedMasterPrompt(true);
    setTimeout(() => setCopiedMasterPrompt(false), 2000);
  };

  const handleCopyAllPrompts = () => {
    if (clipsToRender.length === 0) return;
    const combined = clipsToRender
      .map((clip) => {
        const p = (clip.aiPrompt || clip.actionAndVO || clip.visual || '').trim().replace(/^```(?:text)?\n?|```$/g, '');
        return p.startsWith('[') ? p : `[Klip ${clip.id} - ${clip.timeRange}]\n${p}`;
      })
      .filter(Boolean)
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(combined);
    setCopiedAllPrompts(true);
    setTimeout(() => setCopiedAllPrompts(false), 2500);
  };

  const handleCopyClipPrompt = (clipId: number, text: string) => {
    const cleanText = text.trim().replace(/^```(?:text)?\n?|```$/g, '');
    navigator.clipboard.writeText(cleanText);
    const key = `clip_${clipId}`;
    setCopiedClipKey(key);
    setTimeout(() => setCopiedClipKey(null), 2000);
  };

  const handleCopyProductIntelligence = () => {
    if (!pIntel) return;
    const vAnch = pIntel.visual_anchor;
    const bPsych = pIntel.buyer_psychology || pIntel.audience_profile;
    const text = [
      `=== PRODUCT INTELLIGENCE V2 ANALYSIS ===`,
      `Produk: ${pIntel.product_identity.name}`,
      `Kategori: ${pIntel.product_identity.category} | Brand: ${pIntel.product_identity.brand}`,
      `Material & Warna: ${pIntel.product_identity.material} (${pIntel.product_identity.color})`,
      `Form Factor & Tekstur: ${pIntel.product_identity.shape}, ${pIntel.product_identity.texture || '-'}`,
      vAnch ? `Visual Anchor: ${vAnch.shape}, ${vAnch.color}, ${vAnch.material}, ${vAnch.texture} (${vAnch.unique_detail})` : '',
      `Selling Angle: ${pIntel.selling_angle}`,
      `\nFitur Teknis:`,
      ...pIntel.features_and_benefits.features.map((f) => `- ${f}`),
      `\nManfaat Konsumen:`,
      ...pIntel.features_and_benefits.benefits.map((b) => `- ${b}`),
      `\nBuyer Psychology:`,
      `Target: ${bPsych?.audience || (bPsych as any)?.gender}`,
      `Pain Point: ${bPsych?.pain_point || (bPsych as any)?.pain_points?.join('; ')}`,
      `Desire / Motivation: ${bPsych?.desire || (bPsych as any)?.buying_motivation}`,
      `Purchase Trigger: ${bPsych?.purchase_trigger || '-'}`,
      `\nSEO Keywords:`,
      `Primary: ${pIntel.seo_keywords.primary}`,
      `Secondary: ${pIntel.seo_keywords.secondary}`,
      `Category: ${pIntel.seo_keywords.category || '-'}`,
      `Buying Intent: ${pIntel.seo_keywords.buying_intent || pIntel.seo_keywords.search_intent || '-'}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedProductInfo(true);
    setTimeout(() => setCopiedProductInfo(false), 2000);
  };

  const handleCopyContentStrategy = () => {
    if (!cStrat) return;
    const formulaStr = typeof cStrat.content_formula === 'object' ? cStrat.content_formula.formula : cStrat.content_formula;
    const reasonStr = typeof cStrat.content_formula === 'object' ? cStrat.content_formula.reason : cStrat.formula_rationale;
    const hookStr = cStrat.retention_intelligence?.hook || cStrat.hook?.hook_text || '';
    const voStr = cStrat.script.voice_over || cStrat.script.full_voice_over || '';

    const text = [
      `=== VIRAL CONTENT STRATEGY & SCRIPT V2 ===`,
      `Formula: ${formulaStr} (${reasonStr})`,
      `Hook 3s: "${hookStr}"`,
      cStrat.retention_intelligence ? `Retention Trigger: ${cStrat.retention_intelligence.retention_trigger}` : '',
      `Audio Mood: ${cStrat.script.audio_mood}`,
      `\nVoice Over Penuh:\n${voStr}`,
      `\nCall To Action (CTA):\n${cStrat.script.cta}`,
    ].filter(Boolean).join('\n');

    navigator.clipboard.writeText(text);
    setCopiedStrategy(true);
    setTimeout(() => setCopiedStrategy(false), 2000);
  };

  const handleCopyAllRaw = () => {
    navigator.clipboard.writeText(rawResult);
    setCopiedRawAll(true);
    setTimeout(() => setCopiedRawAll(false), 2000);
  };

  const handleDownloadTxt = () => {
    const text = [
      `=== AI PRODUCT COMMERCIAL GENERATOR V2 ===`,
      `Produk: ${pIntel?.product_identity?.name || currentIdea.title}`,
      `Target AI: ${targetAI.toUpperCase()}`,
      `Durasi Total: ${totalDuration} Detik\n`,
      ...(pIntel
        ? [
            `--- 1. PRODUCT INTELLIGENCE V2 ---`,
            `Kategori: ${pIntel.product_identity.category}`,
            `Brand: ${pIntel.product_identity.brand}`,
            `Visual Anchor: Color: ${pIntel.visual_anchor?.color || pIntel.product_identity.color}, Material: ${pIntel.visual_anchor?.material || pIntel.product_identity.material}`,
            `Selling Angle: ${pIntel.selling_angle}`,
            `Keywords: ${pIntel.seo_keywords.primary}, ${pIntel.seo_keywords.secondary}\n`,
          ]
        : []),
      ...(cStrat
        ? [
            `--- 2. VIRAL CONTENT STRATEGY ---`,
            `Formula: ${typeof cStrat.content_formula === 'object' ? cStrat.content_formula.formula : cStrat.content_formula}`,
            `Hook: "${cStrat.retention_intelligence?.hook || cStrat.hook?.hook_text}"`,
            `Voice Over:\n${cStrat.script.voice_over || cStrat.script.full_voice_over}`,
            `CTA: ${cStrat.script.cta}\n`,
          ]
        : []),
      ...(vPrompt?.master_video_prompt
        ? [`--- 3. MASTER VIDEO PROMPT ---\n${vPrompt.master_video_prompt}\n`]
        : []),
      `--- 4. MICRO SCENE BREAKDOWN ---`,
      ...clipsToRender.map(
        (c) =>
          `\n[KLIP ${c.id} - ${c.timeRange}] ${c.stageLabel || ''}\n${(c.aiPrompt || c.actionAndVO || '').trim().replace(/^```(?:text)?\n?|```$/g, '')}`
      ),
      `\n--- 5. CAPTION SEO ---`,
      captionText,
      `\n--- HASHTAGS (TOP 5) ---`,
      hashtagChips.join(' '),
    ].join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `commercial-v2-${(pIntel?.product_identity?.name || currentIdea.title || 'export').replace(/\s+/g, '-').toLowerCase()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {parsedIdeas.length > 1 ? (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 max-w-full">
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
        ) : (
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-[#005ab3] border border-blue-200 text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5" /> AI Product Commercial Generator V2
            </span>
          </div>
        )}

        {/* Global Utility Buttons */}
        <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode(viewMode === 'cards' ? 'raw' : 'cards')}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
          >
            <FileText className="w-3.5 h-3.5 text-slate-600" />
            <span>{viewMode === 'cards' ? 'Format Markdown' : 'Tampilan Kartu'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadTxt}
            className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Unduh seluruh paket dalam format file teks"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh .TXT</span>
          </button>

          <button
            type="button"
            onClick={handleCopyAllRaw}
            className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            title="Salin seluruh teks output mentah"
          >
            {copiedRawAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Tersalin</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-600" />
                <span>Salin Semua</span>
              </>
            )}
          </button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        /* Markdown Raw View */
        <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <span className="text-xs font-bold text-slate-600 uppercase tracking-wider">
              Format Output Markdown Mentah V2
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
        /* Structured Cards Layout */
        <div className="space-y-6">
          {/* QUALITY CONTROL INTELLIGENCE BANNER */}
          {qScore && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 sm:p-6 rounded-2xl bg-slate-900 text-white shadow-sm border border-slate-800 space-y-4"
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                        Quality Control Engine V2 Status: {qScore.passed ? 'PASSED' : 'REFINED'}
                      </span>
                      <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[11px] font-extrabold border border-emerald-500/30">
                        {qScore.overall_score}/100
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      Output diverifikasi secara otomatis memenuhi standar komersial V2 anti-generik
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowQcDetails(!showQcDetails)}
                  className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/15 text-xs text-slate-200 font-medium transition-colors flex items-center gap-1.5 self-start sm:self-auto cursor-pointer"
                >
                  <span>{showQcDetails ? 'Sembunyikan Pilar QC' : 'Lihat Breakdown Score QC'}</span>
                  {showQcDetails ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>
              </div>

              {/* 4 Pillars Breakdown Grid */}
              <AnimatePresence>
                {showQcDetails && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="pt-2 border-t border-white/10 space-y-3"
                  >
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Product Consistency (25%)
                        </span>
                        <div className="text-sm font-bold text-emerald-400">{qScore.product_score}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Visual Consistency (25%)
                        </span>
                        <div className="text-sm font-bold text-emerald-400">{qScore.visual_score}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          Prompt Quality (25%)
                        </span>
                        <div className="text-sm font-bold text-emerald-400">{qScore.prompt_score}%</div>
                      </div>
                      <div className="p-3 rounded-xl bg-white/5 border border-white/10 space-y-1">
                        <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                          SEO Consistency (25%)
                        </span>
                        <div className="text-sm font-bold text-emerald-400">{qScore.seo_score}%</div>
                      </div>
                    </div>

                    {qScore.improvements_applied && qScore.improvements_applied.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/20 text-xs text-emerald-200 space-y-1">
                        <span className="font-bold flex items-center gap-1.5 text-emerald-300">
                          <CheckCircle2 className="w-3.5 h-3.5" /> Auto-Refinement Applied:
                        </span>
                        <ul className="list-disc list-inside space-y-0.5 text-[11px] text-slate-300">
                          {qScore.improvements_applied.map((imp, idx) => (
                            <li key={idx}>{imp}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* CARD 1: PRODUCT INTELLIGENCE CARD */}
          {pIntel && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-blue-50 text-[#005ab3] border border-blue-100">
                    <Package className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 leading-tight">
                      1. Product Intelligence V2 Card
                    </h4>
                    <p className="text-xs text-slate-500">
                      Product DNA, Visual Anchor, Buyer Psychology, dan SEO Keywords
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyProductIntelligence}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedProductInfo ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{copiedProductInfo ? 'Tersalin' : 'Salin Analisis'}</span>
                </button>
              </div>

              {/* Product Identity DNA */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Nama Produk</span>
                  <div className="text-xs font-bold text-slate-900 truncate">{pIntel.product_identity.name}</div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Kategori & Brand</span>
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {pIntel.product_identity.category} · {pIntel.product_identity.brand}
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Material & Warna</span>
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {pIntel.product_identity.material} ({pIntel.product_identity.color})
                  </div>
                </div>
                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/70 space-y-0.5">
                  <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Form & Tekstur</span>
                  <div className="text-xs font-semibold text-slate-900 truncate">
                    {pIntel.product_identity.shape} · {pIntel.product_identity.texture || pIntel.product_identity.size || 'Matte'}
                  </div>
                </div>
              </div>

              {/* Product Visual Anchor Banner */}
              {pIntel.visual_anchor && (
                <div className="p-3.5 rounded-xl bg-indigo-50/70 border border-indigo-200/70 space-y-1">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-indigo-800 uppercase tracking-wider">
                    <Eye className="w-3.5 h-3.5 text-indigo-600" /> Product Visual Anchor (AI Prompt Locker)
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs text-slate-800 font-medium">
                    <div><span className="text-[10px] text-slate-500 block">Shape:</span> {pIntel.visual_anchor.shape}</div>
                    <div><span className="text-[10px] text-slate-500 block">Color:</span> {pIntel.visual_anchor.color}</div>
                    <div><span className="text-[10px] text-slate-500 block">Material:</span> {pIntel.visual_anchor.material}</div>
                    <div><span className="text-[10px] text-slate-500 block">Texture:</span> {pIntel.visual_anchor.texture}</div>
                    <div><span className="text-[10px] text-slate-500 block">Detail Unik:</span> {pIntel.visual_anchor.unique_detail}</div>
                  </div>
                </div>
              )}

              {/* Selling Angle Banner */}
              <div className="p-3.5 rounded-xl bg-blue-50/60 border border-blue-200/60 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-bold text-[#005ab3] uppercase tracking-wider">
                  <Target className="w-3.5 h-3.5" /> Core Selling Angle
                </div>
                <p className="text-xs sm:text-sm text-slate-800 font-medium leading-relaxed">
                  {pIntel.selling_angle}
                </p>
              </div>

              {/* Features vs Benefits Matrix */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-2">
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                    <Zap className="w-3.5 h-3.5 text-amber-500" /> Fitur Teknis (Features)
                  </span>
                  <ul className="space-y-1.5 text-xs text-slate-700">
                    {pIntel.features_and_benefits.features.map((feat, fIdx) => (
                      <li key={fIdx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0" />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                  <span className="text-xs font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Award className="w-3.5 h-3.5 text-emerald-600" /> Manfaat Konsumen (Benefits)
                  </span>
                  <ul className="space-y-1.5 text-xs text-emerald-950 font-medium">
                    {pIntel.features_and_benefits.benefits.map((ben, bIdx) => (
                      <li key={bIdx} className="flex items-start gap-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                        <span>{ben}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Buyer Psychology Analysis */}
              { (pIntel.buyer_psychology || pIntel.audience_profile) && (
                <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-violet-600" />
                    <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Buyer Psychology Analysis
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Target Audiens</span>
                      <p className="font-semibold text-slate-800">
                        {pIntel.buyer_psychology?.audience || pIntel.audience_profile?.gender}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Pain Point</span>
                      <p className="font-semibold text-rose-700">
                        {pIntel.buyer_psychology?.pain_point || pIntel.audience_profile?.pain_points?.join('; ')}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Desire</span>
                      <p className="font-semibold text-slate-800">
                        {pIntel.buyer_psychology?.desire || pIntel.audience_profile?.core_needs}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Objection</span>
                      <p className="font-semibold text-amber-700">
                        {pIntel.buyer_psychology?.objection || 'Sensitivitas kualitas'}
                      </p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold uppercase block">Purchase Trigger</span>
                      <p className="font-semibold text-emerald-700">
                        {pIntel.buyer_psychology?.purchase_trigger || pIntel.audience_profile?.buying_motivation}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* SEO Keyword Intelligence Chips */}
              <div className="space-y-2 pt-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-sky-600" /> SEO Keyword Intelligence
                </span>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 font-semibold border border-sky-200">
                    Primary: {pIntel.seo_keywords.primary}
                  </span>
                  <span className="px-2.5 py-1 rounded-lg bg-sky-50 text-sky-800 font-semibold border border-sky-200">
                    Secondary: {pIntel.seo_keywords.secondary}
                  </span>
                  {pIntel.seo_keywords.category && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      Category: {pIntel.seo_keywords.category}
                    </span>
                  )}
                  {(pIntel.seo_keywords.problem || pIntel.seo_keywords.problem_keyword) && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      Problem: {pIntel.seo_keywords.problem || pIntel.seo_keywords.problem_keyword}
                    </span>
                  )}
                  {(pIntel.seo_keywords.buying_intent || pIntel.seo_keywords.search_intent) && (
                    <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-medium border border-slate-200">
                      Intent: {pIntel.seo_keywords.buying_intent || pIntel.seo_keywords.search_intent}
                    </span>
                  )}
                </div>
              </div>
            </motion.div>
          )}

          {/* CARD 2: VIDEO STRATEGY CARD */}
          {cStrat && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5"
            >
              <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-xl bg-violet-50 text-violet-700 border border-violet-100">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <div>
                    <h4 className="text-base font-bold text-slate-900 leading-tight">
                      2. Video Strategy Card
                    </h4>
                    <p className="text-xs text-slate-500">
                      Formula, Hook 3s, Retention Intelligence, Alur Cerita, dan Script
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyContentStrategy}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedStrategy ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                  )}
                  <span>{copiedStrategy ? 'Tersalin' : 'Salin Strategi'}</span>
                </button>
              </div>

              {/* Formula & Retention Intelligence Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {/* Content Formula */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Formula Konten</span>
                    <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 font-bold text-xs border border-indigo-200">
                      {typeof cStrat.content_formula === 'object' ? cStrat.content_formula.formula : cStrat.content_formula}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {typeof cStrat.content_formula === 'object' ? cStrat.content_formula.reason : cStrat.formula_rationale}
                  </p>
                </div>

                {/* Retention Intelligence */}
                <div className="p-4 rounded-xl bg-purple-50/60 border border-purple-200/80 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[10px] uppercase font-bold text-purple-800 tracking-wider flex items-center gap-1">
                      <Sparkles className="w-3.5 h-3.5 text-purple-600" /> Retention Intelligence & Hook
                    </span>
                  </div>
                  <p className="text-xs font-bold text-purple-950">
                    "{cStrat.retention_intelligence?.hook || cStrat.hook?.hook_text}"
                  </p>
                  {cStrat.retention_intelligence ? (
                    <div className="text-[11px] text-purple-800/80 space-y-0.5">
                      <p><strong>Trigger:</strong> {cStrat.retention_intelligence.retention_trigger}</p>
                      <p><strong>Curiosity Gap:</strong> {cStrat.retention_intelligence.curiosity_gap}</p>
                    </div>
                  ) : (
                    <p className="text-[11px] text-purple-800/80">Visual: {cStrat.hook?.visual_hook}</p>
                  )}
                </div>
              </div>

              {/* Story Structure Timeline */}
              {cStrat.story_structure && cStrat.story_structure.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                    Struktur Timeline Alur Cerita
                  </span>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                    {cStrat.story_structure.map((phase, pIdx) => (
                      <div
                        key={pIdx}
                        className={`p-3 rounded-xl border text-xs space-y-1 ${getStageBadgeStyle(phase.phase)}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-extrabold text-[11px]">{phase.phase}</span>
                          <span className="text-[10px] opacity-75 font-mono">{phase.time_range}</span>
                        </div>
                        <p className="text-[11px] leading-tight opacity-90">{phase.focus}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Full Voice Over Script Box */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Mic className="w-3.5 h-3.5 text-blue-600" /> Naskah Narasi Suara (Voice Over Siap Produksi)
                  </span>
                  <span className="text-[11px] text-slate-400">Audio Mood: {cStrat.script.audio_mood}</span>
                </div>
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                  {cStrat.script.voice_over || cStrat.script.full_voice_over}
                </div>
              </div>

              {/* Call to Action Box */}
              <div className="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200/70 space-y-1">
                <span className="text-[10px] uppercase font-bold text-rose-700 tracking-wider">Call to Action (CTA)</span>
                <p className="text-xs sm:text-sm font-semibold text-rose-950">{cStrat.script.cta}</p>
              </div>
            </motion.div>
          )}

          {/* CARD 3: SCENE BREAKDOWN CARD */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-sky-50 text-sky-700 border border-sky-100">
                  <Video className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-tight">
                    3. Scene Breakdown Card
                  </h4>
                  <p className="text-xs text-slate-500">
                    Master Video Prompt sinematik & Micro Scene Breakdown ({clipsToRender.length} Klip)
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
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
                    className="px-3 py-1.5 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
                    title="Generate prompt foto untuk seluruh klip ini sekaligus"
                  >
                    <Camera className="w-3.5 h-3.5 text-slate-600" />
                    <span>Generate Semua Foto ({clipsToRender.length})</span>
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
                  <span>{copiedAllPrompts ? 'Tersalin' : `Salin Semua ${clipsToRender.length} Klip`}</span>
                </button>
              </div>
            </div>

            {/* Master Video Prompt Block */}
            {vPrompt?.master_video_prompt && (
              <div className="p-4 sm:p-5 rounded-2xl bg-slate-900 text-white space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-200">
                      Master Video Commercial Prompt (Full Video 11 Elements)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {onSendToPhotoPrompt && (
                      <button
                        type="button"
                        onClick={() =>
                          onSendToPhotoPrompt(vPrompt.master_video_prompt, {
                            negativePrompt: vPrompt.negative_prompt,
                            referenceImage: refImageFile || undefined,
                          })
                        }
                        className="px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/15 text-slate-200 text-xs font-medium flex items-center gap-1 transition-colors cursor-pointer"
                        title="Kirim ke generator foto"
                      >
                        <Camera className="w-3 h-3 text-slate-300" />
                        <span>Ke Foto</span>
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={handleCopyMasterPrompt}
                      className="px-3 py-1 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      {copiedMasterPrompt ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{copiedMasterPrompt ? 'Tersalin' : 'Salin Master Prompt'}</span>
                    </button>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed font-mono whitespace-pre-wrap select-text bg-black/30 p-3 rounded-xl border border-white/10">
                  {vPrompt.master_video_prompt}
                </p>

                {vPrompt.negative_prompt && (
                  <div className="text-[11px] text-slate-400">
                    <span className="font-semibold text-rose-400">Negative Prompt:</span> {vPrompt.negative_prompt}
                  </div>
                )}
              </div>
            )}

            {/* Micro Scene Breakdown Clips List */}
            <div className="space-y-4 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-4 h-4 text-blue-600" /> Micro Scene Breakdown ({clipsToRender.length} Klip · Split {promptSplitSec === 'auto' ? '10' : promptSplitSec}s)
                </span>
              </div>

              {clipsToRender.map((clip, cIdx) => {
                const clipKey = `clip_${clip.id}`;
                const isCopied = copiedClipKey === clipKey;
                const rawPrompt = (clip.aiPrompt || clip.actionAndVO || clip.visual || '')
                  .trim()
                  .replace(/^```(?:text)?\n?|```$/g, '');

                return (
                  <div
                    key={clip.id || cIdx}
                    className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3.5 hover:border-slate-300 transition-all"
                  >
                    {/* Header + Actions */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-md bg-blue-50 text-blue-600 font-bold text-xs border border-blue-100">
                          Clip #{clip.id}
                        </span>
                        <span className="text-sm sm:text-base font-bold text-slate-900">
                          Klip {clip.id}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-medium font-mono">
                          {clip.timeRange}
                        </span>
                        {clip.stageLabel && (
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border shadow-2xs ${getStageBadgeStyle(
                              clip.stageLabel
                            )}`}
                          >
                            {clip.stageLabel}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        {onSendToPhotoPrompt && (
                          <button
                            type="button"
                            onClick={() =>
                              onSendToPhotoPrompt(rawPrompt, {
                                negativePrompt: vPrompt?.negative_prompt,
                                referenceImage: refImageFile || undefined,
                              })
                            }
                            className="px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                          >
                            <Camera className="w-3.5 h-3.5 text-slate-500" />
                            <span>Ke Foto</span>
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => handleCopyClipPrompt(clip.id, rawPrompt)}
                          className="px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50/70 hover:bg-blue-100 text-blue-700 text-xs font-medium flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-blue-600" />}
                          <span>{isCopied ? 'Tersalin' : 'Salin Prompt'}</span>
                        </button>
                      </div>
                    </div>

                    {/* Metadata Specs (Visual, Camera, Lens, Lighting, Audio, VO) */}
                    {(clip.visual || clip.camera || clip.lighting || clip.audio || clip.voiceOver) && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
                        {clip.visual && (
                          <div>
                            <span className="font-bold text-slate-500 text-[10px] uppercase block">Visual & Action</span>
                            <p className="text-slate-800">{clip.visual} {clip.action ? `· ${clip.action}` : ''}</p>
                          </div>
                        )}
                        {clip.camera && (
                          <div>
                            <span className="font-bold text-slate-500 text-[10px] uppercase block">Camera & Lens</span>
                            <p className="text-slate-800">{clip.camera} {clip.lens ? `· ${clip.lens}` : ''}</p>
                          </div>
                        )}
                        {clip.lighting && (
                          <div>
                            <span className="font-bold text-slate-500 text-[10px] uppercase block">Lighting & Audio</span>
                            <p className="text-slate-800">{clip.lighting} {clip.audio ? `· ${clip.audio}` : ''}</p>
                          </div>
                        )}
                        {clip.voiceOver && (
                          <div>
                            <span className="font-bold text-slate-500 text-[10px] uppercase block">Voice Over Klip</span>
                            <p className="text-slate-800 font-medium">"{clip.voiceOver}"</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* AI Prompt Box */}
                    <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-100 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text font-mono">
                      {rawPrompt}
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>

          {/* CARD 4: SEO CARD */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="p-6 sm:p-7 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-5"
          >
            <div className="flex items-center justify-between gap-3 border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Hash className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-base font-bold text-slate-900 leading-tight">
                    4. SEO Card (Caption & 5 Hashtag)
                  </h4>
                  <p className="text-xs text-slate-500">
                    Formula ranking e-commerce (40% Produk, 30% Kategori, 20% Audiens, 10% Intent)
                  </p>
                </div>
              </div>
            </div>

            {/* Caption Box */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <FileText className="w-3.5 h-3.5 text-sky-600" /> Caption Penjualan Natural & Berbasis SEO
                </span>
                <button
                  type="button"
                  onClick={handleCopyCaption}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedCaption ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedCaption ? 'Tersalin' : 'Salin Caption'}</span>
                </button>
              </div>
              <p className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-medium">
                {captionText}
              </p>
            </div>

            {/* Hashtag Chips */}
            <div className="space-y-2.5 pt-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-3.5 h-3.5 text-emerald-600" /> 5 Hashtag Relevansi Tinggi
                </span>
                <button
                  type="button"
                  onClick={handleCopyHashtags}
                  className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedHashtags ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{copiedHashtags ? 'Tersalin' : 'Salin Semua Hashtag'}</span>
                </button>
              </div>

              <div className="flex items-center gap-2.5 flex-wrap">
                {hashtagChips.map((tag, tIdx) => {
                  const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
                  const isThisCopied = copiedTag === cleanTag;
                  return (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => handleCopyTag(cleanTag)}
                      className="group px-3.5 py-1.5 rounded-xl bg-sky-50/80 hover:bg-sky-100 text-sky-700 border border-sky-200/60 text-xs font-semibold flex items-center gap-2 transition-colors cursor-pointer"
                      title={`Klik untuk menyalin ${cleanTag}`}
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
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

import React, { useState } from 'react';
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
  Sparkles,
  Clapperboard,
  Video,
  Volume2,
  Sliders,
  ShieldAlert,
  BarChart3,
  Layers,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { learningSync } from '../../../lib/learningSync';
import BatchPhotoPromptModal from '../../modals/BatchPhotoPromptModal';

export interface SplitPromptViewerProps {
  rawPrompt: string;
  segmentDuration?: string;
  targetAI?: string;
  sourceCaption?: string;
  onSendToPhotoPrompt?: (
    text: string,
    options?: {
      autoGenerate?: boolean;
      aspectRatio?: string;
      photoStyle?: string;
      targetGenerator?: string;
      negativePrompt?: string;
      referenceImage?: File;
    }
  ) => void;
}

export interface MicroClipItem {
  id?: number;
  timeRange: string;
  visual: string;
  aksi: string;
  suara?: string | null;
  subteks?: string | null;
  masterPrompt?: string;
}

export interface ClipSegment {
  id: number;
  title: string;
  timestamp: string;
  startSec?: number;
  endSec?: number;
  durationSec?: number;
  visual: string;
  aksi: string;
  voiceOver?: string;
  subteks?: string;
  lensInfo?: string;
  cameraMotion?: string;
  lightingInfo?: string;
  roleTag?: string;
  wordCount?: number;
  estVoiceDurationSec?: number;
  masterPrompt: string;
  content: string;
  stageLabel?: string;
  microClips?: MicroClipItem[];
}

export interface SeoCaptionInfo {
  caption: string;
  hashtags: string;
  cleanCaptionWithoutTags?: string;
  tagsList: string[];
  charCount: number;
  wordCount: number;
}

export interface VideoAnalysisData {
  visualAndStyle?: string;
  audioAndMusic?: string;
  cameraAndFraming?: string;
  lightingAndMood?: string;
}

export interface ViralDnaData {
  hook_type?: string;
  hook_visual?: string;
  hook_text?: string;
  retention_trigger?: string;
  curiosity_gap?: string;
  pacing?: string;
  emotional_curve?: string;
  structure?: {
    hook?: string;
    body?: string;
    climax?: string;
    cta?: string;
  };
}

export interface QualityScoreData {
  total: number;
  passed: boolean;
  breakdown: {
    product_consistency: number;
    prompt_quality: number;
    caption_match: number;
    hashtag_validation: number;
    scene_timing: number;
    audio_visual_match: number;
  };
  issues: string[];
}

export function extractViralDna(rawText: string): ViralDnaData | null {
  if (!rawText) return null;
  const structured = extractStructuredData(rawText);
  if (structured?.viral_dna) {
    return structured.viral_dna;
  }
  return null;
}

export function extractQualityScore(rawText: string): QualityScoreData | null {
  if (!rawText) return null;
  const structured = extractStructuredData(rawText);
  if (structured?.quality_score) {
    return structured.quality_score;
  }
  return null;
}

export function extractStructuredData(rawText: string): any | null {
  if (!rawText) return null;
  const match = rawText.match(/<!--\s*STRUCTURED_DATA:\s*([\s\S]*?)\s*-->/);
  if (match) {
    try {
      return JSON.parse(match[1].trim());
    } catch (e) {}
  }
  if (rawText.trim().startsWith('{')) {
    try {
      return JSON.parse(rawText.trim());
    } catch (e) {}
  }
  return null;
}

export function extractVideoAnalysis(rawText: string): VideoAnalysisData | null {
  if (!rawText) return null;
  const structured = extractStructuredData(rawText);
  if (structured?.videoAnalysis) {
    return structured.videoAnalysis;
  }

  const match = rawText.match(/##\s*🎬?\s*ANALISIS VIDEO[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (!match) return null;

  const text = match[1];
  const vis = text.match(/(?:Visual\s*&\s*Gaya|Visual|Gaya)[:\s]*([^\n]+)/i);
  const aud = text.match(/(?:Audio\s*&\s*Musik|Audio|Musik)[:\s]*([^\n]+)/i);
  const kam = text.match(/(?:Kamera\s*&\s*Lensa|Kamera|Lensa)[:\s]*([^\n]+)/i);
  const lig = text.match(/(?:Lighting\s*&\s*Mood|Lighting|Mood)[:\s]*([^\n]+)/i);

  if (!vis && !aud && !kam && !lig) return null;

  return {
    visualAndStyle: vis ? vis[1].replace(/^\*+|\*+$/g, '').trim() : '',
    audioAndMusic: aud ? aud[1].replace(/^\*+|\*+$/g, '').trim() : '',
    cameraAndFraming: kam ? kam[1].replace(/^\*+|\*+$/g, '').trim() : '',
    lightingAndMood: lig ? lig[1].replace(/^\*+|\*+$/g, '').trim() : '',
  };
}

export function extractMasterPromptText(rawText: string): string | null {
  if (!rawText) return null;
  const structured = extractStructuredData(rawText);
  if (structured?.masterPrompt) {
    return structured.masterPrompt.trim();
  }

  const match = rawText.match(/##\s*🎯?\s*MASTER PROMPT[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (match) {
    return match[1].replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  }
  return null;
}

export function extractNegativePromptText(rawText: string): string | null {
  if (!rawText) return null;
  const structured = extractStructuredData(rawText);
  if (structured?.negativePrompt) {
    return structured.negativePrompt.trim();
  }

  const match = rawText.match(/##\s*🚫?\s*NEGATIVE PROMPT[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (match) {
    return match[1].replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  }
  return null;
}

export function extractTechnicalSummaryData(rawText: string): Record<string, string> | null {
  if (!rawText) return null;
  const structured = extractStructuredData(rawText);
  if (structured?.technicalSummary && Object.keys(structured.technicalSummary).length > 0) {
    return structured.technicalSummary;
  }

  const match = rawText.match(/##\s*📊?\s*RINGKASAN TEKNIS[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (!match) return null;

  const result: Record<string, string> = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const clean = line.replace(/^[\s\-*]+/, '').trim();
    const parts = clean.split(':');
    if (parts.length >= 2) {
      const k = parts[0].trim();
      const v = parts.slice(1).join(':').trim();
      if (k && v) result[k] = v;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

export function parseSeoCaptionAndHashtags(rawText: string): SeoCaptionInfo | null {
  if (!rawText) return null;

  const sanitizeInlineTags = (text: string) => {
    if (!text) return text;
    // Strip inline #tags inside sentence body and convert them to readable text
    return text.replace(/#([\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+)/g, (_match, tag) => {
      return tag.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    });
  };

  const BANNED_SPAM_SET = new Set([
    '#fyp', '#fypシ', '#fypviral', '#foryou', '#foryoupage', '#foru', '#racuntiktok',
    '#racuntiktokshop', '#viral', '#viralvideo', '#trending', '#trendingvideo',
    '#beranda', '#masukberanda', '#fypindonesia', '#fyppage', '#viraltiktok', '#foryourpage',
    '#xyzbca', '#explore', '#explorepage', '#reels', '#tiktok', '#tik_tok', '#trend', '#videoviral'
  ]);

  const structured = extractStructuredData(rawText);
  if (structured && (structured.caption || structured.hashtags)) {
    let cap = sanitizeInlineTags((structured.caption || '').trim());
    let hash = '';
    if (Array.isArray(structured.hashtags)) {
      hash = structured.hashtags.join(' ');
    } else if (typeof structured.hashtags === 'string') {
      hash = structured.hashtags.trim();
    }
    const rawTagMatches = hash.match(/#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+/g) || [];
    const tagsList = rawTagMatches
      .filter((t) => !BANNED_SPAM_SET.has(t.toLowerCase()))
      .slice(0, 5);

    return {
      caption: cap,
      hashtags: tagsList.join(' '),
      cleanCaptionWithoutTags: cap,
      tagsList,
      charCount: cap.length,
      wordCount: cap ? cap.split(/\s+/).filter(Boolean).length : 0,
    };
  }

  // Check for caption & hashtag section
  const sectionMatch = rawText.match(/(?:###|\*\*|##)\s*(?:📱|🔥|✨|📋)?\s*CAPTION[\s\S]*$/i);
  const targetText = sectionMatch ? sectionMatch[0] : rawText;

  // Match Caption
  const captionMatch =
    targetText.match(/##\s*📋?\s*CAPTION[^\n]*\n([\s\S]*?)(?=\n*##|\n*###|\n*\*\*Hashtags?|$)/i) ||
    targetText.match(/\*\*Caption[^\n]*\*\*[:\s]*\n*([\s\S]*?)(?=\n*\*\*(?:Hashtags?|Tag|Hashtag Viral)|$)/i) ||
    targetText.match(/(?:Caption SEO|Caption FYP|Caption)[:\s]*\n*([\s\S]*?)(?=\n*(?:#|Hashtag|\*\*Hashtag)|$)/i);

  // Match Hashtags
  const hashtagsMatch =
    targetText.match(/##\s*#?\s*HASHTAG[^\n]*\n([\s\S]*?)(?=\n*##|\n*###|$)/i) ||
    targetText.match(/\*\*Hashtags?[^\n]*\*\*[:\s]*\n*([\s\S]*?)(?=\n*---|\n*###|$)/i) ||
    targetText.match(/(?:Hashtags?|Hashtag Viral|Tags?)[:\s]*\n*([\s\S]*?)(?=\n*---|\n*###|$)/i) ||
    targetText.match(/((?:#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+\s*){2,})/i);

  let caption = captionMatch ? captionMatch[1].trim() : '';
  let hashtags = hashtagsMatch ? hashtagsMatch[1].trim() : '';

  // Clean markdown quotes or backticks if any
  caption = caption.replace(/^>+\s*/gm, '').replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();
  hashtags = hashtags.replace(/^```[a-z]*\n?/i, '').replace(/\n?```$/i, '').trim();

  // If hashtags was captured at end of caption, split them cleanly
  if (!hashtags && caption.includes('#')) {
    const hashIdx = caption.lastIndexOf('#');
    const potentialHashtagBlock = caption.slice(hashIdx);
    if (potentialHashtagBlock.match(/(?:#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+\s*){2,}/)) {
      hashtags = caption.slice(hashIdx).trim();
      caption = caption.slice(0, hashIdx).trim();
    }
  }

  // Remove any trailing block of hashtags that might be duplicate inside caption
  caption = caption.replace(/(?:\n\s*#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+\s*)+$/gi, '').trim();

  // Clean inline hashtags from sentences so there are NO stray # in the middle of sentences
  caption = sanitizeInlineTags(caption).trim();

  let tagsList: string[] = [];
  if (hashtags) {
    const rawTagList = hashtags.match(/#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+/g);
    if (rawTagList) {
      const filtered = rawTagList
        .filter((t) => !BANNED_SPAM_SET.has(t.toLowerCase()))
        .slice(0, 5);
      tagsList = filtered.length > 0 ? filtered : rawTagList.slice(0, 5);
      hashtags = tagsList.join(' ');
    }
  }

  if (caption || hashtags) {
    const charCount = caption.length;
    const wordCount = caption ? caption.split(/\s+/).filter(Boolean).length : 0;
    return {
      caption,
      hashtags,
      cleanCaptionWithoutTags: caption,
      tagsList,
      charCount,
      wordCount,
    };
  }

  return null;
}

export function parseClipSegments(rawText: string, defaultDurationSec = 10): ClipSegment[] {
  if (!rawText) return [];

  // Check structured data first
  const structured = extractStructuredData(rawText);

  // 1. Support structured.clips from AI Agent pipeline
  if (structured && Array.isArray(structured.clips) && structured.clips.length > 0) {
    return structured.clips.map((clip: any, index: number) => {
      const id = clip.clip_number || index + 1;
      const timestamp = (clip.start_time !== undefined && clip.end_time !== undefined)
        ? `${clip.start_time}-${clip.end_time} detik`
        : `Klip ${id}`;
      const stageLabel = clip.stageLabel || 'Sinematik';

      const microClips: MicroClipItem[] = Array.isArray(clip.scenes)
        ? clip.scenes.map((sc: any, scIdx: number) => {
            const timeTag = sc.start && sc.end ? `${sc.start} - ${sc.end}` : (sc.timeRange || '');
            const vis = sc.visual || '';
            const aks = sc.action || sc.aksi || '';
            const cam = sc.camera ? `Camera: ${sc.camera}` : '';
            const sua = sc.subtitle || sc.suara || null;
            const sub = sc.subject ? `Subjek: ${sc.subject}` : (sc.subteks || null);
            return {
              id: scIdx + 1,
              timeRange: timeTag,
              visual: vis,
              aksi: aks,
              suara: sua,
              subteks: sub,
              masterPrompt: cam ? `${cam} | Visual: ${vis} | Aksi: ${aks}` : `${vis}. ${aks}`,
            };
          })
        : [];

      return {
        id,
        title: `#${id} Segmen Prompt Klip ${id}`,
        timestamp,
        stageLabel,
        roleTag: `Stage: ${stageLabel}`,
        visual: clip.scenes?.[0]?.visual || `Adegan Klip ${id}`,
        aksi: clip.scenes?.map((s: any) => s.action || s.aksi).filter(Boolean).join('. ') || '',
        voiceOver: clip.scenes?.map((s: any) => s.subtitle || s.suara).filter(Boolean).join(' ') || '',
        subteks: '',
        masterPrompt: clip.master_prompt || '',
        content: clip.master_prompt || '',
        microClips,
      };
    });
  }

  // 2. Support structured.segments
  if (structured && Array.isArray(structured.segments) && structured.segments.length > 0) {
    return structured.segments.map((seg: any, index: number) => {
      const id = seg.segmentIndex || index + 1;
      const timestamp = seg.timeRange || `Segmen ${id}`;
      const stageLabel = seg.stageLabel || 'Sinematik';

      const microClips: MicroClipItem[] = Array.isArray(seg.microClips)
        ? seg.microClips.map((mc: any, mcIdx: number) => {
            const timeTag = mc.timeRange || '';
            const vis = mc.visual || '';
            const aks = mc.aksi || '';
            const sua = mc.suara || null;
            const sub = mc.subteks || null;
            const prompt = `${timeTag ? `[${timeTag}] ` : ''}Visual: ${vis}. Aksi: ${aks}.${sua ? ` Suara: "${sua}"` : ''}${sub ? ` Subteks: "${sub}"` : ''}`.trim();
            return {
              id: mcIdx + 1,
              timeRange: timeTag,
              visual: vis,
              aksi: aks,
              suara: sua,
              subteks: sub,
              masterPrompt: prompt,
            };
          })
        : [];

      const firstClip = microClips[0];
      const visual = firstClip?.visual || `Adegan segmen ${id}`;
      const aksi = microClips.map((c) => c.aksi).filter(Boolean).join('. ');
      const voiceOver = microClips.map((c) => c.suara).filter(Boolean).join(' ');
      const subteks = microClips.map((c) => c.subteks).filter(Boolean).join(' ');

      const promptBlocks = microClips.map((c) => {
        const lines = [];
        if (c.timeRange) lines.push(`[${c.timeRange}]`);
        if (c.visual) lines.push(`Visual: ${c.visual}`);
        if (c.aksi) lines.push(`Aksi: ${c.aksi}`);
        if (c.suara) lines.push(`Suara: "${c.suara}"`);
        if (c.subteks) lines.push(`Subteks: "${c.subteks}"`);
        return lines.join('\n');
      });

      const masterPrompt = promptBlocks.join('\n\n') || `${visual}\n${aksi}`;

      return {
        id,
        title: `Segmen ${id}`,
        timestamp,
        stageLabel,
        roleTag: `Stage: ${stageLabel}`,
        visual,
        aksi,
        voiceOver,
        subteks,
        masterPrompt,
        content: masterPrompt,
        microClips,
      };
    });
  }

  // Fallback: Check if markdown has ### 📹 SEGMEN blocks
  const segmentHeaderRegex = /###\s*📹?\s*SEGMEN\s*(\d+)[\s—\-]*\[?([^\]\n]*)\]?/gi;
  if (rawText.match(segmentHeaderRegex)) {
    const blocks = rawText.split(/(?=\n###\s*📹?\s*SEGMEN|\n##\s*📹?\s*SEGMEN)/gi);
    const parsedSegments: ClipSegment[] = [];

    for (const block of blocks) {
      const headerMatch = block.match(/(?:###|##)\s*📹?\s*SEGMEN\s*(\d+)[\s—\-]*\[?([^\]\n]*)\]?/i);
      if (!headerMatch) continue;

      const segIdx = parseInt(headerMatch[1], 10) || parsedSegments.length + 1;
      let timeRange = (headerMatch[2] || '').trim();
      const stageMatch = block.match(/\*\*Stage:\s*([^\*\n]+)\*\*/i);
      const stageLabel = stageMatch ? stageMatch[1].trim() : 'Sinematik';

      const codeBlockMatch = block.match(/```(?:text)?\n([\s\S]*?)```/);
      const bodyContent = codeBlockMatch ? codeBlockMatch[1] : block;

      const microClips: MicroClipItem[] = [];
      const lines = bodyContent.split('\n');
      let currentClip: Partial<MicroClipItem> = {};

      for (const line of lines) {
        const tMatch = line.match(/^\[?(\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s)?)\]?/i);
        if (tMatch && !line.toLowerCase().includes('segmen')) {
          if (currentClip.visual || currentClip.aksi) {
            microClips.push({
              id: microClips.length + 1,
              timeRange: currentClip.timeRange || '',
              visual: currentClip.visual || '',
              aksi: currentClip.aksi || '',
              suara: currentClip.suara || null,
              subteks: currentClip.subteks || null,
              masterPrompt: `${currentClip.timeRange ? `[${currentClip.timeRange}] ` : ''}Visual: ${currentClip.visual || ''}. Aksi: ${currentClip.aksi || ''}.${currentClip.suara ? ` Suara: "${currentClip.suara}"` : ''}${currentClip.subteks ? ` Subteks: "${currentClip.subteks}"` : ''}`.trim(),
            });
          }
          currentClip = { timeRange: tMatch[1].trim() };
        } else if (line.match(/Visual:/i)) {
          currentClip.visual = line.replace(/Visual:\s*/i, '').trim();
        } else if (line.match(/Aksi:/i)) {
          currentClip.aksi = line.replace(/Aksi:\s*/i, '').trim();
        } else if (line.match(/Suara:/i)) {
          currentClip.suara = line.replace(/Suara:\s*"?/i, '').replace(/"?$/, '').trim();
        } else if (line.match(/Subteks:/i)) {
          currentClip.subteks = line.replace(/Subteks:\s*"?/i, '').replace(/"?$/, '').trim();
        }
      }

      if (currentClip.visual || currentClip.aksi) {
        microClips.push({
          id: microClips.length + 1,
          timeRange: currentClip.timeRange || '',
          visual: currentClip.visual || '',
          aksi: currentClip.aksi || '',
          suara: currentClip.suara || null,
          subteks: currentClip.subteks || null,
          masterPrompt: `${currentClip.timeRange ? `[${currentClip.timeRange}] ` : ''}Visual: ${currentClip.visual || ''}. Aksi: ${currentClip.aksi || ''}.${currentClip.suara ? ` Suara: "${currentClip.suara}"` : ''}${currentClip.subteks ? ` Subteks: "${currentClip.subteks}"` : ''}`.trim(),
        });
      }

      if (!timeRange && microClips.length > 0) {
        timeRange = `${microClips[0].timeRange.split(/[–\-—]/)[0]}–${microClips[microClips.length - 1].timeRange.split(/[–\-—]/)[1] || ''}`;
      }

      const visual = microClips[0]?.visual || `Segmen ${segIdx}`;
      const aksi = microClips.map((c) => c.aksi).filter(Boolean).join('. ');
      const masterPrompt = bodyContent.trim();

      parsedSegments.push({
        id: segIdx,
        title: `Segmen ${segIdx}`,
        timestamp: timeRange || `Segmen ${segIdx}`,
        stageLabel,
        roleTag: `Stage: ${stageLabel}`,
        visual,
        aksi,
        masterPrompt,
        content: masterPrompt,
        microClips,
      });
    }

    if (parsedSegments.length > 0) {
      return parsedSegments;
    }
  }

  // Classic fallback: parse timeline matches
  const timelineRegex =
    /(?:^|\n)\s*(\d+(?:[.,]\d+)?)\s*[–\-—]\s*(\d+(?:[.,]\d+)?)\s*(?:detik|s|sec)?\s*\n([\s\S]*?)(?=(?:\n\s*\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s|sec)?)|$)/gi;

  const matches: Array<{ start: string; end: string; body: string }> = [];
  let m;
  while ((m = timelineRegex.exec(rawText)) !== null) {
    matches.push({
      start: m[1].replace(',', '.'),
      end: m[2].replace(',', '.'),
      body: m[3].trim(),
    });
  }

  if (matches.length > 0) {
    return matches.map((item, index) => {
      const id = index + 1;
      const startSec = parseFloat(item.start) || 0;
      const endSec = parseFloat(item.end) || startSec + defaultDurationSec;
      const timestamp = `${startSec}–${endSec} detik`;
      return {
        id,
        title: `Segmen ${id}`,
        timestamp,
        startSec,
        endSec,
        durationSec: Math.max(1, endSec - startSec),
        content: item.body,
        visual: item.body,
        aksi: '',
        masterPrompt: item.body,
      };
    });
  }

  return [];
}

export default function SplitPromptViewer({
  rawPrompt,
  segmentDuration = '10',
  targetAI = 'GENERAL',
  sourceCaption,
  onSendToPhotoPrompt,
}: SplitPromptViewerProps) {
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards');
  const [copiedCaption, setCopiedCaption] = useState(false);
  const [copiedHashtags, setCopiedHashtags] = useState(false);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [copiedAllPrompts, setCopiedAllPrompts] = useState(false);
  const [copiedClipKey, setCopiedClipKey] = useState<string | null>(null);
  const [copiedMasterPrompt, setCopiedMasterPrompt] = useState(false);
  const [copiedNegativePrompt, setCopiedNegativePrompt] = useState(false);
  const [expandedSegments, setExpandedSegments] = useState<Record<number, boolean>>({});
  const [isBatchPhotoModalOpen, setIsBatchPhotoModalOpen] = useState(false);

  const seoInfo = parseSeoCaptionAndHashtags(rawPrompt);
  const defaultSec = parseInt(segmentDuration, 10) || 10;
  const segments = parseClipSegments(rawPrompt, defaultSec);
  const videoAnalysis = extractVideoAnalysis(rawPrompt);
  const masterPromptText = extractMasterPromptText(rawPrompt);
  const negativePromptText = extractNegativePromptText(rawPrompt);
  const technicalSummary = extractTechnicalSummaryData(rawPrompt);
  const viralDna = extractViralDna(rawPrompt);
  const qualityScore = extractQualityScore(rawPrompt);

  const displayCaption = seoInfo?.caption || sourceCaption || '';
  const hashtagChips = seoInfo?.tagsList && seoInfo.tagsList.length > 0 ? seoInfo.tagsList.slice(0, 5) : [];

  const toggleSegmentExpand = (id: number) => {
    setExpandedSegments((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
  };

  const handleCopyTag = (tag: string) => {
    navigator.clipboard.writeText(tag);
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(null), 2000);
  };

  const handleCopyCaption = () => {
    if (!displayCaption) return;
    navigator.clipboard.writeText(displayCaption.trim());
    setCopiedCaption(true);
    setTimeout(() => setCopiedCaption(false), 2000);
    learningSync.track('caption_copied', { length: displayCaption.length });
  };

  const handleCopyHashtags = () => {
    if (hashtagChips.length === 0) return;
    const textToCopy = hashtagChips.map((t) => (t.startsWith('#') ? t : `#${t}`)).join(' ');
    navigator.clipboard.writeText(textToCopy);
    setCopiedHashtags(true);
    setTimeout(() => setCopiedHashtags(false), 2000);
  };

  const handleCopyMasterPrompt = () => {
    if (!masterPromptText) return;
    navigator.clipboard.writeText(masterPromptText);
    setCopiedMasterPrompt(true);
    setTimeout(() => setCopiedMasterPrompt(false), 2000);
  };

  const handleCopyNegativePrompt = () => {
    if (!negativePromptText) return;
    navigator.clipboard.writeText(negativePromptText);
    setCopiedNegativePrompt(true);
    setTimeout(() => setCopiedNegativePrompt(false), 2000);
  };

  const handleCopyAllPrompts = () => {
    if (segments.length === 0) return;
    const combined = segments
      .map((clip) => {
        const p = (clip.masterPrompt || clip.content || '').trim().replace(/^```(?:text)?\n?|```$/g, '');
        return `[Segmen ${clip.id} - ${clip.timestamp} - ${clip.stageLabel || ''}]\n${p}`;
      })
      .join('\n\n---\n\n');

    navigator.clipboard.writeText(combined);
    setCopiedAllPrompts(true);
    setTimeout(() => setCopiedAllPrompts(false), 2500);
    learningSync.track('prompt_copied', { type: 'all_clips', total: segments.length });
  };

  const handleCopyClipPrompt = (clipId: number | string, text: string) => {
    const cleanText = text.trim().replace(/^```(?:text)?\n?|```$/g, '');
    navigator.clipboard.writeText(cleanText);
    const key = `clip_${clipId}`;
    setCopiedClipKey(key);
    setTimeout(() => setCopiedClipKey(null), 2000);
  };

  const handleDownloadTxt = () => {
    const text = [
      `=== EKSTRAK PROMPT DARI VIDEO ===`,
      `Target AI: ${targetAI.toUpperCase()}`,
      `Durasi Per Klip: ${segmentDuration} Detik\n`,
      videoAnalysis ? `--- ANALISIS VIDEO ---\nVisual: ${videoAnalysis.visualAndStyle}\nAudio: ${videoAnalysis.audioAndMusic}\nKamera: ${videoAnalysis.cameraAndFraming}\nLighting: ${videoAnalysis.lightingAndMood}\n` : '',
      `--- CAPTION SEO ---`,
      displayCaption || '',
      `\n--- HASHTAG RELEVAN (MAX 5) ---`,
      hashtagChips.join(' '),
      `\n--- BREAKDOWN SEGMEN & MICRO-CLIP ---`,
      ...segments.map(
        (s) =>
          `\n[SEGMEN ${s.id} - ${s.timestamp} ${s.stageLabel ? `(${s.stageLabel})` : ''}]\n${(s.masterPrompt || s.content || '').trim().replace(/^```(?:text)?\n?|```$/g, '')}`
      ),
      masterPromptText ? `\n--- MASTER PROMPT (FULL VIDEO) ---\n${masterPromptText}` : '',
      negativePromptText ? `\n--- NEGATIVE PROMPT ---\n${negativePromptText}` : '',
    ].filter(Boolean).join('\n');

    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `ekstrak-prompt-video-${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Top Utility Bar */}
      <div className="flex items-center justify-between gap-2 pb-1 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#5b50e5]" />
            AI Content Clone Engine
          </span>
          <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 text-xs font-semibold">
            {segments.length} Segmen
          </span>
        </div>

        <div className="flex items-center gap-2">
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
            title="Unduh seluruh prompt dalam file teks"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Unduh .TXT</span>
          </button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        /* Markdown Raw View */
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
            <ReactMarkdown>{rawPrompt}</ReactMarkdown>
          </div>
        </div>
      ) : (
        /* Structured Cards View */
        <div className="space-y-6">
          {/* QUALITY CONTROL SCORE BANNER */}
          {qualityScore && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className={`p-4 sm:p-5 rounded-2xl border ${
                qualityScore.passed
                  ? 'bg-emerald-50/70 border-emerald-200/80 text-emerald-950'
                  : 'bg-amber-50/70 border-amber-200/80 text-amber-950'
              } shadow-xs space-y-3`}
            >
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs ${
                      qualityScore.passed ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                    }`}
                  >
                    {qualityScore.total}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider">
                      Quality Control Intelligence System
                    </h4>
                    <p className="text-[11px] opacity-80">
                      {qualityScore.passed
                        ? 'Output lolos uji relevansi 6 pilar standar AI Content Clone Engine (Skor ≥ 85).'
                        : 'Output telah disesuaikan otomatis untuk memenuhi standar relevansi minimal.'}
                    </p>
                  </div>
                </div>
                <span
                  className={`px-2.5 py-1 rounded-full text-[11px] font-bold tracking-wide uppercase ${
                    qualityScore.passed
                      ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                      : 'bg-amber-100 text-amber-800 border border-amber-200'
                  }`}
                >
                  {qualityScore.passed ? 'QC PASSED (100%)' : 'AUTO-CORRECTED'}
                </span>
              </div>

              {/* 6 Pilar Score Indicators */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 pt-1 text-[11px]">
                <div className="p-2 rounded-lg bg-white/70 border border-slate-200/60 text-center">
                  <span className="block text-slate-500 font-medium">Product Match</span>
                  <span className="font-bold text-slate-800">{qualityScore.breakdown.product_consistency}%</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 border border-slate-200/60 text-center">
                  <span className="block text-slate-500 font-medium">Prompt Quality</span>
                  <span className="font-bold text-slate-800">{qualityScore.breakdown.prompt_quality}%</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 border border-slate-200/60 text-center">
                  <span className="block text-slate-500 font-medium">Caption Match</span>
                  <span className="font-bold text-slate-800">{qualityScore.breakdown.caption_match}%</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 border border-slate-200/60 text-center">
                  <span className="block text-slate-500 font-medium">Hashtag Valid</span>
                  <span className="font-bold text-slate-800">{qualityScore.breakdown.hashtag_validation}%</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 border border-slate-200/60 text-center">
                  <span className="block text-slate-500 font-medium">Scene Timing</span>
                  <span className="font-bold text-slate-800">{qualityScore.breakdown.scene_timing}%</span>
                </div>
                <div className="p-2 rounded-lg bg-white/70 border border-slate-200/60 text-center">
                  <span className="block text-slate-500 font-medium">Audio Match</span>
                  <span className="font-bold text-slate-800">{qualityScore.breakdown.audio_visual_match}%</span>
                </div>
              </div>
            </motion.div>
          )}

          {/* VIRAL DNA CARD */}
          {viralDna && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Sparkles className="w-4 h-4 text-[#5b50e5]" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Viral DNA & Retention Analysis
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                {viralDna.hook_type && (
                  <div className="p-3 rounded-xl bg-indigo-50/50 border border-indigo-100 space-y-1">
                    <span className="font-bold text-indigo-950 block">🎯 Hook Type</span>
                    <p className="text-slate-700 leading-relaxed">{viralDna.hook_type}</p>
                  </div>
                )}
                {viralDna.retention_trigger && (
                  <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100 space-y-1">
                    <span className="font-bold text-emerald-950 block">⚡ Retention Trigger</span>
                    <p className="text-slate-700 leading-relaxed">{viralDna.retention_trigger}</p>
                  </div>
                )}
                {viralDna.emotional_curve && (
                  <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-100 space-y-1">
                    <span className="font-bold text-amber-950 block">📈 Emotional Curve</span>
                    <p className="text-slate-700 leading-relaxed">{viralDna.emotional_curve}</p>
                  </div>
                )}
              </div>

              {viralDna.structure && (
                <div className="p-3.5 rounded-xl bg-slate-50/80 border border-slate-100 space-y-2 text-xs">
                  <span className="font-bold text-slate-800 block">Alur Struktur Konten (Hook → Body → Climax → CTA)</span>
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px]">
                    <div className="p-2 rounded-lg bg-white border border-slate-200/70">
                      <span className="font-bold text-indigo-600 block">Hook:</span>
                      <p className="text-slate-600 mt-0.5">{viralDna.structure.hook}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/70">
                      <span className="font-bold text-blue-600 block">Body:</span>
                      <p className="text-slate-600 mt-0.5">{viralDna.structure.body}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/70">
                      <span className="font-bold text-amber-600 block">Climax:</span>
                      <p className="text-slate-600 mt-0.5">{viralDna.structure.climax}</p>
                    </div>
                    <div className="p-2 rounded-lg bg-white border border-slate-200/70">
                      <span className="font-bold text-emerald-600 block">CTA:</span>
                      <p className="text-slate-600 mt-0.5">{viralDna.structure.cta}</p>
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* 1. ANALISIS VIDEO CARD */}
          {videoAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-4"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Clapperboard className="w-4 h-4 text-[#5b50e5]" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Analisis Video & Elemen Visual
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
                {videoAnalysis.visualAndStyle && (
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Video className="w-3.5 h-3.5 text-[#5b50e5]" />
                      <span>Visual & Gaya</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{videoAnalysis.visualAndStyle}</p>
                  </div>
                )}

                {videoAnalysis.audioAndMusic && (
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Volume2 className="w-3.5 h-3.5 text-indigo-600" />
                      <span>Audio & Musik</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{videoAnalysis.audioAndMusic}</p>
                  </div>
                )}

                {videoAnalysis.cameraAndFraming && (
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Camera className="w-3.5 h-3.5 text-sky-600" />
                      <span>Kamera & Lensa</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{videoAnalysis.cameraAndFraming}</p>
                  </div>
                )}

                {videoAnalysis.lightingAndMood && (
                  <div className="p-3 rounded-xl bg-slate-50/80 border border-slate-100 space-y-1">
                    <div className="flex items-center gap-1.5 font-bold text-slate-800">
                      <Sliders className="w-3.5 h-3.5 text-amber-600" />
                      <span>Lighting & Mood</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{videoAnalysis.lightingAndMood}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* 2. CAPTION SEO TIKTOK / REELS / SHORTS CARD */}
          {displayCaption && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
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
              <p className="text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap font-normal">
                {displayCaption}
              </p>
            </motion.div>
          )}

          {/* 3. HASHTAG CARD (MAX 5 TAG) */}
          {hashtagChips.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Hash className="w-4 h-4 text-sky-600" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    5 Hashtag Teroptimasi (1 Broad + 2 Niche + 2 Long-Tail)
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
                  <span>{copiedHashtags ? 'Tersalin' : 'Salin Semua Hashtag'}</span>
                </button>
              </div>
              <div className="flex items-center gap-2 flex-wrap pt-0.5">
                {hashtagChips.map((tag, tIdx) => {
                  const cleanTag = tag.startsWith('#') ? tag : `#${tag}`;
                  const isThisCopied = copiedTag === cleanTag;
                  return (
                    <button
                      key={tIdx}
                      type="button"
                      onClick={() => handleCopyTag(cleanTag)}
                      className="group px-3 py-1.5 rounded-lg bg-sky-50/80 hover:bg-sky-100 text-sky-700 border border-sky-200/60 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
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

          {/* 4. BREAKDOWN PER SEGMEN & MICRO-CLIP */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="space-y-4 pt-1"
          >
            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#5b50e5] shadow-2xs">
                  <Film className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-base sm:text-lg font-bold text-slate-900 leading-tight">
                    Breakdown Per Segmen & Micro-Clip
                  </h4>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Pecah durasi: {segmentDuration === 'auto' ? 'Penuh' : `${segmentDuration}s`} · Setiap segmen di-breakdown per micro-clip 1–2 detik
                  </p>
                </div>
              </div>

              {segments.length > 0 && (
                <div className="flex items-center gap-2 flex-wrap self-end sm:self-auto">
                  {onSendToPhotoPrompt && (
                    <button
                      type="button"
                      onClick={() => setIsBatchPhotoModalOpen(true)}
                      className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-2xs"
                    >
                      <Camera className="w-4 h-4 text-slate-600" />
                      <span>Generate Semua Prompt Foto ({segments.length} Segmen)</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleCopyAllPrompts}
                    className="px-4 py-2 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-sm active:scale-98"
                  >
                    {copiedAllPrompts ? (
                      <Check className="w-4 h-4 text-emerald-200" />
                    ) : (
                      <Copy className="w-4 h-4 text-white" />
                    )}
                    <span>
                      {copiedAllPrompts ? 'Tersalin' : `Salin Semua ${segments.length} Segmen`}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Segments list */}
            {segments.length === 0 ? (
              <div className="p-8 sm:p-12 rounded-2xl bg-white border border-slate-200/80 text-center space-y-2.5 shadow-xs">
                <Film className="w-10 h-10 text-slate-300 mx-auto" />
                <h5 className="text-sm sm:text-base font-semibold text-slate-800">
                  Belum ada segmen prompt
                </h5>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Segmen prompt belum terdeteksi. Silakan coba proses ulang.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {segments.map((seg, sIdx) => {
                  const segKey = `seg_${seg.id}`;
                  const isCopied = copiedClipKey === segKey;
                  const promptText = (seg.masterPrompt || seg.content || '')
                    .trim()
                    .replace(/^```(?:text)?\n?|```$/g, '');
                  const hasMicroClips = seg.microClips && seg.microClips.length > 0;
                  const isExpanded = expandedSegments[seg.id] ?? true;

                  return (
                    <div
                      key={seg.id || sIdx}
                      className="rounded-2xl bg-white border border-slate-200/80 shadow-xs overflow-hidden hover:border-slate-300 transition-all"
                    >
                      {/* Segment Card Header */}
                      <div className="p-5 sm:p-6 bg-white border-b border-slate-100 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="px-2.5 py-1 rounded-lg bg-indigo-50 text-[#5b50e5] font-bold text-xs border border-indigo-100">
                            #{seg.id} Segmen Prompt Klip {seg.id}
                          </span>
                          <span className="text-sm sm:text-base font-bold text-slate-900">
                            {seg.timestamp}
                          </span>
                          {seg.stageLabel && (
                            <span className="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 text-xs font-semibold">
                              Stage: {seg.stageLabel}
                            </span>
                          )}
                          {hasMicroClips && (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-medium border border-emerald-200/50">
                              {seg.microClips!.length} micro-clip (1–2s)
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-2 self-end sm:self-auto">
                          {onSendToPhotoPrompt && (
                            <button
                              type="button"
                              onClick={() => {
                                let promptToPass = `Visual adegan segmen [${seg.timestamp}]: ${promptText}`;
                                if (negativePromptText) {
                                  promptToPass += `\n\nNegative Prompt: ${negativePromptText}`;
                                }
                                onSendToPhotoPrompt(promptToPass, {
                                  negativePrompt: negativePromptText || undefined,
                                });
                              }}
                              className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-medium flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                              title="Kirim ke Generator Prompt Foto"
                            >
                              <Camera className="w-3.5 h-3.5 text-slate-500" />
                              <span>Ke Prompt Foto</span>
                            </button>
                          )}

                          <button
                            type="button"
                            onClick={() => handleCopyClipPrompt(seg.id, promptText)}
                            className="px-3 py-1.5 rounded-lg bg-indigo-50/80 hover:bg-indigo-100 border border-indigo-200 text-indigo-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                            title="Salin seluruh prompt klip ini"
                          >
                            {isCopied ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5 text-indigo-600" />
                            )}
                            <span>{isCopied ? 'Tersalin' : 'Salin Prompt Klip'}</span>
                          </button>

                          {hasMicroClips && (
                            <button
                              type="button"
                              onClick={() => toggleSegmentExpand(seg.id)}
                              className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 transition-colors"
                              title={isExpanded ? 'Sembunyikan micro-clip' : 'Tampilkan micro-clip'}
                            >
                              {isExpanded ? (
                                <ChevronUp className="w-4 h-4" />
                              ) : (
                                <ChevronDown className="w-4 h-4" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* MASTER PROMPT AI KLIP SECTION */}
                      <div className="p-5 sm:p-6 bg-slate-50/70 border-b border-slate-100 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-[#5b50e5]" />
                            MASTER PROMPT AI KLIP {seg.id}
                          </span>
                          <span className="text-[11px] text-slate-500 font-medium">Veo • Runway • Kling • Sora</span>
                        </div>
                        <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 text-xs sm:text-sm font-mono text-slate-800 leading-relaxed whitespace-pre-wrap select-all shadow-2xs">
                          {promptText}
                        </div>
                      </div>

                      {/* Micro-Clips Breakdown List */}
                      {hasMicroClips && isExpanded ? (
                        <div className="p-5 sm:p-6 bg-slate-50/50 space-y-3">
                          <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                            <Layers className="w-3.5 h-3.5 text-[#5b50e5]" />
                            <span>BREAKDOWN DETAIL:</span>
                          </div>

                          <div className="grid grid-cols-1 gap-2.5">
                            {seg.microClips!.map((mc, mcIdx) => {
                              const mcKey = `mc_${seg.id}_${mcIdx}`;
                              const isMcCopied = copiedClipKey === mcKey;
                              return (
                                <div
                                  key={mcIdx}
                                  className="p-4 rounded-xl bg-white border border-slate-200/80 shadow-2xs hover:border-slate-300 transition-all space-y-2"
                                >
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-xs">
                                        Scene {mcIdx + 1} {mc.timeRange ? `(${mc.timeRange})` : ''}
                                      </span>
                                    </div>
                                    <button
                                      type="button"
                                      onClick={() => handleCopyClipPrompt(mcKey, mc.masterPrompt || `${mc.visual} ${mc.aksi}`)}
                                      className="px-2.5 py-1 rounded-md bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 text-[11px] font-medium flex items-center gap-1 transition-colors cursor-pointer"
                                      title="Salin prompt micro-clip ini"
                                    >
                                      {isMcCopied ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3 text-slate-500" />
                                      )}
                                      <span>{isMcCopied ? 'Tersalin' : 'Salin Klip'}</span>
                                    </button>
                                  </div>

                                  <div className="text-xs space-y-1 text-slate-700">
                                    {mc.visual && (
                                      <div>
                                        <strong className="text-slate-900">Visual:</strong> {mc.visual}
                                      </div>
                                    )}
                                    {mc.aksi && (
                                      <div>
                                        <strong className="text-slate-900">Action:</strong> {mc.aksi}
                                      </div>
                                    )}
                                    {mc.suara && (
                                      <div className="text-indigo-700">
                                        <strong className="text-indigo-900">Suara:</strong> "{mc.suara}"
                                      </div>
                                    )}
                                    {mc.subteks && (
                                      <div className="text-amber-700">
                                        <strong className="text-amber-900">Subjek:</strong> {mc.subteks.replace(/^Subjek:\s*/i, '')}
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </motion.div>

          {/* 5. MASTER PROMPT (FULL VIDEO) CARD */}
          {masterPromptText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Master Prompt (Full Video — Siap Pakai di Runway, Sora, Veo, Kling)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyMasterPrompt}
                  className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedMasterPrompt ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-amber-600" />
                  )}
                  <span>{copiedMasterPrompt ? 'Tersalin' : 'Salin Master Prompt'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-[#f8fafc] border border-slate-100 text-slate-800 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text font-normal font-mono">
                {masterPromptText}
              </div>
            </motion.div>
          )}

          {/* 6. NEGATIVE PROMPT CARD */}
          {negativePromptText && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.25 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div className="flex items-center gap-2">
                  <ShieldAlert className="w-4 h-4 text-rose-500" />
                  <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Negative Prompt (What to Avoid)
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleCopyNegativePrompt}
                  className="px-3 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 text-rose-700 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  {copiedNegativePrompt ? (
                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="w-3.5 h-3.5 text-rose-600" />
                  )}
                  <span>{copiedNegativePrompt ? 'Tersalin' : 'Salin Negative Prompt'}</span>
                </button>
              </div>

              <div className="p-4 rounded-xl bg-rose-50/30 border border-rose-100 text-slate-700 text-xs sm:text-sm leading-relaxed whitespace-pre-wrap select-text font-mono">
                {negativePromptText}
              </div>
            </motion.div>
          )}

          {/* 7. RINGKASAN TEKNIS */}
          {technicalSummary && Object.keys(technicalSummary).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="p-5 sm:p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs space-y-3"
            >
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <BarChart3 className="w-4 h-4 text-slate-600" />
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Ringkasan Teknis Produksi Video
                </h4>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                {Object.entries(technicalSummary).map(([key, val], idx) => (
                  <div key={idx} className="p-3 rounded-xl bg-slate-50 border border-slate-100 space-y-0.5">
                    <span className="text-[11px] text-slate-400 font-semibold uppercase tracking-wider block">
                      {key}
                    </span>
                    <span className="text-slate-800 font-bold text-sm truncate block">
                      {val}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}

      {/* Batch Photo Prompt Modal */}
      {segments.length > 0 && onSendToPhotoPrompt && (
        <BatchPhotoPromptModal
          isOpen={isBatchPhotoModalOpen}
          onClose={() => setIsBatchPhotoModalOpen(false)}
          conceptTitle={`Ekstrak Prompt Video (${segments.length} Segmen)`}
          clips={segments.map((s) => ({
            id: s.id,
            title: s.title,
            timeRange: s.timestamp,
            actionAndVO: s.masterPrompt || s.content,
            aiPrompt: s.masterPrompt || s.content,
          }))}
          onConfirm={(opts) => {
            const batchClipsText =
              `KONSEP EKSTRAK PROMPT VIDEO BATCH PROMPT FOTO (${segments.length} SEGMEN):\n` +
              segments
                .map(
                  (s) =>
                    `### [${s.timestamp}] Segmen ${s.id}: ${s.title} (${s.stageLabel || ''})\nDeskripsi Adegan Visual:\n${s.masterPrompt || s.content}`
                )
                .join('\n\n---\n\n');

            learningSync.track('prompt_copied', {
              type: 'batch_photo_prompts_send',
              totalClips: segments.length,
              segmentDuration,
              targetAI,
              aspectRatio: opts.aspectRatio,
            });

            onSendToPhotoPrompt(batchClipsText, {
              autoGenerate: true,
              aspectRatio: opts.aspectRatio,
              photoStyle: opts.photoStyle,
              targetGenerator: opts.targetGenerator,
              negativePrompt: opts.negativePrompt,
              subjectReference: opts.subjectReference,
              productReference: opts.productReference,
            });
            setIsBatchPhotoModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

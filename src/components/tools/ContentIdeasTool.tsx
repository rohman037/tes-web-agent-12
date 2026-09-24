import React, { useState, useEffect, useRef, DragEvent, ChangeEvent } from 'react';
import { 
  Lightbulb, 
  Sparkles, 
  Copy, 
  Check, 
  Loader2, 
  AlertCircle, 
  FileVideo, 
  Upload, 
  RefreshCw, 
  Sliders, 
  Hash, 
  MessageSquare, 
  Target, 
  Flame, 
  Camera, 
  Share2, 
  Layers, 
  Cpu, 
  Video, 
  Film, 
  ListFilter,
  Megaphone,
  Wand2,
  Clock,
  Scissors,
  Download,
  Search,
  ImageIcon,
  ShoppingBag,
  Clipboard,
  ExternalLink,
  X,
  FileText,
  Link2,
  ChevronDown
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import { saveHistoryItem } from '../../lib/history';
import { getAntiLimitHeaders } from '../../lib/antiLimit';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import EngagingLoadingState from '../common/EngagingLoadingState';
import { useAccessGate } from '../../hooks/useAccessGate';
import { useGenerationLog } from '../../hooks/useGenerationLog';
import BatchPhotoPromptModal, { ClipSummaryItem } from '../modals/BatchPhotoPromptModal';
import ViralReplicaOutputView from './ViralReplicaOutputView';
import { ReplicaVideoResponse } from '@/src/types/viralReplicaContracts';

interface ContentIdeasToolProps {
  initialVideoFile?: File | null;
  initialTikTokTitle?: string;
  initialTopic?: string;
  initialTikTokUrl?: string;
  onSendToPhotoPrompt?: (
    text: string,
    options?: {
      negativePrompt?: string;
      referenceImage?: File;
      autoGenerate?: boolean;
      aspectRatio?: string;
      photoStyle?: string;
      targetGenerator?: string;
    }
  ) => void;
  onSendToVideoPrompt?: (file: File) => void;
}

export interface IdeaClipSegment {
  id: number;
  timeRange: string;
  title: string;
  actionAndVO: string;
  aiPrompt: string;
}

export interface AEOOverview {
  syntheticQueries: string[];
  coreEntity?: string;
  targetPlatforms?: string[];
}

export interface ParsedIdea {
  id: number;
  title: string;
  typeAndAngle: string;
  targetAudience: string;
  aeoQueryMapping?: string;
  alasanRelevansi?: string;
  hook: string;
  bluffHook?: string;
  atomicAnswerSummary?: string;
  consensusTrigger?: string;
  visualAudioGuide: string;
  scenePrompts: string;
  clips: IdeaClipSegment[];
  caption: string;
  hashtags: string;
  fullRawText: string;
}

export const parseAEOOverviewFromMarkdown = (text: string): AEOOverview | null => {
  if (!text) return null;
  const queries: string[] = [];
  const fanOutBlock = text.match(/(?:AEO SYNTHETIC QUERY FAN-OUT|Synthetic Fan-Out Queries)[\s\S]*?(?=\n###|\n---|#|$)/i);
  if (fanOutBlock) {
    const lines = fanOutBlock[0].split('\n');
    lines.forEach(line => {
      const qMatch = line.match(/(?:>|\*|-|\d+\.)\s*(?:\*)?([^*\n]+)(?:\*)?/);
      if (qMatch && qMatch[1] && !line.includes('AEO SYNTHETIC') && !line.includes('AI SEARCH ENGINE')) {
        const cleaned = qMatch[1].replace(/^[>\s*\d.\-]+/, '').replace(/[\*\_]/g, '').trim();
        if (cleaned && cleaned.length > 3) queries.push(cleaned);
      }
    });
  }

  const entityMatch = text.match(/(?:Core Entity|Entitas Utama):\s*([^\n]+)/i);
  const platformsMatch = text.match(/(?:Target AI Search Platforms|Target Platform):\s*([^\n]+)/i);

  if (queries.length > 0 || entityMatch || platformsMatch) {
    return {
      syntheticQueries: queries,
      coreEntity: entityMatch ? entityMatch[1].trim() : undefined,
      targetPlatforms: platformsMatch ? platformsMatch[1].trim().split(',').map(s => s.trim()) : ['Google AI Overviews', 'ChatGPT Search', 'Perplexity'],
    };
  }
  return null;
};

// Helper function to parse scenePrompts markdown block into individual timestamped clip objects
export const parseClipSegmentsFromScenePrompts = (text: string): IdeaClipSegment[] => {
  if (!text) return [];

  const clips: IdeaClipSegment[] = [];

  // 1. First attempt: check for the strict timeline breakdown format (e.g., "0–2 detik", "0-2 detik", "2–3,8 detik")
  const timelineSegmentRegex = /(?:^|\n)\s*(\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|dtk|s))\s*\n+([\s\S]*?)(?=(?:\n\s*\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|dtk|s)|\n\s*-\s*\*\*AEO|\n\s*-\s*\*\*Call|\n\s*-\s*\*\*Draft|\n\s*-\s*\*\*Caption|\n\s*-\s*\*\*Hashtag|\n\s*-\s*\*\*Rekomendasi|$))/gi;

  let timelineMatch;
  let timelineIdx = 1;

  while ((timelineMatch = timelineSegmentRegex.exec(text)) !== null) {
    const rawTime = timelineMatch[1].trim();
    const body = timelineMatch[2].trim();

    const visualMatch = body.match(/Visual:\s*([^\n]+(?:\n(?!\s*(?:Aksi|voice over|Voice Over|Subteks):)[^\n]+)*)/i);
    const aksiMatch = body.match(/Aksi:\s*([^\n]+(?:\n(?!\s*(?:Visual|voice over|Voice Over|Subteks):)[^\n]+)*)/i);
    const voMatch = body.match(/(?:voice over|Voice Over):\s*([^\n]+(?:\n(?!\s*(?:Visual|Aksi|Subteks):)[^\n]+)*)/i);
    const subteksMatch = body.match(/Subteks:\s*([^\n]+(?:\n(?!\s*(?:Visual|Aksi|voice over|Voice Over):)[^\n]+)*)/i);

    const visualText = visualMatch ? visualMatch[1].trim() : '';
    const aksiText = aksiMatch ? aksiMatch[1].trim() : '';
    const speechOrSub = voMatch ? `voice over: ${voMatch[1].trim().replace(/^["']|["']$/g, '')}` : subteksMatch ? `Subteks: ${subteksMatch[1].trim().replace(/^["']|["']$/g, '')}` : '';

    const combinedActionVO = [
      aksiText ? `Aksi: ${aksiText}` : '',
      speechOrSub,
    ].filter(Boolean).join('\n') || body;

    const combinedAiPrompt = [
      visualText ? `Visual: ${visualText}` : '',
      aksiText ? `Aksi: ${aksiText}` : '',
      speechOrSub,
    ].filter(Boolean).map(s => {
      const trimmed = s.trim();
      return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
    }).join(' ') || body;

    clips.push({
      id: timelineIdx,
      timeRange: rawTime,
      title: `Segmen ${timelineIdx} (${rawTime})`,
      actionAndVO: combinedActionVO,
      aiPrompt: combinedAiPrompt,
    });
    timelineIdx++;
  }

  if (clips.length > 0) {
    return clips;
  }

  // 2. Second attempt: Match pattern like: - **[00:00 - 00:05] Klip 1 (Hook)**: ...
  const clipRegex = /(?:^|\n)\s*-\s*\*\*\[(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})\]\s*([^\*:]+)\*\*:?([\s\S]*?)(?=(?:\n\s*-\s*\*\*\[\d{2}:\d{2}|$))/gi;

  let match;
  let index = 1;

  while ((match = clipRegex.exec(text)) !== null) {
    const timeRange = match[1].trim();
    const rawTitle = match[2].trim();
    const contentBlock = match[3].trim();

    // Extract Aksi & Dialog/VO
    let actionAndVO = '';
    const actMatch = contentBlock.match(/(?:\*Aksi & Dialog\/VO\*|\*Aksi & VO\*|\*Aksi\*):\s*([\s\S]*?)(?=(?:\n\s*-\s*\*Prompt AI Video\*|\n\s*-\s*\*Prompt|```|\[Style\]:|$))/i);
    if (actMatch) {
      actionAndVO = actMatch[1].trim().replace(/^\[|\]$/g, '');
    } else {
      // Fallback: take content before ``` or [Style]:
      const cutoffMatch = contentBlock.match(/^([\s\S]*?)(?=(?:```|\[Style\]:|\*Prompt AI Video\*))/i);
      actionAndVO = cutoffMatch ? cutoffMatch[1].trim() : contentBlock;
    }

    // Extract Prompt AI Video
    let aiPrompt = '';
    const codeMatch = contentBlock.match(/```(?:text)?\n?([\s\S]*?)```/i);
    if (codeMatch) {
      aiPrompt = codeMatch[1].trim();
    } else {
      const tagMatch = contentBlock.match(/(\[Style\]:[\s\S]*?)$/i);
      if (tagMatch) {
        aiPrompt = tagMatch[1].trim();
      } else {
        const promptMatch = contentBlock.match(/(?:\*Prompt AI Video\*|\*Prompt AI\*|\*Prompt\*):\s*([\s\S]*?)$/i);
        if (promptMatch) {
          aiPrompt = promptMatch[1].replace(/[`]/g, '').trim();
        }
      }
    }

    clips.push({
      id: index++,
      timeRange,
      title: rawTitle || `Klip ${index - 1}`,
      actionAndVO,
      aiPrompt,
    });
  }

  // Fallback parsing if non-standard list formatting
  if (clips.length === 0 && text.includes('Klip')) {
    const blocks = text.split(/(?=\n\s*-\s*\*+\[?0\d:|\n\s*-\s*\*+Klip)/gi).filter(Boolean);
    blocks.forEach((b, i) => {
      const timeMatch = b.match(/\[(\d{2}:\d{2}\s*-\s*\d{2}:\d{2})\]/);
      const codeMatch = b.match(/```(?:text)?\n?([\s\S]*?)```/i);
      const actMatch = b.match(/(?:\*Aksi[^\*]*\*):\s*([^\n]+)/i);

      clips.push({
        id: i + 1,
        timeRange: timeMatch ? timeMatch[1] : `Segmen ${i + 1}`,
        title: `Klip ${i + 1}`,
        actionAndVO: actMatch ? actMatch[1].trim() : b.replace(/```[\s\S]*?```/g, '').replace(/[\*#]/g, '').trim(),
        aiPrompt: codeMatch ? codeMatch[1].trim() : '',
      });
    });
  }

  return clips;
};

export default function ContentIdeasTool({
  initialVideoFile,
  initialTikTokTitle,
  initialTopic,
  initialTikTokUrl,
  onSendToPhotoPrompt,
  onSendToVideoPrompt,
}: ContentIdeasToolProps) {
  const accessGate = useAccessGate();
  const { logGeneration } = useGenerationLog();

  const [tiktokUrl, setTiktokUrl] = useState<string>(initialTikTokUrl || '');
  const [isFetchingTikTok, setIsFetchingTikTok] = useState<boolean>(false);
  const [tiktokFetchSuccess, setTiktokFetchSuccess] = useState<boolean>(false);

  const [file, setFile] = useState<File | null>(initialVideoFile || null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [tiktokTitle, setTiktokTitle] = useState<string>(initialTikTokTitle || '');
  const [topic, setTopic] = useState<string>(initialTopic || '');
  const [tiktokShopUrl, setTiktokShopUrl] = useState('');
  const [isFetchingShop, setIsFetchingShop] = useState<boolean>(false);
  const [shopProductInfo, setShopProductInfo] = useState<{
    name: string;
    price?: string;
    description?: string;
    imageUrl?: string;
  } | null>(null);
  const [contentType, setContentType] = useState<string>('affiliate');
  const [tone, setTone] = useState<string>('persuasive');
  const [maxDuration, setMaxDuration] = useState<string>('60'); // 8s to 180s interactive slider
  const [segmentDuration, setSegmentDuration] = useState<string>('6'); // 4 | 6 | 8 | 10 | 15 | auto
  const [targetAI, setTargetAI] = useState<string>('general');
  const [numIdeas, setNumIdeas] = useState<number>(1);

  // Mode AEO Target diatur otomatis ('both': short & long-tail search intent)
  const aeoQueryMode: 'short' | 'long' | 'both' = 'both';
  const [enableBigSound, setEnableBigSound] = useState<boolean>(true);
  const [enableTextOverlay, setEnableTextOverlay] = useState<boolean>(true);
  const userSeedQueries: string[] = [];

  const [refImageFile, setRefImageFile] = useState<File | null>(null);
  const [refPreviewUrl, setRefPreviewUrl] = useState<string | null>(null);
  const refFileInputRef = useRef<HTMLInputElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isRefDragging, setIsRefDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progressStep, setProgressStep] = useState<string>('Tahap 1: Menganalisis elemen visual asli video...');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [rawResult, setRawResult] = useState<string | null>(null);
  const [structuredResult, setStructuredResult] = useState<ReplicaVideoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeModelUsed, setActiveModelUsed] = useState<string | null>(null);

  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('cached_ideas_result');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed.result) setRawResult(parsed.result);
        if (parsed.structured) setStructuredResult(parsed.structured);
        if (parsed.modelUsed) setActiveModelUsed(parsed.modelUsed);
      }
    } catch (e) {
      // ignore
    }
  }, []);

  // Copy states
  const [copiedIdeaId, setCopiedIdeaId] = useState<number | null>(null);
  const [copiedHookId, setCopiedHookId] = useState<number | null>(null);
  const [copiedVisualId, setCopiedVisualId] = useState<number | null>(null);
  const [copiedCaptionId, setCopiedCaptionId] = useState<number | null>(null);
  const [copiedHashtagsId, setCopiedHashtagsId] = useState<number | null>(null);
  const [copiedScenesId, setCopiedScenesId] = useState<number | null>(null);
  const [copiedClipKey, setCopiedClipKey] = useState<string | null>(null);
  const [copiedTag, setCopiedTag] = useState<string | null>(null);
  const [activeIdeaIndex, setActiveIdeaIndex] = useState<number>(0);
  const [showStrategicDetails, setShowStrategicDetails] = useState<boolean>(false);
  const [copiedAll, setCopiedAll] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'raw'>('cards');

  // Batch Photo Prompt Modal State
  const [isBatchPhotoModalOpen, setIsBatchPhotoModalOpen] = useState(false);
  const [batchModalData, setBatchModalData] = useState<{
    conceptTitle: string;
    clips: ClipSummaryItem[];
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (initialVideoFile) {
      setFile(initialVideoFile);
      const url = URL.createObjectURL(initialVideoFile);
      setPreviewUrl(url);
    }
  }, [initialVideoFile]);

  useEffect(() => {
    if (initialTikTokTitle) {
      setTiktokTitle(initialTikTokTitle);
    }
  }, [initialTikTokTitle]);

  useEffect(() => {
    if (initialTopic) {
      setTopic(initialTopic);
    }
  }, [initialTopic]);

  useEffect(() => {
    if (initialTikTokUrl) {
      setTiktokUrl(initialTikTokUrl);
      handleFetchTikTokLink(initialTikTokUrl);
    }
  }, [initialTikTokUrl]);

  const handleFetchShopProduct = async (overrideUrl?: string) => {
    const target = (overrideUrl || tiktokShopUrl).trim();
    if (!target) return;
    setIsFetchingShop(true);
    setError(null);
    try {
      const res = await fetch('/api/tiktok-shop/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: target }),
      });
      const data = await safeParseJson(res);
      if (data.product) {
        setShopProductInfo(data.product);
        if (data.product.name) {
          if (!topic.trim()) setTopic(data.product.name);
          if (!tiktokTitle.trim()) setTiktokTitle(data.product.name);
        }
      } else if (data.error) {
        console.warn('Gagal ambil detail produk:', data.error);
      }
    } catch (err) {
      console.warn('Error fetching shop info:', err);
    } finally {
      setIsFetchingShop(false);
    }
  };

  const handlePasteShopUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text && text.trim()) {
        const clean = text.trim();
        setTiktokShopUrl(clean);
        handleFetchShopProduct(clean);
      }
    } catch (e) {
      console.warn('Clipboard read error:', e);
    }
  };

  const handleFetchTikTokLink = async (overrideUrl?: string) => {
    const targetUrl = (overrideUrl || tiktokUrl).trim();
    if (!targetUrl) return;

    setIsFetchingTikTok(true);
    setError(null);
    setTiktokFetchSuccess(false);

    try {
      const res = await fetch('/api/tiktok/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await safeParseJson(res);

      if (data.isShop || data.product) {
        const prod = data.product || { name: data.title, imageUrl: data.cover };
        setShopProductInfo(prod);
        const nameToUse = prod.name || data.title || 'Produk TikTok Shop';
        setTiktokTitle(nameToUse);
        setTopic(prev => prev.trim() ? prev : nameToUse);
        setTiktokShopUrl(targetUrl);
        setTiktokFetchSuccess(true);
      } else if (data.title) {
        setTiktokTitle(data.title);
        setTopic(prev => prev.trim() ? prev : data.title);
      } else {
        // Fallback: Extract keywords from URL slug for product/shop links
        try {
          const urlObj = new URL(targetUrl);
          const pathParts = urlObj.pathname.split('/').filter(p => p.length > 2);
          const rawSlug = pathParts.join(' ').replace(/[-_]/g, ' ');
          const cleanSlug = rawSlug.replace(/\b(product|item|i|p|dp|detail|view|shop|seller|buy|video)\b/gi, '').trim();
          if (cleanSlug) {
            setTiktokTitle(cleanSlug);
            setTopic(prev => prev.trim() ? prev : cleanSlug);
            setTiktokShopUrl(targetUrl);
          }
        } catch (e) {}
      }

      // Auto-fetch video binary via proxy if available
      const videoSource = data.play || data.hdplay || data.wmplay;
      if (videoSource) {
        try {
          const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(videoSource)}`;
          const response = await fetch(proxyUrl);
          if (response.ok) {
            const blob = await response.blob();
            const safeTitle = (data.title || 'tiktok_video')
              .replace(/[^a-zA-Z0-9]/g, '_')
              .slice(0, 30);
            const authorTag = data.author?.uniqueId ? `@${data.author.uniqueId}_` : '';
            const downloadedFile = new File([blob], `${authorTag}${safeTitle}.mp4`, {
              type: 'video/mp4',
            });
            setFile(downloadedFile);
            const url = URL.createObjectURL(downloadedFile);
            setPreviewUrl(url);
          }
        } catch (proxyErr) {
          console.warn('Gagal mengunduh file video via proxy, menggunakan teks/judul saja:', proxyErr);
        }
      }

      setTiktokFetchSuccess(true);
      learningSync.track('tiktok_link_fetched_in_ideas' as any, {
        url: targetUrl,
        title: data.title,
      });
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Gagal mengambil informasi dari link TikTok. Pastikan URL valid.');
    } finally {
      setIsFetchingTikTok(false);
    }
  };

  // Restore cached ideas result on mount
  useEffect(() => {
    try {
      const cached = sessionStorage.getItem('cached_ideas_result');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed && parsed.result) {
          setRawResult(parsed.result);
          if (parsed.modelUsed) {
            setActiveModelUsed(parsed.modelUsed);
          }
        }
      }
    } catch (err) {
      console.error('Gagal membaca cache ide konten dari sessionStorage', err);
    }
  }, []);

  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      handleFileSelection(droppedFile);
    }
  };

  const handleFileInput = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      handleFileSelection(selectedFile);
    }
  };

  const handleFileSelection = (selectedFile: File) => {
    setError(null);
    if (!selectedFile.type.startsWith('video/')) {
      setError('Mohon unggah file video yang valid.');
      return;
    }
    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('Ukuran data file terlalu besar. Silakan gunakan file video di bawah 50MB.');
      return;
    }
    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result.split(',')[1]);
        } else {
          reject(new Error('Gagal mengonversi file video'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  const handleGenerateIdeas = async () => {
    if (!accessGate.isAllowed('idea_konten')) {
      setError(accessGate.getReason('idea_konten') || 'Akses ditolak. Silakan perpanjang paket langganan Anda.');
      return;
    }

    if (tiktokShopUrl.trim()) {
      const url = tiktokShopUrl.trim().toLowerCase();
      const isLikelyUrl = url.startsWith('http') || /tiktok|tokopedia|shopee/i.test(url);
      if (!isLikelyUrl) {
        alert('Format link produk tidak valid. Pastikan tautan diawali dengan https:// (contoh: link produk TikTok Shop atau Tokopedia).');
        return;
      }
    }

    if (!file && !tiktokTitle.trim() && !topic.trim() && !tiktokShopUrl.trim()) {
      setError('Mohon unggah video, tempel judul TikTok, isi topik/produk, atau masukkan link TikTok Shop.');
      return;
    }

    setIsGenerating(true);
    setError(null);
    setProgressPercent(10);
    setProgressStep('Tahap 1: Menganalisis objek, aksi & setting visual video...');

    const startTime = Date.now();
    let currPct = 10;
    const progressInterval = setInterval(() => {
      currPct += Math.floor(Math.random() * 6) + 3;
      if (currPct > 93) currPct = 93;
      setProgressPercent(currPct);

      if (currPct < 40) {
        setProgressStep('Tahap 1: Ekstraksi objek, aksi & setting visual video...');
      } else if (currPct < 80) {
        setProgressStep('Tahap 2: Meracik Ide Konten Grounded & Dialog Natural Anti-AI-Slop...');
      } else {
        setProgressStep('Validasi: Cross-check & Verifikasi Konsistensi Visual...');
      }
    }, 600);

    try {
      let base64Data: string | undefined = undefined;
      let mimeType: string | undefined = undefined;
      let referenceImageBase64: string | undefined = undefined;
      let referenceImageMimeType: string | undefined = undefined;

      if (file) {
        base64Data = await fileToBase64(file);
        mimeType = file.type;
      }
      
      if (refImageFile) {
        referenceImageBase64 = await fileToBase64(refImageFile);
        referenceImageMimeType = refImageFile.type;
      }

      let effectiveTopic = topic.trim();
      if (!effectiveTopic && shopProductInfo?.name) {
        effectiveTopic = shopProductInfo.name;
      } else if (!effectiveTopic && tiktokTitle.trim()) {
        effectiveTopic = tiktokTitle.trim();
      } else if (!effectiveTopic && tiktokShopUrl.trim()) {
        effectiveTopic = 'Produk Afiliasi TikTok Shop';
      }

      const res = await fetch('/api/generate-content-ideas', {
        method: 'POST',
        headers: getAntiLimitHeaders(),
        body: JSON.stringify({
          mimeType,
          base64Data,
          sourceTitle: tiktokTitle.trim() || effectiveTopic,
          topic: effectiveTopic,
          tiktokShopUrl: tiktokShopUrl.trim() || undefined,
          contentType,
          tone,
          maxDuration,
          segmentDuration,
          targetAI,
          aeoQueryMode,
          enableBigSound,
          enableTextOverlay,
          referenceImageBase64,
          referenceImageMimeType,
          userSeedQueries,
          numIdeas: 1,
        }),
      });

      const data = await safeParseJson(res);
      const latencyMs = Date.now() - startTime;

      if (!res.ok || data.error) {
        throw new Error(data.error || 'Terjadi kesalahan saat membuat ide konten.');
      }

      const generatedResult = data.result || data.text;
      const generatedStructured = data.structured || null;
      if (!generatedResult && !generatedStructured) {
        throw new Error('Hasil generasi replika video viral kosong. Silakan coba lagi.');
      }

      clearInterval(progressInterval);
      setProgressPercent(100);
      setProgressStep('Selesai membuat replika video viral grounded!');

      setRawResult(generatedResult || JSON.stringify(generatedStructured, null, 2));
      setStructuredResult(generatedStructured);
      setActiveModelUsed(data.modelUsed || 'Gemini Auto-Cascade');

      // Emit generation event to tracking pipeline
      logGeneration({
        tool: 'idea_konten',
        productName: topic || tiktokTitle || file?.name,
        topic: topic || tiktokTitle || file?.name,
        durationRequested: parseInt(maxDuration) || 60,
        segmentSplit: parseInt(segmentDuration) || 5,
        toneOfVoice: tone,
        contentSalesType: contentType,
        modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
        latencyMs,
        outcome: 'success',
      });

      // Save to sessionStorage cache
      try {
        sessionStorage.setItem('cached_ideas_result', JSON.stringify({
          result: data.result,
          structured: data.structured,
          modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
        }));
      } catch (err) {
        console.error('Gagal menyimpan cache ide konten ke sessionStorage', err);
      }

      // Track content ideas generated in auto-learning buffer
      learningSync.track('content_ideas_generated', {
        topic: topic || tiktokTitle || (file ? file.name : ''),
        contentType,
        tone,
        maxDuration,
        segmentDuration,
        targetAI,
        numIdeas: 1,
      });

      // Save to history
      const displayTitle = file 
        ? `Replika Video Viral (${maxDuration}s): ${file.name}`
        : tiktokTitle 
          ? `Replika Video Viral TikTok (${maxDuration}s): ${tiktokTitle.slice(0, 35)}...`
          : `Replika Video Viral (${maxDuration}s): ${topic.slice(0, 35)}...`;

      saveHistoryItem({
        category: 'content_ideas',
        title: displayTitle,
        subtitle: `Replika Video Viral • Durasi: ${maxDuration}s (Pecah ${segmentDuration}s) • Tipe: ${contentType.toUpperCase()}`,
        data: {
          prompt: data.result,
          contentIdeasResult: data.result,
          modelUsed: data.modelUsed || 'Gemini Auto-Cascade',
          contentType,
          tone,
          sourceText: topic || tiktokTitle || file?.name,
          numIdeas: 1,
        },
      });
    } catch (err: any) {
      console.error(err);
      const latencyMs = Date.now() - startTime;
      const errMsg = err.message || 'Gagal menghasilkan replika video viral.';
      setError(errMsg);

      logGeneration({
        tool: 'idea_konten',
        productName: topic || tiktokTitle || file?.name,
        topic: topic || tiktokTitle || file?.name,
        durationRequested: parseInt(maxDuration) || 60,
        segmentSplit: parseInt(segmentDuration) || 5,
        toneOfVoice: tone,
        contentSalesType: contentType,
        modelUsed: 'gemini-3.8-flash',
        latencyMs,
        outcome: 'error',
        errorMessage: errMsg,
      });
    } finally {
      clearInterval(progressInterval);
      setIsGenerating(false);
    }
  };

  // Helper function to parse raw markdown output into structured idea objects
  const parseIdeasFromMarkdown = (text: string): ParsedIdea[] => {
    if (!text) return [];

    let ideaBlocks = text.split(/### 💡 IDE /g).slice(1);
    
    if (ideaBlocks.length === 0) {
      ideaBlocks = text.split(/(?:###|##)\s*(?:💡\s*)?IDE\s+\d+:?\s*/gi).slice(1);
    }
    if (ideaBlocks.length === 0) {
      return [];
    }

    return ideaBlocks.map((block, index) => {
      const id = index + 1;
      const lines = block.split('\n');
      const titleLine = lines[0] || `Ide Konten #${id}`;
      const cleanTitle = titleLine.replace(/^\d+:\s*/, '').replace(/[\*#]/g, '').trim();

      const getSection = (key: string): string => {
        const regex = new RegExp(`\\*\\*${key}\\*\\*:\\s*(.+)`, 'i');
        const match = block.match(regex);
        return match ? match[1].trim() : '';
      };

      // Extract Scene Prompts Block
      let scenePrompts = '';
      const sceneMatch = block.match(/\*\*Rincian Adegan Video & Prompt AI per Segmen[^\*]*\null*:\s*([\s\S]*?)(?=\n- \*\*Caption|\n- \*\*AEO Caption|\n- \*\*Hashtag|\n---|$)/i) ||
        block.match(/\*\*Rincian Adegan Video & Prompt AI per Segmen[^\*]*\*\*:\s*([\s\S]*?)(?=\n- \*\*Caption|\n- \*\*AEO Caption|\n- \*\*Hashtag|\n---|$)/i);
      if (sceneMatch) {
        scenePrompts = sceneMatch[1].trim();
      }

      const clips = parseClipSegmentsFromScenePrompts(scenePrompts);

      // Extract AEO specific fields
      const aeoQueryMapping = getSection('AEO Query Mapping') || getSection('AEO Mapping');
      const alasanRelevansi = getSection('Alasan Relevansi') || getSection('Relevansi');
      const bluffHook = getSection('BLUFF Hook Pikat \\(0-3s\\)') || getSection('BLUFF Hook Pikat') || getSection('BLUFF Hook') || getSection('Hook Pikat \\(3 Detik Pertama\\)') || getSection('Hook Pikat') || getSection('Hook');
      const atomicAnswerSummary = getSection('Atomic Answer Summary \\(LLM RAG Citation Ready\\)') || getSection('Atomic Answer Summary') || getSection('Atomic Answer');
      const consensusTrigger = getSection('Consensus Trigger \\(Tier 2 Validation\\)') || getSection('Consensus Trigger');

      // Extract caption specifically from **AEO Caption SEO** or **Caption Relevan**: section
      let caption = '';
      const captionSectionMatch = block.match(/\*\*(?:AEO Caption SEO|Caption SEO TikTok|Caption SEO|Caption Relevan|Caption)[^\*]*\*\*:\s*([\s\S]*?)(?=\n- \*\*Hashtag|\n#|\n---|$)/i) ||
        block.match(/(?:Caption SEO|Caption Relevan|Caption):\s*([\s\S]*?)(?=\n- \*\*Hashtag|\n#|\n---|$)/i);
      if (captionSectionMatch) {
        const rawCaptionText = captionSectionMatch[1].trim();
        // Check if rawCaptionText is wrapped in ```text ... ``` or """text ... """
        const innerMatch = rawCaptionText.match(/(?:```(?:text)?|"""(?:text)?)\n?([\s\S]*?)\n?(?:```|"""|$)/i);
        if (innerMatch && innerMatch[1] && innerMatch[1].trim() && !innerMatch[1].includes('[Style]:')) {
          caption = innerMatch[1].trim();
        } else {
          caption = rawCaptionText
            .replace(/^(?:```(?:text)?|"""(?:text)?|text|\s)+|(?:```|"""|\s)+$/g, '')
            .replace(/^["'`\s]+|["'`\s]+$/g, '')
            .trim();
        }
      }

      // Extract Hashtags (Maximal 5 Hashtags)
      let hashtags = '';
      const lineMatch = block.match(/\*\*(?:Hashtag Relevan & SEO Search|Hashtag Relevan|Hashtag SEO|Hashtag)[^\*]*\*\*:\s*([^\n]+)/i) ||
        block.match(/(?:Hashtag Relevan|Hashtag SEO|Hashtag):\s*([^\n]+)/i);
      if (lineMatch && lineMatch[1]) {
        hashtags = lineMatch[1].replace(/['"]/g, '').trim();
      } else {
        const hashTagsArray = block.match(/#[\w_]+/g);
        if (hashTagsArray) {
          hashtags = hashTagsArray.join(' ');
        }
      }

      // Enforce strict limit of maximum 5 hashtags and remove generic spam tags
      if (hashtags) {
        const tagMatches: string[] = hashtags.match(/#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+/g) || [];
        const BANNED_SPAM = new Set(['fyp', 'fypシ', 'fypviral', 'foryou', 'foryoupage', 'racuntiktok', 'racuntiktokshop', 'viral', 'viralvideo', 'trending', 'beranda', 'fyppage', 'foryourpage']);
        const filteredTags = tagMatches.filter((t: string) => !BANNED_SPAM.has(t.replace('#', '').toLowerCase()));
        const finalTags = (filteredTags.length > 0 ? filteredTags : tagMatches).slice(0, 5);
        hashtags = finalTags.join(' ');
      }

      // Sanitize caption from spam phrases
      if (caption) {
        caption = caption
          .replace(/\b(racun\s*tik\s*tok|racun\s*tiktok)\b/gi, 'rekomendasi produk pilihan')
          .replace(/\b(for\s*your\s*page|f\s*y\s*p|fyp)\b/gi, 'pencarian sosial media')
          .replace(/\b(viral\s*di\s*tiktok|viral\s*tiktok)\b/gi, 'banyak dicari');
      }

      return {
        id,
        title: cleanTitle,
        typeAndAngle: getSection('Tipe & Angle Konten') || getSection('Angle Konten'),
        targetAudience: getSection('Target Audience') || getSection('Audiens'),
        aeoQueryMapping,
        alasanRelevansi,
        hook: bluffHook || getSection('Hook Pikat \\(3 Detik Pertama\\)') || getSection('Hook Pikat') || getSection('Hook'),
        bluffHook,
        atomicAnswerSummary,
        consensusTrigger,
        visualAudioGuide: getSection('Panduan Visual & Audio') || getSection('Visual & Audio'),
        scenePrompts,
        clips,
        caption,
        hashtags,
        fullRawText: `### 💡 IDE ${id}: ${cleanTitle}\n` + block,
      };
    });
  };

  const parsedIdeas = rawResult ? parseIdeasFromMarkdown(rawResult) : [];
  const aeoOverview = rawResult ? parseAEOOverviewFromMarkdown(rawResult) : null;

  const copyClipOnly = (ideaId: number, clip: IdeaClipSegment) => {
    const textToCopy = clip.aiPrompt ? clip.aiPrompt.trim() : clip.actionAndVO.trim();

    navigator.clipboard.writeText(textToCopy);
    setCopiedClipKey(`${ideaId}_${clip.id}`);

    learningSync.track('prompt_copied', {
      type: 'content_idea_clip_segment',
      ideaId,
      clipId: clip.id,
      text: textToCopy,
    });

    setTimeout(() => setCopiedClipKey(null), 2000);
  };

  const copyIdea = (idea: ParsedIdea) => {
    const textToCopy = `💡 ${idea.title.toUpperCase()}\n` +
      `🎯 Angle: ${idea.typeAndAngle}\n` +
      `🎣 Hook 3 Detik: ${idea.hook}\n\n` +
      (idea.scenePrompts ? `🎬 PROMPT ADEGAN PER SEGMEN:\n${idea.scenePrompts}\n\n` : '') +
      `📝 CAPTION:\n${idea.caption}\n\n` +
      `#️⃣ HASHTAGS:\n${idea.hashtags}`;

    navigator.clipboard.writeText(textToCopy);
    setCopiedIdeaId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_full',
      ideaId: idea.id,
      text: textToCopy,
    });

    setTimeout(() => setCopiedIdeaId(null), 2000);
  };

  const copyHookOnly = (idea: ParsedIdea) => {
    navigator.clipboard.writeText(idea.hook);
    setCopiedHookId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_hook',
      ideaId: idea.id,
      text: idea.hook,
    });

    setTimeout(() => setCopiedHookId(null), 2000);
  };

  const copyVisualOnly = (idea: ParsedIdea) => {
    navigator.clipboard.writeText(idea.visualAudioGuide);
    setCopiedVisualId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_visual',
      ideaId: idea.id,
      text: idea.visualAudioGuide,
    });

    setTimeout(() => setCopiedVisualId(null), 2000);
  };

  const copyCaptionOnly = (idea: ParsedIdea) => {
    navigator.clipboard.writeText(idea.caption);
    setCopiedCaptionId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_caption',
      ideaId: idea.id,
      text: idea.caption,
    });

    setTimeout(() => setCopiedCaptionId(null), 2000);
  };

  const copyHashtagsOnly = (idea: ParsedIdea) => {
    navigator.clipboard.writeText(idea.hashtags);
    setCopiedHashtagsId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_hashtags',
      ideaId: idea.id,
      text: idea.hashtags,
    });

    setTimeout(() => setCopiedHashtagsId(null), 2000);
  };

  const copySingleTag = (tag: string) => {
    const clean = tag.startsWith('#') ? tag : `#${tag}`;
    navigator.clipboard.writeText(clean);
    setCopiedTag(clean);
    learningSync.track('prompt_copied', {
      type: 'content_idea_single_tag',
      text: clean,
    });
    setTimeout(() => setCopiedTag(null), 1500);
  };

  const copyAllPrompts = (idea: ParsedIdea) => {
    let allText = '';
    if (idea.clips && idea.clips.length > 0) {
      allText = idea.clips
        .map((c, i) => {
          const promptBody = (c.aiPrompt || c.actionAndVO || '').trim().replace(/^```(?:text)?\n?|```$/g, '');
          return `[Segmen Prompt Klip ${c.id || i + 1} (${c.timeRange})]\n${promptBody}`;
        })
        .join('\n\n');
    } else {
      allText = idea.scenePrompts;
    }

    navigator.clipboard.writeText(allText);
    setCopiedScenesId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_all_prompts',
      ideaId: idea.id,
      text: allText,
    });

    setTimeout(() => setCopiedScenesId(null), 2000);
  };

  const copyScenesOnly = (idea: ParsedIdea) => {
    navigator.clipboard.writeText(idea.scenePrompts);
    setCopiedScenesId(idea.id);

    learningSync.track('prompt_copied', {
      type: 'content_idea_scenes',
      ideaId: idea.id,
      text: idea.scenePrompts,
    });

    setTimeout(() => setCopiedScenesId(null), 2000);
  };

  const downloadIdeaAsTxt = (idea: ParsedIdea) => {
    const textContent = `REPLIKA VIDEO VIRAL #${idea.id}: ${idea.title.toUpperCase()}\n` +
      `==========================================\n\n` +
      `🎯 TIPE & ANGLE: ${idea.typeAndAngle}\n` +
      `📣 TARGET AUDIENS: ${idea.targetAudience}\n\n` +
      `🔥 HOOK (3 DETIK PERTAMA):\n${idea.hook}\n\n` +
      `🎬 PANDUAN VISUAL & AUDIO:\n${idea.visualAudioGuide}\n\n` +
      `✂️ RINCIAN ADEGAN & PROMPT AI PER SEGMEN (${maxDuration}s):\n${idea.scenePrompts}\n\n` +
      `📝 CAPTION RELEVAN PERSUASIF:\n${idea.caption}\n\n` +
      `#️⃣ HASHTAGS RELEVAN:\n${idea.hashtags}\n`;

    const blob = new Blob([textContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Replika_Video_Viral_${idea.id}_${idea.title.slice(0, 20).replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const downloadAllIdeasAsTxt = () => {
    if (!rawResult) return;
    const blob = new Blob([rawResult], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Replika_Video_Viral_Lengkap.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const copyAllIdeas = () => {
    if (rawResult) {
      navigator.clipboard.writeText(rawResult);
      setCopiedAll(true);
      setTimeout(() => setCopiedAll(false), 2000);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Input Form & Configuration Options */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
        
        {/* Source Header */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-md bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-xs">
            <Film className="w-3.5 h-3.5 fill-current" />
          </div>
          <h3 className="text-sm sm:text-base font-bold text-slate-900">
            Sumber Data / Video TikTok
          </h3>
        </div>

        {/* TOP INPUT: Link Video TikTok (Otomatis Ambil Data) */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-bold text-amber-700 uppercase tracking-wider flex items-center gap-1.5">
              <Link2 className="w-3.5 h-3.5 text-amber-500" />
              <span>INPUT LINK VIDEO TIKTOK (OTOMATIS AMBIL DATA)</span>
            </label>
            {tiktokFetchSuccess && (
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                <Check className="w-3 h-3" /> Info TikTok Berhasil Dimuat
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={tiktokUrl}
                onChange={(e) => {
                  setTiktokUrl(e.target.value);
                  setTiktokFetchSuccess(false);
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleFetchTikTokLink();
                  }
                }}
                placeholder="Tempel link video TikTok di sini (contoh: https://vt.tiktok.com/...)"
                className="w-full h-11 pl-10 pr-4 rounded-xl bg-white border border-amber-300 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 focus:outline-none text-slate-900 text-xs placeholder:text-slate-400 transition-all shadow-2xs"
              />
            </div>

            <button
              type="button"
              onClick={() => handleFetchTikTokLink()}
              disabled={isFetchingTikTok || !tiktokUrl.trim()}
              className="px-5 h-11 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shrink-0 transition-all cursor-pointer shadow-xs"
            >
              {isFetchingTikTok ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Proses Memuat...</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  <span>Ambil Data TikTok</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 2-Column: Video Upload & Text Inputs */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Left: Video Upload / Preview */}
          <div className="space-y-1.5 flex flex-col">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              UNGGAH FILE VIDEO (OPSIONAL)
            </label>
            
            {!file ? (
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`flex-1 border border-dashed rounded-2xl p-6 text-center cursor-pointer transition-all flex flex-col items-center justify-center min-h-[190px] ${
                  isDragging ? 'border-amber-500 bg-amber-50' : 'border-slate-200/90 bg-slate-50/40 hover:border-amber-400 hover:bg-slate-50'
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-amber-50 flex items-center justify-center text-amber-500 mb-2">
                  <Upload className="w-5 h-5" />
                </div>
                <p className="text-xs font-bold text-slate-800">Klik / Tarik & Lepas Video di Sini</p>
                <p className="text-[11px] text-slate-400 mt-1">MP4, MOV, WebM untuk analisa adegan visual AI</p>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileInput}
                  accept="video/*"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="flex-1 p-4 rounded-2xl bg-slate-50/80 border border-slate-200/80 flex items-center justify-between gap-3 min-h-[190px]">
                <div className="flex items-center gap-3 overflow-hidden">
                  <div className="w-16 h-20 rounded-xl overflow-hidden bg-slate-900 shrink-0 relative">
                    <video src={previewUrl!} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{file.name}</p>
                    <p className="text-[11px] text-slate-500">{(file.size / (1024 * 1024)).toFixed(1)} MB</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFile(null);
                    if (previewUrl) URL.revokeObjectURL(previewUrl);
                    setPreviewUrl(null);
                  }}
                  className="p-2 rounded-xl bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-600 transition-colors text-xs shrink-0 cursor-pointer"
                  title="Hapus Video"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          {/* Right: Judul, Topik, Link TikTok Shop */}
          <div className="space-y-3.5">
            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                JUDUL / CAPTION VIDEO TIKTOK
              </label>
              <input
                type="text"
                value={tiktokTitle}
                onChange={(e) => setTiktokTitle(e.target.value)}
                placeholder="Contoh: Rekomendasi blender portable mini bisa dicharge..."
                className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 focus:outline-none text-slate-900 text-xs placeholder:text-slate-400 transition-all"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-1">
                TOPIK UTAMA / NAMA PRODUK AFILIASI
              </label>
              <input
                type="text"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                placeholder="Contoh: Sunscreen SPF 50 ringan tidak lengket untuk kulit berminyak"
                className="w-full h-11 px-4 rounded-xl bg-white border border-slate-200 focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 focus:outline-none text-slate-900 text-xs placeholder:text-slate-400 transition-all"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                  <ShoppingBag className="w-3.5 h-3.5 text-[#5b50e5]" />
                  <span>LINK TIKTOK SHOP / TOKOPEDIA (OPSIONAL)</span>
                </label>
                {shopProductInfo && (
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-3 h-3" /> Terdeteksi
                  </span>
                )}
              </div>

              <div className="relative">
                <input
                  type="url"
                  value={tiktokShopUrl}
                  onChange={(e) => {
                    setTiktokShopUrl(e.target.value);
                    if (!e.target.value.trim()) setShopProductInfo(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleFetchShopProduct();
                    }
                  }}
                  placeholder="https://shop.tiktok.com/... atau link produk"
                  className="w-full h-11 pl-4 pr-24 rounded-xl bg-white border border-slate-200 focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 focus:outline-none text-slate-900 text-xs placeholder:text-slate-400 transition-all"
                />
                <button
                  type="button"
                  onClick={handlePasteShopUrl}
                  className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 rounded-lg text-slate-600 hover:text-slate-900 hover:bg-slate-100 text-xs font-medium transition-all flex items-center gap-1 cursor-pointer"
                  title="Tempel Link dari Clipboard"
                >
                  <Clipboard className="w-3.5 h-3.5 text-slate-500" />
                  <span>Tempel</span>
                </button>
              </div>

              {/* Product Preview Card if detected */}
              {shopProductInfo && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 p-2.5 bg-emerald-50/90 border border-emerald-200 rounded-xl flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    {shopProductInfo.imageUrl ? (
                      <img
                        src={shopProductInfo.imageUrl}
                        alt={shopProductInfo.name}
                        className="w-10 h-10 object-cover rounded-lg shrink-0 border border-emerald-200 bg-white"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded-lg bg-emerald-100 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-5 h-5 text-emerald-600" />
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="font-bold text-slate-900 truncate text-[11px] sm:text-xs">
                        {shopProductInfo.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {shopProductInfo.price && (
                          <span className="font-bold text-emerald-700 text-[10px]">
                            {shopProductInfo.price}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">
                          Terhubung ke AI Generator
                        </span>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setShopProductInfo(null);
                      setTiktokShopUrl('');
                    }}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/60 transition-colors shrink-0"
                    title="Hapus Produk"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Configurations Row: Total Durasi & Pecah Durasi Prompt */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Total Durasi */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>TOTAL DURASI</span>
              </label>
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200/80 px-2 py-0.5 rounded-md">
                {maxDuration} Detik
              </span>
            </div>

            <div className="h-11 p-1 bg-white border border-slate-200/80 rounded-xl grid grid-cols-7 gap-1">
              {[10, 20, 30, 40, 50, 60, 70].map((sec) => (
                <button
                  key={sec}
                  type="button"
                  onClick={() => setMaxDuration(String(sec))}
                  className={`rounded-lg text-xs font-medium transition-all flex items-center justify-center cursor-pointer ${
                    maxDuration === String(sec)
                      ? 'bg-[#3525cd] text-white font-bold shadow-xs'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  {sec}s
                </button>
              ))}
            </div>
          </div>

          {/* Pecah Durasi Prompt */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
              <Sliders className="w-3.5 h-3.5 text-slate-400" />
              <span>PECAH DURASI PROMPT</span>
            </label>
            <div className="relative">
              <select
                value={segmentDuration}
                onChange={(e) => setSegmentDuration(e.target.value)}
                className="w-full h-11 px-3.5 pr-10 rounded-xl bg-white border border-slate-200/80 focus:border-[#5b50e5] focus:ring-2 focus:ring-[#5b50e5]/20 text-slate-800 text-xs focus:outline-none cursor-pointer appearance-none font-medium"
              >
                <option value="4">Tiap 4 Detik per Klip</option>
                <option value="6">Tiap 6 Detik per Klip</option>
                <option value="8">Tiap 8 Detik per Klip</option>
                <option value="10">Tiap 10 Detik per Klip</option>
                <option value="15">Tiap 15 Detik per Klip</option>
                <option value="auto">Pecah Otomatis Sesuai Adegan</option>
              </select>
              <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Row Anti-slop & Reference Image */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {/* Anti-Slop Settings */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              PENGATURAN PROMPT ANTI-SLOP
            </label>
            <div className="h-[72px] flex items-center justify-between p-3.5 rounded-xl border border-slate-200/80 bg-white">
              <div>
                <p className="text-xs font-bold text-slate-800">Text Overlay / Hook Teks di Layar</p>
                <p className="text-[11px] text-slate-500 italic mt-0.5">
                  {enableTextOverlay 
                    ? 'Aktif — Tag [Text Overlay] diikutsertakan' 
                    : 'Nonaktif — Tag [Text Overlay] dinonaktifkan'}
                </p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  className="sr-only peer"
                  checked={enableTextOverlay}
                  onChange={(e) => setEnableTextOverlay(e.target.checked)}
                />
                <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#3525cd]"></div>
              </label>
            </div>
          </div>

          {/* Reference Image */}
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block">
              REFERENCE IMAGE (CEGAH FLICKER IDENTITAS)
            </label>
            {!refImageFile ? (
              <div
                onDragOver={(e) => { e.preventDefault(); setIsRefDragging(true); }}
                onDragLeave={() => setIsRefDragging(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsRefDragging(false);
                  const file = e.dataTransfer.files[0];
                  if (file && file.type.startsWith('image/')) {
                    setRefImageFile(file);
                    setRefPreviewUrl(URL.createObjectURL(file));
                  }
                }}
                onClick={() => refFileInputRef.current?.click()}
                className={`h-[72px] border border-dashed rounded-xl px-4 text-center cursor-pointer transition-all flex items-center justify-center gap-2 ${
                  isRefDragging ? 'border-amber-500 bg-amber-50' : 'border-slate-200/90 bg-white hover:border-amber-400 hover:bg-slate-50/50'
                }`}
              >
                <ImageIcon className="w-4 h-4 text-amber-500 shrink-0" />
                <p className="text-xs text-slate-700 font-medium">Unggah Gambar Karakter/Produk (Opsional)</p>
                <input
                  type="file"
                  ref={refFileInputRef}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setRefImageFile(file);
                      setRefPreviewUrl(URL.createObjectURL(file));
                    }
                  }}
                  accept="image/*"
                  className="hidden"
                />
              </div>
            ) : (
              <div className="h-[72px] p-2 rounded-xl bg-white border border-slate-200/80 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 overflow-hidden h-full">
                  <div className="w-12 h-full rounded-lg overflow-hidden bg-slate-900 shrink-0 relative">
                    <img src={refPreviewUrl!} alt="Ref" className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-900 truncate">{refImageFile.name}</p>
                    <p className="text-[10px] text-slate-500">{(refImageFile.size / 1024).toFixed(0)} KB</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setRefImageFile(null);
                    if (refPreviewUrl) URL.revokeObjectURL(refPreviewUrl);
                    setRefPreviewUrl(null);
                  }}
                  className="p-1.5 rounded-lg bg-slate-200 hover:bg-rose-100 text-slate-600 hover:text-rose-600 transition-colors text-xs shrink-0 cursor-pointer"
                  title="Hapus Reference"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Generate Action Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleGenerateIdeas}
            disabled={isGenerating || (!file && !tiktokTitle.trim() && !topic.trim() && !tiktokShopUrl.trim())}
            className="w-full h-12 rounded-xl bg-[#eef2ff] hover:bg-[#e0e7ff] border border-indigo-200/80 disabled:opacity-50 text-[#4f46e5] font-semibold flex items-center justify-center gap-2 transition-all text-xs sm:text-sm cursor-pointer shadow-xs"
          >
            {isGenerating ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#4f46e5]" />
                <span>Meracik Replika Video Viral, Pecah Prompt {maxDuration}s & Hashtag FYP...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#4f46e5]" />
                <span>Hasilkan Replika Video Viral, Prompt Adegan ({maxDuration}s) & Hashtag Relevan</span>
              </>
            )}
          </button>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="p-4 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-rose-800 text-xs sm:text-sm"
          >
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600" />
            <p>{error}</p>
          </motion.div>
        )}
      </div>

      {/* Output Display Section */}
      <AnimatePresence mode="wait">
        {isGenerating ? (
          <EngagingLoadingState
            title="Menganalisis Video Viral & Merancang Replika Ide"
            subtitle={progressStep || 'Membedah komposisi video, audio pacing, visual hook, dan merancang ide replika...'}
            badgeText="3-AGENT REPLICA PIPELINE"
            icon={Lightbulb}
            progress={progressPercent}
            steps={[
              'Tahap 1: Vision Grounding & Ekstraksi DNA Video & Produk',
              'Tahap 2: Adaptasi Konsep & Storyboard Naskah Adegan',
              'Tahap 3: Master Prompt AI Video (Split Klip) & SEO Grounded',
              'Tahap 4: Finalisasi Output & Siap Produksi'
            ]}
          />
        ) : rawResult ? (
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <ViralReplicaOutputView
              parsedIdeas={parsedIdeas}
              rawResult={rawResult}
              structuredResult={structuredResult}
              targetAI={targetAI}
              segmentDuration={segmentDuration}
              maxDuration={Number(maxDuration) || 60}
              refImageFile={refImageFile}
              onSendToPhotoPrompt={onSendToPhotoPrompt}
              onOpenBatchPhotoModal={(data) => {
                setBatchModalData(data);
                setIsBatchPhotoModalOpen(true);
              }}
            />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {/* Batch Photo Prompt Configuration Modal */}
      {batchModalData && (
        <BatchPhotoPromptModal
          isOpen={isBatchPhotoModalOpen}
          onClose={() => setIsBatchPhotoModalOpen(false)}
          conceptTitle={batchModalData.conceptTitle}
          clips={batchModalData.clips}
          referenceImage={refImageFile}
          onConfirm={(opts) => {
            const clipsBatchText = `KONSEP IDE KONTEN BATCH PROMPT FOTO (${batchModalData.clips.length} KLIP):\n` +
              `Judul Ide: ${batchModalData.conceptTitle}\n\n` +
              batchModalData.clips.map((c, idx) => `### [${c.timeRange || `00:0${idx * 5} - 00:0${(idx + 1) * 5}`}] Klip ${c.id}: ${c.title}\nDeskripsi Adegan Visual & Voice Over:\n${c.actionAndVO || ''}\n${c.aiPrompt ? `\nPrompt AI Video:\n${c.aiPrompt}` : ''}`).join('\n\n---\n\n');

            if (onSendToPhotoPrompt) {
              onSendToPhotoPrompt(clipsBatchText, {
                referenceImage: refImageFile || undefined,
                autoGenerate: true,
                aspectRatio: opts.aspectRatio,
                photoStyle: opts.photoStyle,
                targetGenerator: opts.targetGenerator,
                negativePrompt: opts.negativePrompt,
                subjectReference: opts.subjectReference,
                productReference: opts.productReference,
              });
            }
            setIsBatchPhotoModalOpen(false);
          }}
        />
      )}
    </div>
  );
}

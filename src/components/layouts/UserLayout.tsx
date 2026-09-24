import React, { useState, useRef, useEffect, DragEvent, ChangeEvent } from 'react';
import { 
  Upload, 
  FileVideo, 
  Sparkles, 
  Loader2, 
  RefreshCw, 
  Cpu, 
  Download, 
  Scissors, 
  Camera, 
  History as HistoryIcon, 
  ShieldCheck, 
  Lightbulb, 
  Menu, 
  X, 
  RotateCcw,
  Clapperboard,
  LogOut,
  Copy,
  Check,
  Eye,
  EyeOff,
  Link as LinkIcon,
  Clipboard,
  AlertCircle,
  ShoppingBag,
  Zap,
  Brain,
  Sliders,
  TrendingUp,
  Video,
  ChevronDown,
  Film,
  Wand2,
  Globe,
  Palette
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import EngagingLoadingState from '../common/EngagingLoadingState';
import TikTokDownloader from '../tools/TikTokDownloader';
import SplitPromptViewer, { parseClipSegments } from '../tools/view/SplitPromptViewer';
import PhotoPromptGeneratorTool from '../tools/PhotoPromptGeneratorTool';
import ContentIdeasTool from '../tools/ContentIdeasTool';
import TikTokShopToIdeasTool from '../tools/TikTokShopToIdeasTool';
import VideoFrameExtractorTool from '../tools/VideoFrameExtractorTool';
import TrendVideoTool from '../tools/TrendVideoTool';
import HistoryModal from '../modals/HistoryModal';
import AntiLimitModal from '../modals/AntiLimitModal';
import { saveHistoryItem, getHistoryCount, HistoryItem } from '../../lib/history';
import { getAntiLimitHeaders, getActiveKeyDisplay } from '../../lib/antiLimit';
import { learningSync } from '../../lib/learningSync';
import { safeParseJson } from '../../lib/apiHelper';
import { UserSession } from '../../types/index';
import { UserUiSettings, DEFAULT_USER_UI_SETTINGS, getUserUiSettings, syncUserUiSettingsWithBackend } from '../../lib/admin/userUiSettings';
import { maskAccessCode } from '../../utils/maskAccessCode';
import { formatRemainingTime } from '../../utils/formatRemainingTime';
import { getClients, ClientItem } from '../../lib/admin/clients';
import { reportActiveGenerationStatus } from '../../events/generationEvent';

interface UserLayoutProps {
  session: UserSession;
  onLogout: () => void;
  onGoToAdmin?: () => void;
}

export default function UserLayout({ session, onLogout, onGoToAdmin }: UserLayoutProps) {
  const [activeTab, setActiveTab] = useState<'tiktok' | 'prompt' | 'photo' | 'ideas' | 'shop_ideas' | 'extractor' | 'trend'>('tiktok');
  const [photoInitialText, setPhotoInitialText] = useState<string>('');
  const [photoInitialNegativePrompt, setPhotoInitialNegativePrompt] = useState<string>('');
  const [photoInitialReferenceImage, setPhotoInitialReferenceImage] = useState<File | null>(null);
  const [photoInitialAspectRatio, setPhotoInitialAspectRatio] = useState<string | undefined>();
  const [photoInitialPhotoStyle, setPhotoInitialPhotoStyle] = useState<string | undefined>();
  const [photoInitialTargetGenerator, setPhotoInitialTargetGenerator] = useState<string | undefined>();
  const [photoInitialSubjectReference, setPhotoInitialSubjectReference] = useState<string | undefined>();
  const [photoInitialProductReference, setPhotoInitialProductReference] = useState<string | undefined>();

  // States for passing data to ContentIdeasTool & Extractor
  const [ideasInitialVideo, setIdeasInitialVideo] = useState<File | null>(null);
  const [ideasInitialTitle, setIdeasInitialTitle] = useState<string>('');
  const [ideasInitialTopic, setIdeasInitialTopic] = useState<string>('');
  const [ideasInitialUrl, setIdeasInitialUrl] = useState<string>('');
  const [extractorInitialVideo, setExtractorInitialVideo] = useState<File | null>(null);
  const [shopInitialUrl, setShopInitialUrl] = useState<string>('');
  const [shopInitialResult, setShopInitialResult] = useState<string>('');

  // Modals state
  const [isHistoryOpen, setIsHistoryOpen] = useState<boolean>(false);
  const [isAntiLimitOpen, setIsAntiLimitOpen] = useState<boolean>(false);
  const [historyBadge, setHistoryBadge] = useState<number>(0);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);
  const [activeKeyText, setActiveKeyText] = useState<string>('TS-••••-9K2A');

  // Client & Access Code Security States
  const [clientData, setClientData] = useState<ClientItem | null>(null);
  const [showFullCode, setShowFullCode] = useState<boolean>(false);
  const [copiedAccessCode, setCopiedAccessCode] = useState<boolean>(false);

  // User UI Settings State (Controlled by Admin)
  const [uiSettings, setUiSettings] = useState<UserUiSettings>(getUserUiSettings());

  useEffect(() => {
    const handleSyncUi = async () => {
      const cached = getUserUiSettings();
      setUiSettings(cached);
      const synced = await syncUserUiSettingsWithBackend();
      setUiSettings(synced);
    };

    handleSyncUi();
    window.addEventListener('satset_user_ui_settings_updated', handleSyncUi);
    return () => window.removeEventListener('satset_user_ui_settings_updated', handleSyncUi);
  }, []);

  useEffect(() => {
    const loadClientInfo = () => {
      const clients = getClients();
      const found = clients.find((c) => c.accessCode.toUpperCase() === session.code.toUpperCase());
      if (found) {
        setClientData(found);
      } else {
        setClientData({
          id: 'session_client',
          accessCode: session.code,
          name: session.role === 'admin' ? 'Administrator' : 'Klien Satset',
          packageId: 'bulanan',
          packageName: 'Akses Bulanan (VIP)',
          price: 149000,
          startDate: new Date().toISOString(),
          expiryDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString(),
          role: session.role === 'admin' ? 'admin' : 'user',
          allowedFeatures: [],
          maxDailyTokens: 50,
          usageCount: 0,
          status: 'active',
          createdAt: new Date().toISOString()
        });
      }
    };

    loadClientInfo();
    window.addEventListener('satset_clients_updated', loadClientInfo);
    return () => window.removeEventListener('satset_clients_updated', loadClientInfo);
  }, [session.code, session.role]);

  const handleCopyAccessCode = () => {
    if (!session?.code) return;
    navigator.clipboard.writeText(session.code);
    setCopiedAccessCode(true);
    setTimeout(() => setCopiedAccessCode(false), 2000);
  };

  const handleToggleCodeReveal = () => {
    if (!showFullCode) {
      setShowFullCode(true);
      setTimeout(() => setShowFullCode(false), 5000);
    } else {
      setShowFullCode(false);
    }
  };

  const clientName = session.name || clientData?.name || (session.role === 'admin' ? 'Administrator' : 'Klien Satset');
  const remainingTime = formatRemainingTime(clientData?.expiryDate);

  const updateActiveKey = () => {
    setActiveKeyText(getActiveKeyDisplay());
  };

  useEffect(() => {
    setHistoryBadge(getHistoryCount());
    updateActiveKey();

    const handleHistUpdate = () => {
      setHistoryBadge(getHistoryCount());
    };
    const handleKeysUpdate = () => {
      updateActiveKey();
    };

    const handleTabSwitch = (e: any) => {
      if (e.detail && ['tiktok', 'prompt', 'photo', 'ideas', 'shop_ideas', 'extractor', 'trend'].includes(e.detail)) {
        setActiveTab(e.detail);
      }
    };

    window.addEventListener('satset_history_updated', handleHistUpdate);
    window.addEventListener('api-keys-updated', handleKeysUpdate);
    window.addEventListener('satset_switch_tab', handleTabSwitch);

    return () => {
      window.removeEventListener('satset_history_updated', handleHistUpdate);
      window.removeEventListener('api-keys-updated', handleKeysUpdate);
      window.removeEventListener('satset_switch_tab', handleTabSwitch);
    };
  }, [isHistoryOpen]);

  useEffect(() => {
    if (!session || session.code === 'GUEST-ACCESS') return;

    const tabNames: Record<string, string> = {
      tiktok: 'TikTok Downloader',
      trend: 'Trend Video Viral',
      prompt: 'Ekstrak Prompt dari Video',
      photo: 'Prompt Foto Nano',
      ideas: 'Replika Video Viral (AEO)',
      shop_ideas: 'Produk to Video',
      extractor: 'Video Frame Extractor'
    };

    const currentToolLabel = tabNames[activeTab] || 'Workspace Tool';
    const presenceId = `pres_${session.code}`;

    const sendPresence = () => {
      reportActiveGenerationStatus(
        presenceId,
        'active',
        `Aktif mengakses tool: ${currentToolLabel} (${clientName})`,
        {
          accessCode: session.code,
          tool: currentToolLabel,
          clientId: session.code,
          category: 'Online Workspace'
        }
      );
    };

    sendPresence();
    const interval = setInterval(sendPresence, 20000);

    return () => {
      clearInterval(interval);
    };
  }, [activeTab, session?.code, clientName]);

  const refreshHistoryBadge = () => {
    setHistoryBadge(getHistoryCount());
  };

  const [photoAutoGenerate, setPhotoAutoGenerate] = useState<boolean>(false);

  const handleSendToPhotoPrompt = (
    text: string,
    options?: {
      negativePrompt?: string;
      referenceImage?: File;
      autoGenerate?: boolean;
      aspectRatio?: string;
      photoStyle?: string;
      targetGenerator?: string;
      subjectReference?: string;
      productReference?: string;
    }
  ) => {
    setPhotoInitialText(text);
    if (options?.negativePrompt !== undefined) setPhotoInitialNegativePrompt(options.negativePrompt);
    if (options?.referenceImage !== undefined) setPhotoInitialReferenceImage(options.referenceImage);
    if (options?.aspectRatio !== undefined) setPhotoInitialAspectRatio(options.aspectRatio);
    if (options?.photoStyle !== undefined) setPhotoInitialPhotoStyle(options.photoStyle);
    if (options?.targetGenerator !== undefined) setPhotoInitialTargetGenerator(options.targetGenerator);
    if (options?.subjectReference !== undefined) setPhotoInitialSubjectReference(options.subjectReference);
    if (options?.productReference !== undefined) setPhotoInitialProductReference(options.productReference);
    setPhotoAutoGenerate(!!options?.autoGenerate);
    setActiveTab('photo');
  };

  const handleGenerateIdeasFromTikTok = (videoFile?: File, tiktokTitle?: string, tiktokUrl?: string) => {
    if (videoFile) setIdeasInitialVideo(videoFile);
    if (tiktokTitle) setIdeasInitialTitle(tiktokTitle);
    if (tiktokUrl) setIdeasInitialUrl(tiktokUrl);
    setActiveTab('ideas');
  };

  const handleExtractFramesFromTikTok = (videoFile?: File) => {
    if (videoFile) setExtractorInitialVideo(videoFile);
    setActiveTab('extractor');
  };

  const handleRestoreItem = (item: HistoryItem) => {
    const isProdukToVideo = item.category === 'tiktok_shop_ideas' || item.title.startsWith('Produk to Video');
    if (isProdukToVideo) {
      if (item.data.sourceText) {
        setShopInitialUrl(item.data.sourceText);
      }
      if (item.data.prompt || item.data.contentIdeasResult) {
        setShopInitialResult(item.data.prompt || item.data.contentIdeasResult);
      }
      setActiveTab('shop_ideas');
    } else if (item.category === 'photo_prompt') {
      if (item.data.sourceText) {
        setPhotoInitialText(item.data.sourceText);
      }
      setActiveTab('photo');
    } else if (item.category === 'video_prompt') {
      if (item.data.prompt) {
        setPrompt(item.data.prompt);
        if (item.data.modelUsed) setActiveModelUsed(item.data.modelUsed);
        if (item.data.sourceCaption) setSourceCaption(item.data.sourceCaption);
        if (item.data.analysisMode) setAnalysisMode(item.data.analysisMode);
      }
      setActiveTab('prompt');
    } else if (item.category === 'content_ideas') {
      if (item.data.sourceText) {
        setIdeasInitialTopic(item.data.sourceText);
      }
      setActiveTab('ideas');
    } else if (item.category === 'tiktok_download') {
      setActiveTab('tiktok');
    } else if (item.category === 'frame_extraction') {
      setActiveTab('extractor');
    }
  };

  // Video to Prompt States
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedModel, setSelectedModel] = useState<string>('');
  const [activeModelUsed, setActiveModelUsed] = useState<string | null>(null);

  // Granular Progress States for Video Split Process
  const [progressStep, setProgressStep] = useState<string>('Mengunggah & membaca data video...');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentClipProcessing, setCurrentClipProcessing] = useState<{ current: number; total: number } | null>(null);

  // Advanced Prompt Segmentation & Formatting Options
  const [segmentDuration, setSegmentDuration] = useState<string>('5');
  const [analysisMode, setAnalysisMode] = useState<'fast' | 'deep'>('deep');
  const [targetAI, setTargetAI] = useState<string>('general');
  const [cinematicStyle, setCinematicStyle] = useState<string>('cinematic');
  const [includeActions, setIncludeActions] = useState<boolean>(true);
  const [includeVoiceOver, setIncludeVoiceOver] = useState<boolean>(true);
  const [includeCinematics, setIncludeCinematics] = useState<boolean>(true);

  // TikTok Link Input & Metadata States for Video to Prompt
  const [videoInputMode, setVideoInputMode] = useState<'upload' | 'tiktok'>('upload');
  const [tiktokInputUrl, setTiktokInputUrl] = useState<string>('');
  const [sourceCaption, setSourceCaption] = useState<string>('');
  const [sourceUrl, setSourceUrl] = useState<string>('');
  const [actualVideoDuration, setActualVideoDuration] = useState<number | null>(null);
  const [isFetchingTikTokVideo, setIsFetchingTikTokVideo] = useState<boolean>(false);
  const [tiktokInputError, setTiktokInputError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAnalyzeFromTikTok = (tiktokVideoFile: File, initialCaption?: string, initialUrl?: string) => {
    if (initialCaption) setSourceCaption(initialCaption);
    if (initialUrl) setSourceUrl(initialUrl);
    handleFileSelection(tiktokVideoFile);
    setActiveTab('prompt');
  };

  const handleFetchTikTokVideo = async (e?: React.FormEvent, overrideUrl?: string) => {
    if (e) e.preventDefault();
    const rawInput = (overrideUrl || tiktokInputUrl).trim();

    if (!rawInput) {
      setTiktokInputError('Silakan masukkan link URL TikTok.');
      return;
    }

    // Auto extract clean URL if user pastes share text containing URL
    let targetUrl = rawInput;
    const urlMatch = rawInput.match(/https?:\/\/[^\s]+/i);
    if (urlMatch) {
      targetUrl = urlMatch[0].replace(/[)\]}>,;."']+$/, '');
    }

    if (!targetUrl.includes('tiktok.com') && !targetUrl.includes('douyin.com')) {
      setTiktokInputError('URL tidak valid. Pastikan menyalin tautan resmi dari TikTok (contoh: https://vt.tiktok.com/xxxx).');
      return;
    }

    setIsFetchingTikTokVideo(true);
    setTiktokInputError(null);

    try {
      const res = await fetch('/api/tiktok/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      const data = await safeParseJson(res);
      if (data.error && !data.play && !data.hdplay) {
        throw new Error(data.error || 'Gagal memproses link TikTok.');
      }

      const videoSource = data.play || data.hdplay || data.wmplay;

      if (!videoSource) {
        throw new Error('Video tidak dapat diunduh langsung dari TikTok. Silakan gunakan menu TikTok Downloader lalu unggah berkas videonya di sini.');
      }

      const proxyUrl = `/api/tiktok/proxy?url=${encodeURIComponent(videoSource)}`;
      const videoRes = await fetch(proxyUrl);

      if (!videoRes.ok) {
        throw new Error('Gagal mengunduh berkas video TikTok dari proxy (CDN dibatasi). Silakan unduh video lewat menu TikTok Downloader lalu pilih Unggah File Video.');
      }

      const blob = await videoRes.blob();
      const rawTitle = (data.title || 'tiktok_video').replace(/[^a-zA-Z0-9]/g, '_');
      const safeTitle = rawTitle.slice(0, 30) || 'video';
      const tiktokFile = new File([blob], `@${data.author?.uniqueId || 'tiktok'}_${safeTitle}.mp4`, {
        type: 'video/mp4',
      });

      setSourceCaption(data.title || '');
      setSourceUrl(targetUrl);
      handleFileSelection(tiktokFile);
      learningSync.track('tiktok_link_imported', { url: targetUrl, title: data.title });
    } catch (err: any) {
      console.error(err);
      setTiktokInputError(err.message || 'Gagal memproses link TikTok. Coba gunakan file lokal.');
    } finally {
      setIsFetchingTikTokVideo(false);
    }
  };

  const handlePasteTikTokUrl = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setTiktokInputUrl(text);
        setTiktokInputError(null);
        if (text.includes('tiktok.com') || text.includes('douyin.com')) {
          handleFetchTikTokVideo(undefined, text);
        }
      }
    } catch (e) {
      setTiktokInputError('Tidak dapat mengakses clipboard secara otomatis. Silakan tempel dengan Ctrl+V.');
    }
  };

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
    setPrompt(null);
    setActiveModelUsed(null);
    
    if (!selectedFile.type.startsWith('video/')) {
      setError('Mohon unggah file video yang valid.');
      return;
    }

    const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
    if (selectedFile.size > MAX_FILE_SIZE) {
      setError('Ukuran data file terlalu besar. Silakan gunakan file video di bawah 50MB.');
      return;
    }

    if (previewUrl) {
      try {
        URL.revokeObjectURL(previewUrl);
      } catch (e) {}
    }

    setFile(selectedFile);
    const url = URL.createObjectURL(selectedFile);
    setPreviewUrl(url);

    const tempVid = document.createElement('video');
    tempVid.src = url;
    tempVid.onloadedmetadata = () => {
      const durationSec = Math.round(tempVid.duration || 0);
      setActualVideoDuration(tempVid.duration || null);
      learningSync.track('video_uploaded', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        duration: durationSec,
      });
    };
    tempVid.onerror = () => {
      setActualVideoDuration(null);
      learningSync.track('video_uploaded', {
        fileName: selectedFile.name,
        fileSize: selectedFile.size,
        fileType: selectedFile.type,
        duration: 0,
      });
    };
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

  const generatePrompt = async () => {
    if (!file) return;
    
    setIsGenerating(true);
    setError(null);
    setProgressPercent(10);
    setProgressStep('Membaca & memvalidasi data video...');
    setCurrentClipProcessing(null);

    let currPct = 10;
    const progressInterval = setInterval(() => {
      currPct += Math.floor(Math.random() * 8) + 4;
      if (currPct > 92) currPct = 92;
      setProgressPercent(currPct);
      setCurrentClipProcessing(null);

      if (currPct < 25) {
        setProgressStep('Membaca & menyiapkan video...');
      } else if (currPct < 50) {
        setProgressStep('Mengunggah video ke AI Vision Engine...');
      } else if (currPct < 75) {
        setProgressStep('AI sedang menganalisis visual, pergerakan & audio...');
      } else if (currPct < 90) {
        setProgressStep('Menyusun struktur shot & kontinuitas adegan...');
      } else {
        setProgressStep('Memformat prompt sinematik siap pakai...');
      }
    }, 550);
    
    try {
      const base64Data = await fileToBase64(file);
      const effectiveModel = analysisMode === 'deep' ? 'gemini-3.8-flash' : undefined;
      
      const res = await fetch('/api/generate-prompt', {
        method: 'POST',
        headers: getAntiLimitHeaders(),
        body: JSON.stringify({
          mimeType: file.type,
          base64Data,
          model: effectiveModel,
          analysisMode,
          segmentDuration,
          targetAI,
          cinematicStyle,
          includeActions,
          includeVoiceOver,
          includeCinematics,
          sourceCaption,
          sourceUrl,
          actualDuration: actualVideoDuration || undefined,
        }),
      });

      const data = await safeParseJson(res);

      clearInterval(progressInterval);
      setProgressPercent(100);
      setProgressStep('Selesai memecah prompt klip!');

      setPrompt(data.prompt);
      setActiveModelUsed(data.modelUsed || (analysisMode === 'deep' ? 'gemini-3.1-pro-preview' : 'gemini-3.8-flash'));

      const parsedClips = parseClipSegments(data.prompt);
      const exactClipCount = parsedClips.length || 1;

      learningSync.track('prompt_split_generated', {
        clipCount: exactClipCount,
        parameters: {
          segmentDuration,
          analysisMode,
          effectiveModel: data.modelUsed || effectiveModel || 'auto',
          targetAI,
          includeActions,
          includeVoiceOver,
          includeCinematics,
          sourceCaptionSnippet: sourceCaption.slice(0, 50),
          fileName: file.name,
        },
      });

      saveHistoryItem({
        category: 'video_prompt',
        title: `Video Prompt: ${file.name}`,
        subtitle: `Split ${segmentDuration !== 'auto' ? segmentDuration + 's' : 'Penuh'} • Mode ${analysisMode === 'deep' ? 'Deep' : 'Fast'}`,
        data: {
          prompt: data.prompt,
          modelUsed: data.modelUsed || effectiveModel || 'auto',
          analysisMode,
          segmentDuration,
          targetAI,
          sourceCaption,
          sourceUrl,
          fileName: file.name,
        },
      });
      refreshHistoryBadge();
    } catch (err: any) {
      clearInterval(progressInterval);
      console.error(err);
      setError(err.message || 'Analisis video gagal karena model AI tidak dapat memproses video ini.');
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => {
    setFile(null);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setActualVideoDuration(null);
    setPrompt(null);
    setError(null);
    setActiveModelUsed(null);
    setSourceCaption('');
    setSourceUrl('');
    setProgressPercent(0);
    setCurrentClipProcessing(null);
    setTiktokInputUrl('');
    setTiktokInputError(null);
  };

  const navItemsTools = [
    { id: 'tiktok', label: 'TikTok Downloader', icon: Download },
    { id: 'trend', label: 'Trend Analyzer', icon: TrendingUp },
    { id: 'shop_ideas', label: 'Produk to Video', icon: Video },
    { id: 'ideas', label: 'Replika Video Viral', icon: Lightbulb },
    { id: 'prompt', label: 'Ekstrak Prompt Video', icon: Clapperboard },
    { id: 'photo', label: 'Prompt Foto', icon: Camera },
    { id: 'extractor', label: 'Ekstraktor Frame', icon: Scissors },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-800 font-sans flex flex-col md:flex-row antialiased">
      
      {/* MOBILE TOP BAR */}
      <div className="md:hidden bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between sticky top-0 z-30 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-white font-bold text-xs shadow-xs">
            <Sparkles className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <span className="text-base font-bold text-slate-900 leading-none block">Satset AI</span>
            <span className="text-[11px] text-slate-400 font-medium leading-none">Creator Pro</span>
          </div>
        </div>

        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>

      {/* MOBILE SIDEBAR OVERLAY DRAWER */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-40 md:hidden"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <motion.div
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="w-72 bg-white h-full p-5 flex flex-col justify-between shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="space-y-6">
                {/* Brand */}
                <div className="flex items-center justify-between pb-4 border-b border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-[#5b50e5] flex items-center justify-center text-white shadow-xs">
                      <Zap className="w-5 h-5 fill-white text-white" />
                    </div>
                  </div>

                  <button
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Navigation Items */}
                <div className="space-y-5">
                  <button
                    onClick={() => {
                      setIsHistoryOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 transition-all text-left cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-slate-500" />
                    <span>Riwayat Generator</span>
                    {historyBadge > 0 && (
                      <span className="ml-auto bg-purple-100 text-[#5b50e5] font-bold text-xs px-2 py-0.5 rounded-full">
                        {historyBadge}
                      </span>
                    )}
                  </button>

                  <div>
                    <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
                      TOOLS PEMBUAT VIDEO
                    </p>
                    <div className="space-y-1">
                      {navItemsTools.map((item) => {
                        const Icon = item.icon;
                        const isActive = activeTab === item.id;
                        return (
                          <button
                            key={item.id}
                            onClick={() => {
                              setActiveTab(item.id as any);
                              setIsMobileMenuOpen(false);
                            }}
                            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                              isActive
                                ? 'bg-[#5b50e5] text-white shadow-xs font-semibold'
                                : 'text-slate-600 hover:bg-slate-50'
                            }`}
                          >
                            <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                            <span>{item.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Drawer Actions */}
              <div className="pt-4 border-t border-slate-100">
                <button
                  onClick={onLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 text-sm font-medium transition-colors cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Keluar Sesi</span>
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESKTOP PERMANENT SIDEBAR */}
      <aside className="hidden md:flex flex-col w-64 bg-white border-r border-slate-200/80 min-h-screen shrink-0 p-5 select-none justify-between">
        <div className="space-y-6">
          {/* Brand Header */}
          <div className="flex items-center px-2 pb-2">
            <div className="w-9 h-9 rounded-xl bg-[#5b50e5] flex items-center justify-center text-white shadow-xs">
              <Zap className="w-5 h-5 fill-white text-white" />
            </div>
          </div>

          {/* Navigation Links */}
          <div className="space-y-6 pt-1">
            {/* Top Single Item: Riwayat */}
            <button
              onClick={() => setIsHistoryOpen(true)}
              className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-all text-left cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-slate-500" />
              <span>Riwayat Generator</span>
              {historyBadge > 0 && (
                <span className="ml-auto bg-purple-100 text-[#5b50e5] font-bold text-xs px-2 py-0.5 rounded-full">
                  {historyBadge}
                </span>
              )}
            </button>

            {/* Section: TOOLS */}
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider px-3.5 mb-2">
                TOOLS PEMBUAT VIDEO
              </p>
              <div className="space-y-1">
                {navItemsTools.map((item) => {
                  const Icon = item.icon;
                  const isActive = activeTab === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => setActiveTab(item.id as any)}
                      className={`relative w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-[#5b50e5] text-white shadow-xs font-semibold'
                          : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                      <span>{item.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Desktop Sidebar Footer (Clean Keluar Button) */}
        <div className="pt-4 border-t border-slate-200/80">
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50/60 text-sm font-medium transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Keluar Sesi</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col min-h-screen overflow-hidden">
        
        {/* TOP HEADER BAR */}
        <header className="bg-white border-b border-slate-200/80 px-4 sm:px-6 py-3 flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            {session.role === 'admin' && onGoToAdmin && (
              <button
                type="button"
                onClick={onGoToAdmin}
                className="px-3 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-900 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs mr-2"
              >
                <ShieldCheck className="w-4 h-4 text-slate-900" />
                <span>Console Admin</span>
              </button>
            )}
            
            {/* Header Badge: Clean Pill with Name, Remaining days, copy & reveal */}
            <div className="flex items-center gap-2.5 px-3.5 py-1.5 rounded-full bg-slate-50 border border-slate-200/80 text-xs text-slate-700">
              <span className="font-semibold text-slate-900">{clientName}</span>
              <span className="text-slate-400">•</span>
              <span className="text-emerald-600 font-semibold">{remainingTime.label}</span>

              {/* Salin Kode Akses Button */}
              <button
                type="button"
                onClick={handleCopyAccessCode}
                className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer ml-1"
                title="Salin Kode Akses"
              >
                {copiedAccessCode ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>

              {/* Reveal Toggle Eye Button */}
              <button
                type="button"
                onClick={handleToggleCodeReveal}
                className="p-0.5 text-slate-400 hover:text-slate-700 transition-colors cursor-pointer"
                title={showFullCode ? "Sembunyikan Kode Akses" : "Tampilkan Kode Akses"}
              >
                {showFullCode ? <EyeOff className="w-3.5 h-3.5 text-purple-600" /> : <Eye className="w-3.5 h-3.5" />}
              </button>

              {showFullCode && (
                <span className="font-mono text-[11px] bg-slate-200/80 px-1.5 py-0.5 rounded text-slate-800 ml-1">
                  {maskAccessCode(session.code)}
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div 
              className="px-3.5 py-1.5 rounded-full bg-[#5b50e5] text-white font-bold text-xs flex items-center gap-1.5 select-none shadow-2xs cursor-pointer"
              title={`Role: ${session.role.toUpperCase()}`}
            >
              <span>{session.role === 'admin' ? 'ADMIN' : 'USER'}</span>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <ChevronDown className="w-3.5 h-3.5 text-white/90" />
            </div>

            <button
              type="button"
              onClick={onLogout}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              title="Keluar / Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* PAGE VIEW RENDERER */}
        <main className="flex-1 p-4 sm:p-6 md:p-8 overflow-y-auto bg-[#f8fafc]">
          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'tiktok' ? 1 : 0, y: activeTab === 'tiktok' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'tiktok' ? 'block' : 'hidden'}
          >
            <TikTokDownloader />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'trend' ? 1 : 0, y: activeTab === 'trend' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'trend' ? 'block' : 'hidden'}
          >
            <TrendVideoTool />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'shop_ideas' ? 1 : 0, y: activeTab === 'shop_ideas' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'shop_ideas' ? 'block' : 'hidden'}
          >
            <TikTokShopToIdeasTool 
              initialProductUrl={shopInitialUrl}
              initialResult={shopInitialResult}
              onSendToPhotoPrompt={handleSendToPhotoPrompt}
              onSendToVideoPrompt={(promptText) => {
                setActiveTab('prompt');
              }}
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'ideas' ? 1 : 0, y: activeTab === 'ideas' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'ideas' ? 'block' : 'hidden'}
          >
            <ContentIdeasTool
              initialVideoFile={ideasInitialVideo}
              initialTikTokTitle={ideasInitialTitle}
              initialTopic={ideasInitialTopic}
              initialTikTokUrl={ideasInitialUrl}
              onSendToPhotoPrompt={handleSendToPhotoPrompt}
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'photo' ? 1 : 0, y: activeTab === 'photo' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'photo' ? 'block' : 'hidden'}
          >
            <PhotoPromptGeneratorTool 
              initialConcept={photoInitialText} 
              initialNegativePrompt={photoInitialNegativePrompt} 
              initialReferenceImage={photoInitialReferenceImage} 
              initialSubjectReference={photoInitialSubjectReference}
              initialProductReference={photoInitialProductReference}
              autoGenerate={photoAutoGenerate}
              initialAspectRatio={photoInitialAspectRatio}
              initialPhotoStyle={photoInitialPhotoStyle}
              initialTargetGenerator={photoInitialTargetGenerator}
            />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'extractor' ? 1 : 0, y: activeTab === 'extractor' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'extractor' ? 'block' : 'hidden'}
          >
            <VideoFrameExtractorTool initialFile={extractorInitialVideo} />
          </motion.div>

          <motion.div 
            initial={false}
            animate={{ opacity: activeTab === 'prompt' ? 1 : 0, y: activeTab === 'prompt' ? 0 : 8 }} 
            transition={{ duration: 0.25 }}
            className={activeTab === 'prompt' ? 'block' : 'hidden'}
          >
            <div className="max-w-5xl mx-auto space-y-6">
              {/* Controls Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 shadow-sm">
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                    <Scissors className="w-3.5 h-3.5 text-[#5b50e5]" />
                    PECAH DURASI PROMPT PER KLIP
                  </label>
                  <div className="grid grid-cols-5 gap-1.5 p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-medium max-w-xl">
                    {[
                      { id: '5', label: '5s' },
                      { id: '8', label: '8s' },
                      { id: '10', label: '10s' },
                      { id: '15', label: '15s' },
                      { id: 'auto', label: 'Penuh' },
                    ].map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setSegmentDuration(item.id);
                          learningSync.track('split_duration_selected', { duration: item.id });
                        }}
                        className={`py-2 rounded-lg text-center transition-all cursor-pointer ${
                          segmentDuration === item.id
                            ? 'bg-[#5b50e5] text-white font-bold shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drag and Drop Upload / TikTok Link Input */}
              {!file ? (
                <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-6 shadow-sm space-y-4">
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                        PILIH SUMBER VIDEO:
                      </span>
                    </div>

                    <div className="inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl text-xs font-bold">
                      <button
                        type="button"
                        onClick={() => {
                          setVideoInputMode('upload');
                          setTiktokInputError(null);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          videoInputMode === 'upload'
                            ? 'bg-[#5b50e5] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>Unggah File Video</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setVideoInputMode('tiktok');
                          setError(null);
                        }}
                        className={`px-3.5 py-1.5 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer ${
                          videoInputMode === 'tiktok'
                            ? 'bg-[#5b50e5] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <LinkIcon className="w-3.5 h-3.5 text-amber-300" />
                        <span>Input Link TikTok</span>
                        <span className="px-1.5 py-0.2 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold uppercase">Direct</span>
                      </button>
                    </div>
                  </div>

                  {videoInputMode === 'upload' ? (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="upload"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className={`relative rounded-2xl border-2 border-dashed transition-all bg-slate-50/50 p-8 sm:p-12 text-center cursor-pointer shadow-sm
                          ${isDragging ? 'border-[#5b50e5] bg-indigo-50/50' : 'border-slate-200 hover:border-[#5b50e5] hover:bg-slate-50/80'}
                          ${error ? 'border-rose-300 bg-rose-50/50' : ''}
                        `}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <div className="flex flex-col items-center justify-center">
                          <div className="w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-[#5b50e5] mb-4 shadow-2xs">
                            <Upload className="w-8 h-8" />
                          </div>
                          <h3 className="text-lg font-bold text-slate-900 mb-1">Unggah Berkas Video Anda</h3>
                          <p className="text-xs sm:text-sm text-slate-500 mb-6 max-w-md">
                            Tarik & lepas berkas video di sini, atau klik untuk memilih file.
                            <br />
                            <span className="text-slate-400 text-xs">Akan dipecah per {segmentDuration !== 'auto' ? `${segmentDuration} detik` : 'keseluruhan durasi'}</span>
                          </p>
                          <button type="button" className="px-6 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-medium text-sm transition-all shadow-xs cursor-pointer">
                            Pilih File Video
                          </button>
                          <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleFileInput} 
                            accept="video/*" 
                            className="hidden" 
                          />
                        </div>
                      </motion.div>
                    </AnimatePresence>
                  ) : (
                    <AnimatePresence mode="wait">
                      <motion.div
                        key="tiktok_input"
                        initial={{ opacity: 0, scale: 0.98 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.98 }}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-6 sm:p-8 space-y-4"
                      >
                        <div className="space-y-1">
                          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                            <LinkIcon className="w-4 h-4 text-[#5b50e5]" />
                            Tempelkan Link Video TikTok
                          </h3>
                          <p className="text-xs text-slate-500">
                            Sistem akan mengambil video secara otomatis dari link TikTok tersebut untuk langsung diolah menjadi prompt sinematik.
                          </p>
                        </div>

                        <form onSubmit={handleFetchTikTokVideo} className="space-y-3">
                          <div className="relative flex items-center">
                            <input
                              type="text"
                              required
                              placeholder="Contoh: https://vt.tiktok.com/xxxx atau https://www.tiktok.com/@user/video/xxxx"
                              value={tiktokInputUrl}
                              onChange={(e) => setTiktokInputUrl(e.target.value)}
                              className="w-full pl-4 pr-28 py-3 rounded-xl border border-slate-300 text-xs sm:text-sm focus:ring-2 focus:ring-[#5b50e5] focus:border-[#5b50e5] outline-none bg-white shadow-xs font-medium text-slate-900"
                            />

                            <button
                              type="button"
                              onClick={handlePasteTikTokUrl}
                              className="absolute right-2 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                              title="Tempel dari Clipboard"
                            >
                              <Clipboard className="w-3.5 h-3.5" />
                              <span>Tempel</span>
                            </button>
                          </div>

                          {tiktokInputError && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-bold flex items-center gap-2">
                              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
                              <span>{tiktokInputError}</span>
                            </div>
                          )}

                          <div className="flex items-center justify-end gap-3 pt-2">
                            <button
                              type="submit"
                              disabled={isFetchingTikTokVideo || !tiktokInputUrl.trim()}
                              className="px-6 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-bold text-xs sm:text-sm transition-all shadow-xs flex items-center gap-2 cursor-pointer disabled:opacity-50"
                            >
                              {isFetchingTikTokVideo ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Mengambil Video TikTok...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 text-amber-300" />
                                  <span>Import & Analisis Video TikTok</span>
                                </>
                              )}
                            </button>
                          </div>
                        </form>
                      </motion.div>
                    </AnimatePresence>
                  )}
                </div>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.div
                    key="preview"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="p-5 rounded-2xl bg-white border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                      <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="relative rounded-xl overflow-hidden bg-slate-900 border border-slate-200 w-32 aspect-video shrink-0">
                          <video 
                            src={previewUrl!} 
                            controls 
                            className="w-full h-full object-cover"
                            onLoadedMetadata={(e) => {
                              const dur = Math.round(e.currentTarget.duration);
                              if (dur && !isNaN(dur)) {
                                setActualVideoDuration(dur);
                              }
                            }}
                          />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <FileVideo className="w-4 h-4 text-[#5b50e5] shrink-0" />
                            <h4 className="text-sm font-bold text-slate-900 truncate max-w-[200px]">{file.name}</h4>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                            <span>Ukuran: {(file.size / (1024 * 1024)).toFixed(1)} MB</span>
                            {actualVideoDuration ? (
                              <>
                                <span>•</span>
                                <span className="font-semibold text-slate-700">Durasi: {actualVideoDuration}s</span>
                                <span>•</span>
                                <span className="text-[#5b50e5] font-semibold">
                                  {actualVideoDuration}s ÷ {segmentDuration === 'auto' ? `${actualVideoDuration}s (Penuh)` : `${segmentDuration}s`} = {Math.max(1, Math.ceil(actualVideoDuration / (segmentDuration === 'auto' ? actualVideoDuration : (Number(segmentDuration) || 10))))} Segmen
                                </span>
                              </>
                            ) : null}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 w-full md:w-auto justify-end">
                        <button 
                          type="button"
                          onClick={reset}
                          className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-colors text-xs font-medium flex items-center gap-1.5 border border-slate-200 cursor-pointer"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Ganti Video</span>
                        </button>

                        <button
                          type="button"
                          onClick={generatePrompt}
                          disabled={isGenerating}
                          className="px-5 py-2.5 rounded-xl bg-[#5b50e5] hover:bg-[#4f46e5] text-white font-medium text-xs sm:text-sm flex items-center gap-2 transition-all shadow-xs cursor-pointer"
                        >
                          {isGenerating ? (
                            <>
                              <Loader2 className="w-4 h-4 animate-spin" />
                              <span>Memproses...</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-4 h-4 text-amber-300" />
                              <span>{prompt ? 'Proses Ulang' : 'Analisis & Pecah Prompt'}</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Split Progress */}
                    {isGenerating ? (
                      <EngagingLoadingState
                        title={`Membedah Video & Meracik Prompt ${targetAI === 'general' ? 'Universal' : targetAI.toUpperCase()}`}
                        subtitle={progressStep || 'AI Vision Engine sedang menganalisis sinematografi adegan, pencahayaan, dan audio dialog...'}
                        badgeText={analysisMode === 'deep' ? 'DEEP VISION PRO' : 'AI VIDEO PROMPT SPLITTER'}
                        icon={Clapperboard}
                        progress={progressPercent}
                        steps={[
                          'Tahap 1: Vision Grounding & Deteksi Perubahan Scene',
                          'Tahap 2: Analisis Sinematografi, Framing Lensa & Lighting 3-Titik',
                          'Tahap 3: Transkripsi Dialog Voice Over & Pacing Hook Retensi',
                          `Tahap 4: Finalisasi Format Prompt ${targetAI.toUpperCase()} & Caption SEO`
                        ]}
                        tips={[
                          'Prompt visual yang dihasilkan siap langsung disalin ke Runway Gen-3, OpenAI Sora, atau Kling AI.',
                          'Voice over yang diekstrak dapat langsung disuarakan menggunakan ElevenLabs atau AI Voice pilihan.',
                          'Pecah per 5 detik sangat ideal untuk algoritma TikTok agar video memiliki visual rhythm yang cepat dan dinamis.',
                          'Gunakan prompt foto untuk mengekstrak storyboard visual gambar adegan dengan konsistensi karakter tinggi.'
                        ]}
                      />
                    ) : prompt ? (
                      <SplitPromptViewer
                        rawPrompt={prompt}
                        segmentDuration={segmentDuration}
                        targetAI={targetAI}
                        sourceCaption={sourceCaption}
                        onSendToPhotoPrompt={handleSendToPhotoPrompt}
                      />
                    ) : null}
                  </motion.div>
                </AnimatePresence>
              )}
            </div>
          </motion.div>
        </main>
      </div>

      {/* MODALS */}
      <HistoryModal
        isOpen={isHistoryOpen}
        onClose={() => setIsHistoryOpen(false)}
        onRestoreItem={handleRestoreItem}
      />

      <AntiLimitModal
        isOpen={isAntiLimitOpen}
        onClose={() => setIsAntiLimitOpen(false)}
      />
    </div>
  );
}

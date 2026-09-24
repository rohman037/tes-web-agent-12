import { Segment, MicroClip } from '../types';

export interface ValidationResult {
  passed: boolean;
  score: number;
  failures: string[];
}

export function validateOutput(output: string): ValidationResult {
  const failures: string[] = [];
  const text = output || '';

  // C1: Caption ada
  if (!text.includes('CAPTION SEO') && !text.includes('Caption SEO') && !text.includes('CAPTION')) {
    failures.push('Missing CAPTION SEO section');
  }

  // C2: Hashtag ada
  if (!text.includes('HASHTAG') && !text.includes('Hashtag') && !text.includes('#')) {
    failures.push('Missing HASHTAG section');
  }

  // C3: Hashtag minimal 5 buah
  const hashtags = text.match(/#[\w\d_]+/g) || [];
  if (hashtags.length < 5) {
    failures.push(`Expected at least 5 hashtags, got ${hashtags.length}`);
  }

  // C4: Breakdown per segmen ada
  if (!text.includes('SEGMEN') && !text.includes('Segmen') && !text.includes('SEGMENT')) {
    failures.push('Missing SEGMEN breakdown');
  }

  // C5: Micro-clip punya Visual + Aksi + Suara/Subteks
  const visualCount = (text.match(/Visual:/gi) || []).length;
  const aksiCount = (text.match(/Aksi:/gi) || []).length;
  const suaraCount = (text.match(/Suara:/gi) || []).length;
  const subteksCount = (text.match(/Subteks:/gi) || []).length;

  if (visualCount === 0) failures.push('Missing Visual fields');
  if (aksiCount === 0) failures.push('Missing Aksi fields');
  if (suaraCount === 0 && subteksCount === 0) {
    failures.push('Missing Suara/Subteks fields');
  }

  // C6: Master Prompt ada
  if (!text.includes('MASTER PROMPT') && !text.includes('Master Prompt') && !text.includes('MASTER')) {
    failures.push('Missing MASTER PROMPT');
  }

  // C7: Negative Prompt ada
  if (!text.includes('NEGATIVE PROMPT') && !text.includes('Negative Prompt') && !text.includes('NEGATIVE')) {
    failures.push('Missing NEGATIVE PROMPT');
  }

  // C8: Ringkasan Teknis ada
  if (!text.includes('RINGKASAN TEKNIS') && !text.includes('Ringkasan Teknis') && !text.includes('TEKNIKAL')) {
    failures.push('Missing RINGKASAN TEKNIS');
  }

  // C9: Tidak ada placeholder yang belum diisi
  if (text.includes('[isi') || text.includes('[TODO') || text.includes('XXX') || text.includes('[N]')) {
    failures.push('Found unfilled placeholders');
  }

  const totalChecks = 9;
  const score = Math.max(0, Math.round(((totalChecks - failures.length) / totalChecks) * 100));

  return {
    passed: score >= 75 && failures.length <= 2,
    score,
    failures,
  };
}

/**
 * Utility parser to extract structured entities from markdown if needed
 */
export function parseMarkdownToStructuredOutput(markdown: string): {
  caption?: string;
  hashtags: string[];
  segments: Segment[];
  masterPrompt?: string;
  negativePrompt?: string;
  videoAnalysis?: {
    visualAndStyle: string;
    audioAndMusic: string;
    cameraAndFraming: string;
    lightingAndMood: string;
  };
  technicalSummary?: Record<string, string>;
} {
  const hashtags = Array.from(new Set(markdown.match(/#[\w\d_]+/g) || [])).slice(0, 5);

  // Video Analysis Extraction
  let videoAnalysis: {
    visualAndStyle: string;
    audioAndMusic: string;
    cameraAndFraming: string;
    lightingAndMood: string;
  } | undefined = undefined;

  const analysisMatch = markdown.match(/##\s*🎬?\s*ANALISIS VIDEO[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (analysisMatch) {
    const aText = analysisMatch[1];
    const vis = aText.match(/(?:Visual\s*&\s*Gaya|Visual|Gaya)[:\s]*([^\n]+)/i);
    const aud = aText.match(/(?:Audio\s*&\s*Musik|Audio|Musik)[:\s]*([^\n]+)/i);
    const kam = aText.match(/(?:Kamera\s*&\s*Lensa|Kamera|Lensa)[:\s]*([^\n]+)/i);
    const lig = aText.match(/(?:Lighting\s*&\s*Mood|Lighting|Mood)[:\s]*([^\n]+)/i);

    videoAnalysis = {
      visualAndStyle: vis ? vis[1].replace(/^\*+|\*+$/g, '').trim() : '',
      audioAndMusic: aud ? aud[1].replace(/^\*+|\*+$/g, '').trim() : '',
      cameraAndFraming: kam ? kam[1].replace(/^\*+|\*+$/g, '').trim() : '',
      lightingAndMood: lig ? lig[1].replace(/^\*+|\*+$/g, '').trim() : '',
    };
  }

  let caption = '';
  const captionMatch = markdown.match(/##\s*📋?\s*CAPTION[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (captionMatch) {
    caption = captionMatch[1].trim();
  }

  let masterPrompt = '';
  const masterMatch = markdown.match(/##\s*🎯?\s*MASTER PROMPT[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (masterMatch) {
    masterPrompt = masterMatch[1].trim();
  }

  let negativePrompt = '';
  const negMatch = markdown.match(/##\s*🚫?\s*NEGATIVE PROMPT[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (negMatch) {
    negativePrompt = negMatch[1].trim();
  }

  // Technical summary
  const technicalSummary: Record<string, string> = {};
  const techMatch = markdown.match(/##\s*📊?\s*RINGKASAN TEKNIS[^\n]*\n([\s\S]*?)(?=##|$)/i);
  if (techMatch) {
    const lines = techMatch[1].split('\n');
    for (const line of lines) {
      const parts = line.replace(/^[\s\-*]+/, '').split(':');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join(':').trim();
        if (key && val) {
          technicalSummary[key] = val;
        }
      }
    }
  }

  const segments: Segment[] = [];
  
  // Robust segment splitting: split by "### 📹 SEGMEN"
  const breakdownMatch = markdown.match(/##\s*🎞️?\s*BREAKDOWN PER SEGMEN[^\n]*\n([\s\S]*?)(?=\n##\s*📊|\n##\s*🎯|\n##\s*🚫|$)/i);
  const breakdownText = breakdownMatch ? breakdownMatch[1] : markdown;

  const segmentBlocks = breakdownText.split(/(?=\n###\s*📹?\s*SEGMEN|\n##\s*📹?\s*SEGMEN)/gi);

  for (const block of segmentBlocks) {
    const headerMatch = block.match(/(?:###|##)\s*📹?\s*SEGMEN\s*(\d+)[\s—\-]*\[?([^\]\n]*)\]?/i);
    if (!headerMatch) continue;

    const segIdx = parseInt(headerMatch[1], 10) || segments.length + 1;
    let timeRange = (headerMatch[2] || '').trim();
    
    const stageMatch = block.match(/\*\*Stage:\s*([^\*\n]+)\*\*/i);
    const stageLabel = stageMatch ? stageMatch[1].trim() : 'Sinematik';

    // Extract micro-clips inside this segment
    const microClips: MicroClip[] = [];

    // Check codeblock first, fallback to entire block
    const codeBlockMatch = block.match(/```(?:text)?\n([\s\S]*?)```/);
    const bodyContent = codeBlockMatch ? codeBlockMatch[1] : block;

    // Split into individual micro clips
    // Matches patterns like "[0–2 detik]", "0-2 detik", "[Micro-clip 1, contoh: 0–2 detik]"
    const clipRegex = /(?:\[(?:Micro-clip\s*\d+,?\s*(?:contoh:\s*)?)?(\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s)?)\]|(\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s)))\s*\n([\s\S]*?)(?=(?:\[(?:Micro-clip\s*\d+,?\s*(?:contoh:\s*)?)?\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s)?\]|\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s))\s*\n|$)/gi;

    let clipMatch;
    while ((clipMatch = clipRegex.exec(bodyContent)) !== null) {
      const rawTime = (clipMatch[1] || clipMatch[2] || '').trim();
      const clipBody = clipMatch[3] || '';

      const visMatch = clipBody.match(/Visual:\s*([^\n]+)/i);
      const aksMatch = clipBody.match(/Aksi:\s*([^\n]+)/i);
      const suaMatch = clipBody.match(/Suara:\s*"?([^"\n]+)"?/i);
      const subMatch = clipBody.match(/Subteks:\s*"?([^"\n]+)"?/i);

      if (visMatch || aksMatch || clipBody.trim()) {
        microClips.push({
          timeRange: rawTime.includes('detik') ? rawTime : `${rawTime} detik`,
          visual: visMatch ? visMatch[1].trim() : clipBody.trim(),
          aksi: aksMatch ? aksMatch[1].trim() : '',
          suara: suaMatch ? suaMatch[1].trim() : null,
          subteks: subMatch ? subMatch[1].trim() : null,
        });
      }
    }

    // Fallback: If no microClips parsed with regex, parse lines
    if (microClips.length === 0) {
      const lines = bodyContent.split('\n');
      let currentClip: Partial<MicroClip> = {};
      for (const line of lines) {
        const tMatch = line.match(/^\[?(\d+(?:[.,]\d+)?\s*[–\-—]\s*\d+(?:[.,]\d+)?\s*(?:detik|s)?)\]?/i);
        if (tMatch && !line.toLowerCase().includes('segmen')) {
          if (currentClip.visual || currentClip.aksi) {
            microClips.push({
              timeRange: currentClip.timeRange || '',
              visual: currentClip.visual || '',
              aksi: currentClip.aksi || '',
              suara: currentClip.suara || null,
              subteks: currentClip.subteks || null,
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
          timeRange: currentClip.timeRange || '',
          visual: currentClip.visual || '',
          aksi: currentClip.aksi || '',
          suara: currentClip.suara || null,
          subteks: currentClip.subteks || null,
        });
      }
    }

    if (!timeRange && microClips.length > 0) {
      timeRange = `${microClips[0].timeRange.split(/[–\-—]/)[0]}–${microClips[microClips.length - 1].timeRange.split(/[–\-—]/)[1] || ''}`;
    }

    segments.push({
      segmentIndex: segIdx,
      timeRange: timeRange || `Segmen ${segIdx}`,
      stageLabel,
      microClips,
    });
  }

  return {
    caption,
    hashtags,
    segments,
    masterPrompt,
    negativePrompt,
    videoAnalysis,
    technicalSummary,
  };
}

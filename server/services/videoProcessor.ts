import { logger } from '@/server/core/utils/logger';

export interface VideoValidationResult {
  valid: boolean;
  error?: string;
  fileSizeBytes?: number;
  mimeType?: string;
  durationSeconds?: number;
}

export interface VideoClipSegment {
  clip_number: number;
  start_time: number;
  end_time: number;
  duration_label: string;
}

export interface VideoProcessingMetadata {
  duration: number | string;
  total_clip: number;
  split_duration: string;
}

export interface VideoProcessorOutput {
  metadata: VideoProcessingMetadata;
  segments: VideoClipSegment[];
  effectiveDuration: number;
}

/**
 * STEP 1: VALIDATION
 * Validates video file, mime type, size, and duration
 */
export function validateVideoInput(input: {
  base64Data?: string;
  videoUrl?: string;
  mimeType?: string;
  duration?: number;
  maxSizeBytes?: number;
}): VideoValidationResult {
  const { base64Data, videoUrl, mimeType, duration, maxSizeBytes = 100 * 1024 * 1024 } = input;

  if (!base64Data && !videoUrl) {
    return {
      valid: false,
      error: 'Berkas video atau tautan video tidak ditemukan. Silakan unggah video.',
    };
  }

  // Format validation
  const allowedMimes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/mkv', 'video/avi'];
  const isText = mimeType && (mimeType.startsWith('text/') || mimeType === 'application/json');
  if (mimeType && !mimeType.startsWith('video/') && !allowedMimes.includes(mimeType.toLowerCase()) && !isText) {
    return {
      valid: false,
      error: `Format berkas "${mimeType}" tidak didukung. Harap gunakan format MP4, WebM, MOV, atau teks prompt.`,
    };
  }

  // Size validation for base64
  let fileSizeBytes = 0;
  if (base64Data) {
    // Approximate byte length of base64
    fileSizeBytes = Math.round((base64Data.length * 3) / 4);
    if (fileSizeBytes > maxSizeBytes) {
      return {
        valid: false,
        error: `Ukuran file video (${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB) melebihi batas maksimal 100 MB.`,
        fileSizeBytes,
      };
    }
  }

  // Duration validation
  let durationSeconds = typeof duration === 'number' && !isNaN(duration) && duration > 0 ? duration : undefined;
  if (duration !== undefined && (isNaN(duration) || duration <= 0)) {
    return {
      valid: false,
      error: 'Durasi video tidak valid.',
    };
  }

  return {
    valid: true,
    fileSizeBytes,
    mimeType: mimeType || 'video/mp4',
    durationSeconds,
  };
}

/**
 * STEP 2: VIDEO SEGMENTATION
 * Calculates clip segments based on chosen duration (5s, 8s, 10s, 15s, or Full)
 */
export function processVideoSegmentation(
  estimatedOrActualDuration: number = 30,
  splitChoice: string = '10'
): VideoProcessorOutput {
  const totalDuration = Math.max(1, Math.round(estimatedOrActualDuration || 30));
  const isFull = splitChoice === 'auto' || splitChoice === 'full' || splitChoice === 'Full' || splitChoice === '0';

  let splitSec = 10;
  if (!isFull) {
    const parsed = parseInt(splitChoice, 10);
    if ([5, 8, 10, 15].includes(parsed)) {
      splitSec = parsed;
    } else if (parsed > 0) {
      splitSec = parsed;
    }
  }

  const segments: VideoClipSegment[] = [];

  if (isFull) {
    segments.push({
      clip_number: 1,
      start_time: 0,
      end_time: totalDuration,
      duration_label: `0-${totalDuration} detik`,
    });
  } else {
    let currentStart = 0;
    let clipIndex = 1;

    while (currentStart < totalDuration) {
      const currentEnd = Math.min(totalDuration, currentStart + splitSec);
      segments.push({
        clip_number: clipIndex,
        start_time: currentStart,
        end_time: currentEnd,
        duration_label: `${currentStart}-${currentEnd} detik`,
      });
      clipIndex++;
      currentStart = currentEnd;
    }
  }

  const metadata: VideoProcessingMetadata = {
    duration: `${totalDuration} detik`,
    total_clip: segments.length,
    split_duration: isFull ? 'Penuh (Full)' : `${splitSec} detik`,
  };

  logger.info(`[videoProcessor] Video segmented: ${totalDuration}s into ${segments.length} clips (split: ${metadata.split_duration})`);

  return {
    metadata,
    segments,
    effectiveDuration: totalDuration,
  };
}

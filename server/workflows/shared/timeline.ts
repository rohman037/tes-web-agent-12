export interface Timeline {
  clips: { start: number; end: number }[];
  total: number;
}

export function calculateTimeline(
  maxDuration: number,
  segmentDuration: number
): Timeline {
  const max = Math.max(1, maxDuration || 30);
  const seg = Math.max(1, segmentDuration || 3);
  const clipCount = Math.ceil(max / seg);
  const clips = Array.from({ length: clipCount }, (_, i) => ({
    start: i * seg,
    end: Math.min((i + 1) * seg, max),
  }));

  return { clips, total: max };
}

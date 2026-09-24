import { describe, it, expect } from 'vitest';
import { validateClipStructure } from '@/server/workflows/shared/validator';
import { calculateTimeline } from '@/server/workflows/shared/timeline';
import { validateContentIdeasOutput } from '@/server/workflows/content-ideas/validators/output-validator';
import { validateShopIdeasOutput, validateOutput as validateShopOutput } from '@/server/workflows/tiktok-shop-ideas/validators/output-validator';
import { validateOutput as validateVideoPromptOutput, parseMarkdownToStructuredOutput } from '@/server/workflows/video-to-prompt/validators/output-validator';

describe('Unit Test: Workflow Validators & Timeline Engine', () => {
  describe('Shared Clip Structure Validator', () => {
    it('should pass on valid clip structure with all required fields', () => {
      const validText = `
        Visual: Pria muda tersenyum memegang produk
        Aksi: Menunjukkan botol ke arah kamera secara close-up
        Voice Over: Ini dia solusi praktis buat kamu yang sering lembur!
        Timeline: 0 - 3 detik
      `;
      const result = validateClipStructure(validText);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
      expect(result.failures.length).toBe(0);
    });

    it('should fail when Visual or Aksi labels are missing', () => {
      const invalidText = `
        Voice Over: Halo semuanya!
        Timeline: 0 - 3 detik
      `;
      const result = validateClipStructure(invalidText);
      expect(result.failures.some((f) => f.rule_id === 'C1')).toBe(true);
      expect(result.failures.some((f) => f.rule_id === 'C2')).toBe(true);
    });

    it('should detect missing clip duration timeline', () => {
      const noTimelineText = `
        Visual: Membuka kemasan produk
        Aksi: Menatap kamera
        Voice Over: Jangan lupa dicoba ya!
      `;
      const result = validateClipStructure(noTimelineText);
      expect(result.failures.some((f) => f.rule_id === 'C4')).toBe(true);
    });
  });

  describe('Shared Timeline Calculator', () => {
    it('should calculate correct clip intervals and total duration', () => {
      const timeline = calculateTimeline(15, 3);
      expect(timeline.total).toBe(15);
      expect(timeline.clips.length).toBe(5);
      expect(timeline.clips[0]).toEqual({ start: 0, end: 3 });
      expect(timeline.clips[4]).toEqual({ start: 12, end: 15 });
    });

    it('should handle edge cases with 0 or negative duration safely', () => {
      const timeline = calculateTimeline(0, 0);
      expect(timeline.total).toBe(30);
      expect(timeline.clips.length).toBeGreaterThan(0);
    });
  });

  describe('Content Ideas Output Validator', () => {
    it('should validate valid content ideas output', () => {
      const sample = `
        ### 💡 IDE 1: Resep Sambal Bawang Super Gurih
        Visual: Wajan panas dengan minyak mendidih
        Aksi: Menuangkan cabai rawit merah dan bawang ke minyak panas
        Voice Over: Rahasia sambal enak ada di minyak panas yang pas!
        Timeline: 0 - 5 detik
      `;
      const result = validateContentIdeasOutput(sample);
      expect(result.isValid).toBe(true);
      expect(result.needsRefine).toBe(false);
      expect(result.issues.length).toBe(0);
    });

    it('should reject output that is too short (< 80 chars) or empty', () => {
      const result = validateContentIdeasOutput('');
      expect(result.isValid).toBe(false);
      expect(result.needsRefine).toBe(true);
      expect(result.issues[0]).toContain('terlalu pendek atau kosong');
    });

    it('should flag hallucinated / unstructured AI text missing IDE headers', () => {
      const hallucinated = `
        Tentu saja! Ini rekomendasi video viral untuk Anda:
        Pertama buat video tentang makanan enak di Jakarta.
        Kedua buat video jalan-jalan ke pantai.
        Semoga konten ini membantu meningkatkan followers Anda!
      `;
      const result = validateContentIdeasOutput(hallucinated);
      expect(result.isValid).toBe(false);
      expect(result.issues.some((i) => i.includes('Header ide konten'))).toBe(true);
    });
  });

  describe('TikTok Shop Ideas Output Validator', () => {
    it('should validate complete TikTok shop output', () => {
      const rawText = `
        Draft Caption: Pashmina silk anti kusut bikin look kamu makin elegan! #pashmina #hijabfashion #ootdmuslim
        Visual: Model memakai pashmina silk warna nude
        Aksi: Mengibaskan kain untuk menunjukkan bahan anti lecek
        Voice Over: Mau tampil rapi seharian tanpa ribet setrika?
        Sound Effect: Whoosh lembut
        Timeline: 0 - 4 detik
      `;
      const result = validateShopOutput(rawText, undefined, true);
      expect(result.score).toBeGreaterThan(60);
      expect(result.failures.length).toBe(0);
    });

    it('should flag missing product anchor when required', () => {
      const textWithoutProduct = `
        Draft Caption: Tips outfit santai #ootd #style #fashion
        Visual: Pemandangan taman kota di sore hari
        Aksi: Berjalan santai menikmati sunset
        Voice Over: Sore hari yang indah
        Timeline: 0 - 3 detik
      `;
      const summary = validateShopIdeasOutput(textWithoutProduct, true);
      expect(summary.hasVisualAnchor).toBe(false);
      expect(summary.failures.some((f) => f.includes('Identitas jangkar'))).toBe(true);
    });
  });

  describe('Video to Prompt Validator & Parser', () => {
    it('should validate structured video prompt output', () => {
      const validPromptOutput = `
        CAPTION SEO: Tutorial edit video aesthetic langsung di HP!
        HASHTAG: #tutorialvideo #capcut #videocreator #editingtips #contentcreator
        SEGMEN 1: Hook Pembuka
        Visual: Tangan menggeser timeline video di smartphone
        Aksi: Mengetuk layar dengan efek zoom cepat
        Suara: Edit video cinematic cuma butuh 1 menit?
        MASTER PROMPT: High quality cinematography, 4k resolution, Sony A7IV look
        NEGATIVE PROMPT: blurry, noisy, low resolution, distorted
        RINGKASAN TEKNIS: Format 9:16, 60fps, Color Grade Teal and Orange
      `;

      const result = validateVideoPromptOutput(validPromptOutput);
      expect(result.passed).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(75);
      expect(result.failures.length).toBe(0);
    });

    it('should reject output containing unfilled placeholders or missing required sections', () => {
      const incompleteOutput = `
        CAPTION SEO: Ide konten baru
        HASHTAG: #satu #dua
        SEGMEN 1: Intro
        Visual: [isi visual di sini]
        Aksi: [TODO aksi model]
      `;
      const result = validateVideoPromptOutput(incompleteOutput);
      expect(result.passed).toBe(false);
      expect(result.failures.some((f) => f.includes('placeholders'))).toBe(true);
      expect(result.failures.some((f) => f.includes('at least 5 hashtags'))).toBe(true);
      expect(result.failures.some((f) => f.includes('MASTER PROMPT'))).toBe(true);
    });

    it('should parse markdown hashtags correctly', () => {
      const md = `
        #tutorial #video #creator #viral #fyp #extra
      `;
      const parsed = parseMarkdownToStructuredOutput(md);
      expect(parsed.hashtags.length).toBeLessThanOrEqual(5);
      expect(parsed.hashtags).toContain('#tutorial');
    });

    it('should parse full markdown structure including segments and video analysis', () => {
      const fullMd = `
## 🎬 ANALISIS VIDEO
Visual & Gaya: Cinematic cyberpunk neon
Audio & Musik: Lo-fi beat with synthwave bass
Kamera & Lensa: 35mm f/1.4 shallow depth
Lighting & Mood: Dark ambient with high contrast neon

## 📋 CAPTION
Ide konten terbaik buat kreator masa kini!

## 🎯 MASTER PROMPT
Hyperrealistic 8k cinematic shot

## 🚫 NEGATIVE PROMPT
blurry, low quality, oversaturated

## 📊 RINGKASAN TEKNIS
Resolusi: 4K UHD 60fps
Color Space: Rec.709

## 🎞️ BREAKDOWN PER SEGMEN
### 📹 SEGMEN 1 [0–3 detik]
**Stage: Hook Pembuka**
Visual: Close up barista menuang kopi
Aksi: Menggerakkan cangkir dengan presisi
Suara: "Kopi terbaik di Jakarta"
Subteks: "Jangan lewatkan promo hari ini!"
      `;

      const parsed = parseMarkdownToStructuredOutput(fullMd);
      expect(parsed.caption).toContain('Ide konten terbaik');
      expect(parsed.masterPrompt).toBe('Hyperrealistic 8k cinematic shot');
      expect(parsed.negativePrompt).toBe('blurry, low quality, oversaturated');
      expect(parsed.videoAnalysis?.visualAndStyle).toBe('Cinematic cyberpunk neon');
      expect(parsed.videoAnalysis?.audioAndMusic).toBe('Lo-fi beat with synthwave bass');
      expect(parsed.technicalSummary?.['Resolusi']).toBe('4K UHD 60fps');
      expect(parsed.segments.length).toBeGreaterThan(0);
      expect(parsed.segments[0].microClips.length).toBeGreaterThan(0);
      expect(parsed.segments[0].microClips[0].visual).toContain('Close up barista');
    });
  });
});

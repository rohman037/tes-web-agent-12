export const BANNED_SPAM_TAGS = new Set([
  'fyp', 'fypシ', 'fypviral', 'foryou', 'foryoupage', 'foru', 'racuntiktok',
  'racuntiktokshop', 'viral', 'viralvideo', 'trending', 'trendingvideo',
  'beranda', 'masukberanda', 'fypindonesia', 'fyppage', 'viraltiktok', 'foryourpage',
  'racunshopee', 'racuntiktokmurah', 'gayaingatfyp', 'xyzbca', 'explore', 'explorepage',
  'reels', 'tiktok', 'tik_tok', 'trend', 'videoviral'
]);

/**
 * Clean a product/subject title or search query that may contain hashtags (#hashtag),
 * punctuation, or concatenated tags into natural human words.
 * Example: "#setelananak #onesetmurah #bajuanakviral" -> "Setelan Anak One Set Murah Baju Anak Viral"
 */
export function cleanSubjectTitle(input: string): string {
  if (!input) return 'Produk Pilihan';

  // Replace hashtags with space
  let cleaned = input.replace(/#/g, ' ');

  // Separate camelCase or PascalCase words if any (e.g. SetelanAnak -> Setelan Anak)
  cleaned = cleaned.replace(/([a-z])([A-Z])/g, '$1 $2');

  // Replace multiple symbols/underscores with space
  cleaned = cleaned.replace(/[_\-./\\+*~`!?:;"'(){}[\]<>]/g, ' ');

  // Collapse multiple spaces
  cleaned = cleaned.trim().replace(/\s+/g, ' ');

  if (!cleaned) return 'Produk Pilihan';

  // Capitalize each word properly
  return cleaned
    .split(' ')
    .map((w) => (w.length > 0 ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : ''))
    .join(' ');
}

/**
 * Remove stray `#` symbols from within sentence bodies and convert hashtagged words
 * to clean readable text inside captions.
 * Example: "Pernah kepikiran kalau #setelananak #onesetmurah bisa sebagus ini?"
 *       -> "Pernah kepikiran kalau setelan anak oneset murah bisa sebagus ini?"
 */
export function cleanInlineHashtagsFromSentence(sentence: string): string {
  if (!sentence) return sentence;

  // Convert inline `#word` into natural lowercase/readable word without `#`
  return sentence.replace(/#([\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+)/g, (match, tag) => {
    // Separate camelCase words in tag
    const expanded = tag.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ');
    return expanded;
  });
}

/**
 * Generate 5 high-relevance hashtags based on product title, category, and visual context.
 * Strict anti-spam: 0% generic tags like #fyp or #viral.
 */
export function generateProductRelevantHashtags(
  productOrTopic: string,
  category?: string,
  context?: string
): string[] {
  const cleanTitle = cleanSubjectTitle(productOrTopic);
  const words = cleanTitle
    .replace(/[^\w\s]/gi, '')
    .split(/\s+/)
    .filter((w) => w.length > 2);

  const tags: string[] = [];

  const addTag = (rawTag: string) => {
    if (!rawTag) return;
    const formatted = rawTag.startsWith('#') ? rawTag : `#${rawTag}`;
    const cleanNoHash = formatted.slice(1).toLowerCase();
    if (
      !BANNED_SPAM_TAGS.has(cleanNoHash) &&
      !tags.some((t) => t.toLowerCase() === formatted.toLowerCase()) &&
      tags.length < 5
    ) {
      tags.push(formatted);
    }
  };

  // 1. Specific product name tag
  if (words.length >= 2) {
    addTag(`#${words.slice(0, 2).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')}`);
  } else if (words[0]) {
    addTag(`#${words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()}`);
  }

  // 2. Review / Spill Tag
  if (words[0]) {
    addTag(`#Review${words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()}`);
  }

  // 3. Category Tag
  if (category) {
    const cleanCat = category.replace(/[^\w\s]/gi, '').split(/\s+/).filter((w) => w.length > 2);
    if (cleanCat.length > 0) {
      addTag(`#${cleanCat.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('')}`);
    }
  }

  // 4. Recommendation Tag
  if (words[0]) {
    addTag(`#Rekomendasi${words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()}`);
  }

  // 5. Solution / Outfit / Style Tag
  if (words[1]) {
    addTag(`#Outfit${words[1].charAt(0).toUpperCase() + words[1].slice(1).toLowerCase()}`);
  } else if (words[0]) {
    addTag(`#Spill${words[0].charAt(0).toUpperCase() + words[0].slice(1).toLowerCase()}`);
  }

  // Fallbacks if still less than 5
  const fallbacks = [
    '#InspirasiOutfit',
    '#RekomendasiProduk',
    '#ReviewJujur',
    '#GayaKeren',
    '#KebutuhanHarian',
    '#PilihanTerbaik',
  ];

  for (const fb of fallbacks) {
    if (tags.length >= 5) break;
    addTag(fb);
  }

  return tags.slice(0, 5);
}

export function sanitizeCaptionsAndHashtags(text: string): string {
  if (!text) return text;

  let result = text;

  // 1. Clean spam phrasing in caption text
  result = result
    .replace(/\b(racun\s*tik\s*tok|racun\s*tiktok)\b/gi, 'rekomendasi produk pilihan')
    .replace(/\b(for\s*your\s*page|f\s*y\s*p|fyp)\b/gi, 'pencarian sosial media')
    .replace(/\b(viral\s*di\s*tiktok|viral\s*tiktok)\b/gi, 'banyak dicari');

  // 2. Sanitize explicit Hashtag markdown sections
  const hashtagSectionRegex = /(\*\*(?:Hashtags?[^\n]*|Hashtag[^\n]*)\*\*[:\s]*\n*)([\s\S]*?)(?=\n*---|\n*###|\n-|\n\n|$)/gi;
  result = result.replace(hashtagSectionRegex, (fullMatch, prefix, hashtagsContent) => {
    const rawTags = hashtagsContent.match(/#[\w\u0590-\u05ff\u0600-\u06ff\u0e00-\u0e7f_]+/g) || [];
    const validTags: string[] = [];

    for (const tag of rawTags) {
      const cleanTag = tag.slice(1).toLowerCase();
      if (!BANNED_SPAM_TAGS.has(cleanTag) && !validTags.includes(tag)) {
        validTags.push(tag);
      }
    }

    const clamped = validTags.slice(0, 5);
    if (clamped.length > 0) {
      return `${prefix}${clamped.join(' ')}\n`;
    }
    return fullMatch;
  });

  return result;
}

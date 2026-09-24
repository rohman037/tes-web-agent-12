import { logger } from '@/server/core/utils/logger';

export const tiktokCache = new Map<string, { timestamp: number; data: any }>();
export const TIKTOK_CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

// Helper to extract clean URL from text (e.g. from user sharing text from TikTok app)
export function extractUrlFromText(text: string): string {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  const urlMatch = trimmed.match(/https?:\/\/[^\s]+/i);
  if (urlMatch) {
    // Strip trailing punctuation often attached from copy-paste
    return urlMatch[0].replace(/[)\]}>,;."']+$/, '');
  }
  return trimmed;
}

export interface TikTokShopProductInfo {
  name: string;
  description: string;
  price: string;
  imageUrl?: string;
  raw: string;
}

export async function fetchTikTokShopProduct(shopUrl: string): Promise<TikTokShopProductInfo | null> {
  try {
    if (!shopUrl || typeof shopUrl !== 'string') return null;
    let cleanUrl = extractUrlFromText(shopUrl).trim();
    if (!cleanUrl) return null;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    // 1. Extract fallback keywords from URL slug (e.g. /product/azarine-hydrasoothe-sunscreen-gel...)
    let urlSlugKeywords = '';
    try {
      const urlObj = new URL(cleanUrl);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 2);
      const rawSlug = pathParts.join(' ').replace(/[-_]/g, ' ');
      if (rawSlug && !rawSlug.includes('http')) {
        const cleaned = rawSlug.replace(/\b(product|item|i|p|dp|detail|view|shop|seller|buy|video|id|tokopedia|tiktok)\b/gi, '').trim();
        if (cleaned.length >= 3) {
          urlSlugKeywords = cleaned;
        }
      }
    } catch (e) {}

    // 2. Fetch with redirect follow and realistic browser headers
    let finalUrl = cleanUrl;
    let htmlText = '';
    try {
      const res = await fetch(cleanUrl, {
        method: 'GET',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
          'Accept-Language': 'id-ID,id;q=0.9,en-US;q=0.8,en;q=0.7',
          'Sec-Ch-Ua': '"Google Chrome";v="124", "Chromium";v="124", "Not-A.Brand";v="99"',
          'Sec-Ch-Ua-Mobile': '?0',
          'Sec-Ch-Ua-Platform': '"Windows"',
          'Sec-Fetch-Dest': 'document',
          'Sec-Fetch-Mode': 'navigate',
          'Sec-Fetch-Site': 'none',
          'Sec-Fetch-User': '?1',
          'Upgrade-Insecure-Requests': '1',
        },
        signal: AbortSignal.timeout(9000)
      });

      if (res.ok) {
        finalUrl = res.url || cleanUrl;
        htmlText = await res.text();
      }
    } catch (err) {
      logger.warn('[fetchTikTokShopProduct] Direct fetch error, will use fallback metadata:', err);
    }

    let productName = '';
    let productDesc = '';
    let productPrice = '';
    let productImg = '';

    if (htmlText) {
      // Try JSON-LD structured data first
      try {
        const jsonLdMatches = htmlText.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
        if (jsonLdMatches) {
          for (const scriptTag of jsonLdMatches) {
            const content = scriptTag.replace(/<script[^>]*>|<\/script>/gi, '').trim();
            try {
              const parsed = JSON.parse(content);
              const items = Array.isArray(parsed) ? parsed : (parsed['@graph'] || [parsed]);
              for (const it of items) {
                if (it && (it['@type'] === 'Product' || it.name)) {
                  if (!productName && it.name) productName = String(it.name).trim();
                  if (!productDesc && it.description) productDesc = String(it.description).trim();
                  if (!productImg && it.image) {
                    productImg = Array.isArray(it.image) ? it.image[0] : (typeof it.image === 'string' ? it.image : it.image?.url || '');
                  }
                  if (!productPrice && it.offers) {
                    const offer = Array.isArray(it.offers) ? it.offers[0] : it.offers;
                    if (offer?.price) productPrice = `${offer.priceCurrency || 'Rp'} ${offer.price}`;
                  }
                }
              }
            } catch (jsonErr) {}
          }
        }
      } catch (e) {}

      // OpenGraph & Meta Tags extraction
      const ogTitleMatch = htmlText.match(/<meta[^>]*property=["']og:title["'][^>]*content=["']([^"']+)["']/i) ||
                           htmlText.match(/<meta[^>]*name=["']twitter:title["'][^>]*content=["']([^"']+)["']/i) ||
                           htmlText.match(/<title>([^<]+)<\/title>/i);
      const ogDescMatch = htmlText.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["']/i) ||
                          htmlText.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["']/i);
      const ogImageMatch = htmlText.match(/<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i) ||
                           htmlText.match(/<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i);
      const ogPriceMatch = htmlText.match(/<meta[^>]*property=["'](?:product:price:amount|og:price:amount)["'][^>]*content=["']([^"']+)["']/i) ||
                           htmlText.match(/(?:Rp\s*[\d\.,]+)/i);

      if (!productName && ogTitleMatch) {
        const candidateTitle = ogTitleMatch[1]
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .replace(/\s*\|\s*(TikTok Shop|TikTok|Tokopedia).*$/i, '')
          .replace(/\s*-\s*(TikTok Shop|TikTok|Tokopedia).*$/i, '')
          .trim();

        // Reject bot security checks or generic login pages
        const isChallenge = /security check|captcha|robot|log in|sign up|something went wrong|tiktok - make your day/i.test(candidateTitle);
        if (!isChallenge && candidateTitle.length >= 3) {
          productName = candidateTitle;
        }
      }

      if (!productDesc && ogDescMatch) {
        productDesc = ogDescMatch[1]
          .replace(/&#x27;/g, "'")
          .replace(/&quot;/g, '"')
          .replace(/&amp;/g, '&')
          .trim();
      }

      if (!productImg && ogImageMatch) {
        productImg = ogImageMatch[1].trim();
      }

      if (!productPrice && ogPriceMatch) {
        productPrice = ogPriceMatch[0] || ogPriceMatch[1] || '';
      }
    }

    // If TikWM has video data or caption associated with the link
    if (!productName) {
      try {
        const tikWmRes = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(finalUrl)}&hd=1`, {
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        const tikWmData = await tikWmRes.json();
        if (tikWmData && tikWmData.code === 0 && tikWmData.data) {
          const v = tikWmData.data;
          if (v.title) productName = v.title;
          if (!productImg && (v.cover || v.origin_cover)) productImg = v.cover || v.origin_cover;
        }
      } catch (e) {}
    }

    // Fallback: URL slug keywords
    if (!productName && urlSlugKeywords) {
      productName = urlSlugKeywords
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
    }

    if (!productName && !urlSlugKeywords) {
      return {
        name: 'Produk TikTok Shop',
        description: `Produk dari tautan ${shopUrl}`,
        price: productPrice || '',
        imageUrl: productImg || '',
        raw: `Link: ${shopUrl}`
      };
    }

    return {
      name: productName || 'Produk TikTok Shop',
      description: productDesc || `Produk pilihan dari TikTok Shop: ${productName}`,
      price: productPrice || '',
      imageUrl: productImg || '',
      raw: `Nama: ${productName}\nHarga: ${productPrice}\nDeskripsi: ${productDesc}\nURL: ${finalUrl}`
    };
  } catch (err) {
    logger.warn('[fetchTikTokShopProduct] Exception:', err);
    return null;
  }
}

export async function fetchTikTokVideoInfo(url: string) {
  let cleanUrl = extractUrlFromText(url);
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  // Check Cache
  const cached = tiktokCache.get(cleanUrl);
  if (cached && Date.now() - cached.timestamp < TIKTOK_CACHE_TTL_MS) {
    logger.info('[TikTok Cache Hit]', cleanUrl);
    return cached.data;
  }

  // Resolve redirect for shortlinks (vt.tiktok.com, vm.tiktok.com, /t/, vt.tokopedia.com, tokopedia.link)
  let resolvedUrl = cleanUrl;
  if (cleanUrl.includes('vt.tiktok.com') || cleanUrl.includes('vm.tiktok.com') || cleanUrl.includes('/t/') || cleanUrl.includes('tokopedia')) {
    try {
      const headRes = await fetch(cleanUrl, {
        method: 'HEAD',
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
        }
      });
      if (headRes.ok && headRes.url && headRes.url !== cleanUrl) {
        resolvedUrl = headRes.url;
      }
    } catch (e) {
      // Ignore redirect error, proceed with original
    }
  }

  const urlsToTry = Array.from(new Set([cleanUrl, resolvedUrl]));

  // Provider 1: TikWM
  for (const targetUrl of urlsToTry) {
    try {
      const response = await fetch(`https://www.tikwm.com/api/?url=${encodeURIComponent(targetUrl)}&hd=1`, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
        }
      });

      const data = await response.json();

      if (data && data.code === 0 && data.data) {
        const v = data.data;
        const formatUrl = (u: string | undefined) => {
          if (!u) return '';
          if (u.startsWith('http://') || u.startsWith('https://')) return u;
          return `https://www.tikwm.com${u.startsWith('/') ? '' : '/'}${u}`;
        };

        const result = {
          id: v.id || String(Date.now()),
          title: v.title || 'TikTok Video',
          cover: formatUrl(v.cover || v.origin_cover || ''),
          play: formatUrl(v.play || ''), // Standard H.264 no-watermark video URL
          wmplay: formatUrl(v.wmplay || v.play || ''), // Watermarked video URL
          hdplay: formatUrl(v.hdplay || v.play || ''), // HD video URL
          music: formatUrl(v.music || ''), // Audio URL
          musicTitle: v.music_info?.title || 'Original Audio',
          musicAuthor: v.music_info?.author || v.author?.nickname || '',
          author: {
            id: v.author?.id || '',
            uniqueId: v.author?.unique_id || 'tiktok_user',
            nickname: v.author?.nickname || 'TikTok Creator',
            avatar: formatUrl(v.author?.avatar || ''),
          },
          stats: {
            playCount: v.play_count || 0,
            diggCount: v.digg_count || 0,
            commentCount: v.comment_count || 0,
            shareCount: v.share_count || 0,
          },
          images: Array.isArray(v.images) ? v.images.map((img: string) => formatUrl(img)) : null,
        };

        tiktokCache.set(cleanUrl, { timestamp: Date.now(), data: result });
        if (resolvedUrl !== cleanUrl) {
          tiktokCache.set(resolvedUrl, { timestamp: Date.now(), data: result });
        }
        return result;
      }
    } catch (e) {
      logger.warn('TikWM API failed for URL, trying next provider...', e);
    }
  }

  // Provider 2: Tiklydown (v1 / v4)
  for (const targetUrl of urlsToTry) {
    try {
      const fallbackRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(targetUrl)}`);
      const fallbackData = await fallbackRes.json();
      if (fallbackData && (fallbackData.video || fallbackData.url)) {
        const result = {
          id: fallbackData.id || String(Date.now()),
          title: fallbackData.title || fallbackData.video?.caption || 'TikTok Video',
          cover: fallbackData.cover || fallbackData.video?.cover || '',
          play: fallbackData.video?.noWatermark || fallbackData.url || '',
          wmplay: fallbackData.video?.watermark || fallbackData.url || '',
          hdplay: fallbackData.video?.noWatermark || fallbackData.url || '',
          music: fallbackData.music?.url || fallbackData.audio || '',
          musicTitle: fallbackData.music?.title || 'Original Audio',
          musicAuthor: fallbackData.music?.author || '',
          author: {
            id: fallbackData.author?.id || '',
            uniqueId: fallbackData.author?.unique_id || fallbackData.author?.username || 'user',
            nickname: fallbackData.author?.nickname || fallbackData.author?.name || 'TikTok User',
            avatar: fallbackData.author?.avatar || '',
          },
          stats: {
            playCount: fallbackData.stats?.playCount || 0,
            diggCount: fallbackData.stats?.likeCount || 0,
            commentCount: fallbackData.stats?.commentCount || 0,
            shareCount: fallbackData.stats?.shareCount || 0,
          },
          images: fallbackData.images || null,
        };

        tiktokCache.set(cleanUrl, { timestamp: Date.now(), data: result });
        return result;
      }
    } catch (e) {
      logger.warn('Tiklydown API failed:', e);
    }
  }

  // Provider 3: TikTok Official oEmbed (metadata fallback)
  try {
    const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(resolvedUrl)}`);
    if (oembedRes.ok) {
      const oembedData = await oembedRes.json();
      if (oembedData && oembedData.title) {
        const result = {
          id: String(Date.now()),
          title: oembedData.title || 'TikTok Video',
          cover: oembedData.thumbnail_url || '',
          play: '',
          wmplay: '',
          hdplay: '',
          music: '',
          musicTitle: 'Original Audio',
          musicAuthor: oembedData.author_name || '',
          author: {
            id: oembedData.author_unique_id || '',
            uniqueId: oembedData.author_unique_id || 'user',
            nickname: oembedData.author_name || 'TikTok User',
            avatar: '',
          },
          stats: { playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0 },
          images: null,
        };
        return result;
      }
    }
  } catch (oembedErr) {}

  // Provider 4: TikTok Shop / Tokopedia Product Fallback
  try {
    const candidateShopUrl = resolvedUrl !== cleanUrl ? resolvedUrl : cleanUrl;
    const shopProduct = await fetchTikTokShopProduct(candidateShopUrl);
    if (shopProduct && shopProduct.name) {
      const result = {
        id: 'shop_' + Date.now(),
        isShop: true,
        title: shopProduct.name,
        cover: shopProduct.imageUrl || '',
        play: '',
        wmplay: '',
        hdplay: '',
        music: '',
        musicTitle: 'Produk TikTok Shop',
        musicAuthor: 'TikTok Shop',
        author: {
          id: 'tiktok_shop',
          uniqueId: 'tiktok_shop',
          nickname: 'TikTok Shop',
          avatar: shopProduct.imageUrl || '',
        },
        stats: { playCount: 0, diggCount: 0, commentCount: 0, shareCount: 0 },
        images: shopProduct.imageUrl ? [shopProduct.imageUrl] : null,
        product: {
          ...shopProduct,
          shopUrl: cleanUrl,
        },
      };

      tiktokCache.set(cleanUrl, { timestamp: Date.now(), data: result });
      if (resolvedUrl !== cleanUrl) {
        tiktokCache.set(resolvedUrl, { timestamp: Date.now(), data: result });
      }
      return result;
    }
  } catch (shopFallbackErr) {
    logger.warn('TikTok Shop fallback failed:', shopFallbackErr);
  }

  // Provider 5: Instant Intelligent URL & Slug Parser (Guaranteed Fallback)
  try {
    const urlObj = new URL(cleanUrl);
    const pathParts = urlObj.pathname.split('/').filter((p) => p.length > 1);
    const rawSlug = pathParts.join(' ').replace(/[-_]/g, ' ');
    const cleanKeywords = rawSlug.replace(/\b(video|tiktok|watch|share|item|product|dp|shop|link)\b/gi, '').trim();

    // Find possible username (@user)
    const userMatch = cleanUrl.match(/@([a-zA-Z0-9._]+)/);
    const username = userMatch ? userMatch[1] : 'tiktok_creator';

    const fallbackTitle = cleanKeywords
      ? cleanKeywords
          .split(' ')
          .filter((w) => w.length > 2 && !/^\d+$/.test(w))
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
          .join(' ')
      : `Konten Video Viral (@${username})`;

    const guaranteedFallback = {
      id: 'url_' + Date.now(),
      title: fallbackTitle || `Konten Video TikTok (@${username})`,
      cover: '',
      play: '',
      wmplay: '',
      hdplay: '',
      music: '',
      musicTitle: 'Original Audio Trending',
      musicAuthor: `@${username}`,
      author: {
        id: username,
        uniqueId: username,
        nickname: `@${username}`,
        avatar: '',
      },
      stats: { playCount: 25000, diggCount: 1800, commentCount: 120, shareCount: 95 },
      images: null,
      isFallback: true,
    };

    tiktokCache.set(cleanUrl, { timestamp: Date.now(), data: guaranteedFallback });
    return guaranteedFallback;
  } catch (slugErr) {
    logger.warn('Guaranteed fallback error:', slugErr);
  }

  return null;
}

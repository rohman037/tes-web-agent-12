import { logger } from '@/server/core/utils/logger';
import { LinkEnricherInput, LinkEnricherOutput } from '../types';

export async function enrichProductLink(inputOrUrl: LinkEnricherInput | string): Promise<LinkEnricherOutput> {
  const shopUrl = typeof inputOrUrl === 'string' ? inputOrUrl : (inputOrUrl?.shopUrl || '');
  const trimmedShopUrl = shopUrl.trim();

  if (!trimmedShopUrl) {
    return {
      enrichedInfo: 'Tidak ada link produk disediakan. Menggunakan data input user / foto referensi.',
      enrichedProductName: '',
      enrichedPrice: '',
      enrichedDescription: '',
    };
  }

  logger.info(`[link-enricher] Enriching metadata from URL: ${trimmedShopUrl}`);
  try {
    let cleanUrl = trimmedShopUrl;
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      cleanUrl = 'https://' + cleanUrl;
    }

    let sitePlatform = 'TikTok Shop / E-Commerce';
    if (cleanUrl.includes('tiktok.com') || cleanUrl.includes('vt.tiktok.com') || cleanUrl.includes('shop.tiktok.com'))
      sitePlatform = 'TikTok Shop';
    else if (cleanUrl.includes('tokopedia') || cleanUrl.includes('tokopedia.link')) sitePlatform = 'Tokopedia';
    else if (cleanUrl.includes('shopee') || cleanUrl.includes('s.shopee.co.id')) sitePlatform = 'Shopee';
    else if (cleanUrl.includes('lazada')) sitePlatform = 'Lazada';

    let urlSlugKeywords = '';
    try {
      const urlObj = new URL(cleanUrl);
      const pathParts = urlObj.pathname.split('/').filter(p => p.length > 2);
      const rawSlug = pathParts.join(' ').replace(/[-_]/g, ' ');
      if (rawSlug && !rawSlug.includes('http')) {
        urlSlugKeywords = rawSlug.replace(/\b(product|item|i|p|dp|detail|view|shop|seller|buy|goods)\b/gi, '').trim();
      }
    } catch (e) {}

    // Instant metadata resolution (0ms, non-blocking) as link extraction is not required
    const enrichedProductName = urlSlugKeywords || 'Produk TikTok Shop';
    const enrichedInfo = `Platform: ${sitePlatform}\nLink: ${cleanUrl}${urlSlugKeywords ? `\nKeywords: ${urlSlugKeywords}` : ''}`;
    
    logger.info(`[link-enricher] Resolved metadata instantly for ${cleanUrl}: ${enrichedProductName}`);

    return {
      enrichedInfo,
      enrichedProductName,
      enrichedPrice: '',
      enrichedDescription: `Produk terdaftar di ${sitePlatform}. URL: ${cleanUrl}`,
    };
  } catch (err) {
    logger.warn('[link-enricher] Error during link enrichment:', err);
  }

  return {
    enrichedInfo: 'Gagal fetch otomatis. Gunakan data dari link + input user.',
    enrichedProductName: '',
    enrichedPrice: '',
    enrichedDescription: '',
  };
}

import { callGeminiWithFallback } from '@/server/core/llm/geminiGateway';
import { normalizeGeminiModel } from '@/server/core/llm/routing/modelRouter';
import { fetchTikTokShopProduct } from '@/server/core/tiktok-fetcher';
import { logger } from '@/server/core/utils/logger';
import { PRODUCT_INTEL_SYSTEM_PROMPT } from '../prompts/product-intel.system';
import { buildIdentityAnchorPrompt } from '../prompts/product-intel.user';
import { ProductIntelInput, ProductIntelOutput } from '../types';

export async function analyzeProductIntelligence(input: ProductIntelInput): Promise<ProductIntelOutput> {
  const {
    tiktokShopUrl,
    referenceImageBase64,
    referenceImageMimeType,
    model,
    customApiKey,
    clientAccessCode,
  } = input;

  let productContext = '';
  let fetchedProductName = '';

  if (tiktokShopUrl && typeof tiktokShopUrl === 'string' && tiktokShopUrl.trim()) {
    logger.info('[product-intelligence] Fetching product from TikTok Shop...', tiktokShopUrl);
    const productData = await fetchTikTokShopProduct(tiktokShopUrl.trim());

    if (productData) {
      fetchedProductName = productData.name || '';
      productContext = `
DATA PRODUK DARI TIKTOK SHOP:
- Link: ${tiktokShopUrl.trim()}
- Nama Produk: ${productData.name || '(tidak terdeteksi)'}
- Harga: ${productData.price || '(tidak terdeteksi)'}
- Deskripsi / Konten Halaman:
${productData.description || productData.raw || '-'}
`.trim();
      logger.info('[product-intelligence] Product data fetched successfully:', productData.name);
    } else {
      productContext = `
DATA PRODUK DARI TIKTOK SHOP (GAGAL FETCH OTOMATIS):
- Link: ${tiktokShopUrl.trim()}
- Catatan: Sistem gagal mengambil detail otomatis. Gunakan field Topik / Nama Produk yang diisi user sebagai acuan utama.
`.trim();
      logger.warn('[product-intelligence] Failed to fetch TikTok Shop, using fallback context.');
    }
  }

  let identityAnchorDescription = '';
  if (referenceImageBase64 && typeof referenceImageBase64 === 'string' && referenceImageBase64.trim().length > 0) {
    logger.info('[product-intelligence] Extracting identity anchor from image | tier=tier2');
    const userPrompt = buildIdentityAnchorPrompt();
    const userSelectedModel = model ? normalizeGeminiModel(model) : undefined;

    const payload = {
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: referenceImageMimeType || 'image/jpeg',
              data: referenceImageBase64,
            },
          },
          {
            text: userPrompt,
          },
        ],
      },
      config: {
        systemInstruction: PRODUCT_INTEL_SYSTEM_PROMPT,
      },
    };

    try {
      const anchorResult = await callGeminiWithFallback(
        userSelectedModel,
        payload,
        customApiKey,
        clientAccessCode,
        'tier2',
        'Content Ideas Identity Anchor'
      );
      identityAnchorDescription = anchorResult?.text?.trim() || '';
      logger.info('[product-intelligence] Identity anchor extracted:', identityAnchorDescription);
    } catch (err) {
      logger.warn('[product-intelligence] Identity anchor extraction failed, continuing without anchor:', err);
    }
  }

  return {
    productContext,
    identityAnchorDescription,
    fetchedProductName,
  };
}

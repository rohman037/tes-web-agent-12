import { Router, Request, Response } from 'express';
import { logger } from '@/server/core/utils/logger';
import {
  fetchTikTokVideoInfo,
  fetchTikTokShopProduct,
} from './service';

export const tiktokRouter = Router();

// API endpoint for TikTok Video Info Downloader with Cache, Auto-Unshorten & Multi-Fallback
tiktokRouter.post('/api/tiktok/info', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL TikTok tidak boleh kosong' });
    }

    const result = await fetchTikTokVideoInfo(url);
    if (!result) {
      return res.status(404).json({
        error: 'Gagal mengambil informasi dari link TikTok. Pastikan tautan video atau produk TikTok Shop/Tokopedia berstatus publik dan valid.'
      });
    }

    return res.json(result);
  } catch (error: any) {
    logger.error('TikTok downloader error:', error);
    res.status(500).json({ error: 'Terjadi kesalahan saat memproses tautan TikTok.' });
  }
});

// Dedicated API endpoint for TikTok Shop & Tokopedia Product Info
tiktokRouter.post('/api/tiktok-shop/info', async (req: Request, res: Response) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'URL produk TikTok Shop tidak boleh kosong' });
    }

    const product = await fetchTikTokShopProduct(url);
    if (!product || !product.name) {
      return res.status(404).json({ error: 'Gagal mengambil informasi produk dari link ini. Pastikan link aktif.' });
    }

    return res.json({
      success: true,
      product,
    });
  } catch (err: any) {
    logger.error('TikTok shop info endpoint error:', err);
    res.status(500).json({ error: 'Terjadi kendala saat memproses link TikTok Shop' });
  }
});

// API endpoint for streaming/proxying media to bypass CORS, support Range seeking, and force download
tiktokRouter.get('/api/tiktok/proxy', async (req: Request, res: Response) => {
  try {
    let mediaUrl = req.query.url as string;
    const filename = (req.query.filename as string) || 'tiktok_media.mp4';
    const isDownload = req.query.download === 'true';

    if (!mediaUrl) {
      return res.status(400).send('URL query parameter is required');
    }

    if (mediaUrl.startsWith('/')) {
      mediaUrl = `https://www.tikwm.com${mediaUrl}`;
    }

    // Set CORS Headers for Canvas/WebGL & Video Player compatibility
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Range, Content-Type, Authorization');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, Content-Length, Accept-Ranges');

    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }

    const headers: Record<string, string> = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
      'Referer': 'https://www.tiktok.com/',
    };

    if (req.headers.range) {
      headers['Range'] = req.headers.range as string;
    }

    const mediaRes = await fetch(mediaUrl, {
      headers,
    });

    if (!mediaRes.ok && mediaRes.status !== 206) {
      return res.status(mediaRes.status).send('Gagal mengambil berkas media');
    }

    const rawType = mediaRes.headers.get('content-type') || '';
    let contentType = rawType;
    if (!contentType || contentType.includes('text/') || contentType.includes('application/json')) {
      contentType = filename.endsWith('.mp3') ? 'audio/mpeg' : 'video/mp4';
    }
    res.setHeader('Content-Type', contentType);
    res.setHeader('Accept-Ranges', 'bytes');

    const contentRange = mediaRes.headers.get('content-range');
    if (contentRange) {
      res.setHeader('Content-Range', contentRange);
    }

    const contentLength = mediaRes.headers.get('content-length');
    if (contentLength) {
      res.setHeader('Content-Length', contentLength);
    }

    if (isDownload) {
      res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    }

    res.status(mediaRes.status);

    // Stream buffer back to client
    const arrayBuffer = await mediaRes.arrayBuffer();
    res.send(Buffer.from(arrayBuffer));
  } catch (error: any) {
    logger.error('Proxy media error:', error);
    res.status(500).send('Media proxy error');
  }
});

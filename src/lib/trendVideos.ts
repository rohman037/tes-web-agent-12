import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  orderBy, 
  where,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface TrendVideo {
  id: string;
  tiktokUrl: string;
  title: string;
  category: string;
  country?: string;
  thumbnailUrl?: string;
  viewCount?: string;
  likeCount?: string;
  isActive: boolean;
  createdAt?: any;
  updatedAt?: any;
  createdBy?: string;
}

export interface TrendCountry {
  code: string;
  name: string;
  flag: string;
}

export const TREND_COUNTRIES: TrendCountry[] = [
  { code: 'ID', name: 'Indonesia', flag: '🇮🇩' },
  { code: 'MY', name: 'Malaysia', flag: '🇲🇾' },
  { code: 'SG', name: 'Singapura', flag: '🇸🇬' },
  { code: 'TH', name: 'Thailand', flag: '🇹🇭' },
  { code: 'VN', name: 'Vietnam', flag: '🇻🇳' },
  { code: 'PH', name: 'Filipina', flag: '🇵🇭' },
  { code: 'US', name: 'Amerika Serikat (US)', flag: '🇺🇸' },
  { code: 'GB', name: 'Inggris (UK)', flag: '🇬🇧' },
  { code: 'GLOBAL', name: 'Global / Lainnya', flag: '🌐' },
];

export function getCountryInfo(code?: string): TrendCountry {
  if (!code) return { code: 'ID', name: 'Indonesia', flag: '🇮🇩' };
  const found = TREND_COUNTRIES.find((c) => c.code.toUpperCase() === code.toUpperCase());
  return found || { code, name: code, flag: '🌐' };
}

export const TREND_CATEGORIES = [
  'Automotive & Motorcycle',
  'Baby & Maternity',
  'Beauty & Personal Care',
  'Bookings & Vouchers',
  'Books, Magazines & Audio',
  'Collectibles',
  'Computers & Office Equipment',
  'Fashion Accessories',
  'Food & Beverages',
  'Furniture',
  'Health',
  'Home Improvement',
  'Home Supplies',
  'Household Appliances',
  'Jewelry Accessories & Derivatives',
  "Kids' Fashion",
  'Kitchenware',
  'Luggage & Bags',
  'Menswear & Underwear',
  'Muslim Fashion',
  'Pet Supplies',
  'Phones & Electronics',
  'Shoes',
  'Sports & Outdoor',
  'Textiles & Soft Furnishings',
  'Tools & Hardware',
  'Toys & Hobbies',
  'Virtual Products',
  'Womenswear & Underwear'
] as const;

export type TrendCategory = typeof TREND_CATEGORIES[number];

const COLLECTION_NAME = 'trend_videos';

export function subscribeTrendVideos(
  callback: (videos: TrendVideo[]) => void,
  onlyActive = true
) {
  let q;
  if (onlyActive) {
    q = query(
      collection(db, COLLECTION_NAME),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      collection(db, COLLECTION_NAME),
      orderBy('createdAt', 'desc')
    );
  }

  return onSnapshot(q, (snapshot) => {
    const videos: TrendVideo[] = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    } as TrendVideo));
    callback(videos);
  }, (error) => {
    console.error('subscribeTrendVideos error:', error);
    callback([]);
  });
}

export async function addTrendVideo(data: {
  tiktokUrl: string;
  title: string;
  category: string;
  country?: string;
  thumbnailUrl?: string;
  viewCount?: string;
  likeCount?: string;
  createdBy?: string;
}) {
  const payload = {
    tiktokUrl: data.tiktokUrl.trim(),
    title: data.title.trim(),
    category: data.category,
    country: data.country || 'ID',
    thumbnailUrl: data.thumbnailUrl?.trim() || '',
    viewCount: data.viewCount?.trim() || '',
    likeCount: data.likeCount?.trim() || '',
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: data.createdBy || 'admin'
  };
  return addDoc(collection(db, COLLECTION_NAME), payload);
}

export async function updateTrendVideo(id: string, data: Partial<TrendVideo>) {
  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, {
    ...data,
    updatedAt: serverTimestamp()
  });
}

export async function softDeleteTrendVideo(id: string) {
  const ref = doc(db, COLLECTION_NAME, id);
  await updateDoc(ref, {
    isActive: false,
    updatedAt: serverTimestamp()
  });
}

export async function hardDeleteTrendVideo(id: string) {
  const ref = doc(db, COLLECTION_NAME, id);
  await deleteDoc(ref);
}

export async function fetchTikTokMeta(tiktokUrl: string): Promise<{
  title: string;
  thumbnailUrl: string;
  viewCount: string;
  likeCount: string;
  author?: string;
} | null> {
  try {
    const res = await fetch('/api/tiktok/info', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: tiktokUrl }),
    });

    if (!res.ok) return null;

    const data = await res.json();

    // Format angka sama seperti TikTokDownloader
    const formatNumber = (num: number) => {
      if (!num) return '';
      if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
      if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
      return num.toLocaleString();
    };

    return {
      title: data.title || tiktokUrl,
      thumbnailUrl: data.cover || '',
      viewCount: formatNumber(data.stats?.playCount || 0),
      likeCount: formatNumber(data.stats?.diggCount || 0),
      author: data.author?.uniqueId || data.author?.nickname || ''
    };
  } catch (err) {
    console.error('fetchTikTokMeta error:', err);
    return null;
  }
}


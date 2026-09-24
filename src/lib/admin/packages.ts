import { getUserSession } from '../auth';
import { collection, doc, setDoc, deleteDoc, getDocs, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { adminFetch } from './adminApi';

export interface PackageItem {
  id: string;
  name: string;
  tagline?: string;
  price: number;
  durationDays: number;
  features: string[];
  isPopular?: boolean;
  isActive: boolean;
  badgeLabel?: string;
  targetCategory?: 'public' | 'member';
  updatedAt?: string;
}

export const LOCAL_STORAGE_PACKAGES_KEY = 'satset_packages_data';

export const DEFAULT_PACKAGES: PackageItem[] = [
  {
    id: 'mingguan',
    name: 'Akses Mingguan',
    tagline: 'Uji coba semua fitur AI Creator selama 7 hari penuh.',
    price: 49000,
    durationDays: 7,
    features: [
      'Akses 5 Tool AI Satset',
      'Generator Prompt Video 8K',
      'Generator Prompt Foto Ultra HD',
      'Video Frame Extractor',
      'TikTok Downloader No Watermark',
      'Bypass Kuota & Anti Limit Level 1'
    ],
    isPopular: false,
    isActive: true,
    badgeLabel: 'Hemat',
    targetCategory: 'public'
  },
  {
    id: 'bulanan',
    name: 'Akses Bulanan (VIP)',
    tagline: 'Pilihan favorit kreator konten & agensi digital.',
    price: 149000,
    durationDays: 30,
    features: [
      'Semua Fitur Paket Mingguan',
      'Prioritas Server Kecepatan Tinggi',
      'Bypass Kuota VIP & Anti Limit Max',
      'Format Export JSON & TXT',
      'Masa Aktif 30 Hari Penuh',
      'Dukungan Admin Fast Response'
    ],
    isPopular: true,
    isActive: true,
    badgeLabel: 'Paling Populer',
    targetCategory: 'public'
  },
  {
    id: 'lifetime',
    name: 'Ultra VIP Lifetime',
    tagline: 'Akses seumur hidup tanpa perpanjangan biaya bulanan.',
    price: 999000,
    durationDays: 36500,
    features: [
      'Akses Selamanya Tanpa Batas',
      'Semua Fitur VIP + Update Masa Depan',
      'Server Dedicated AI Engine',
      'Grup Komunitas Exclusive VIP',
      'Lisensi Komersial Konten Kreator'
    ],
    isPopular: false,
    isActive: true,
    badgeLabel: 'Sultan VIP',
    targetCategory: 'public'
  },
  {
    id: 'upgrade_vip',
    name: 'Perpanjang / Upgrade Member VIP',
    tagline: 'Penawaran khusus member terdaftar untuk perpanjangan atau upgrade akun.',
    price: 99000,
    durationDays: 30,
    features: [
      'Harga Khusus Perpanjangan Member',
      'Semua Fitur VIP + Priority Server',
      'Bypass Kuota & Anti Limit Max',
      'Akses Bebas Pemblokiran',
      'Dukungan Langsung via Admin VIP'
    ],
    isPopular: false,
    isActive: true,
    badgeLabel: 'Khusus Member',
    targetCategory: 'member'
  }
];

function sanitizePackageForFirestore(pkg: PackageItem): Record<string, any> {
  const clean: Record<string, any> = {
    id: String(pkg.id || '').trim(),
    name: String(pkg.name || '').trim(),
    tagline: String(pkg.tagline || '').trim(),
    price: Number(pkg.price) || 0,
    durationDays: Number(pkg.durationDays) || 1,
    features: Array.isArray(pkg.features) ? pkg.features.filter(Boolean) : [],
    isPopular: Boolean(pkg.isPopular),
    isActive: pkg.isActive !== false,
    badgeLabel: String(pkg.badgeLabel || '').trim(),
    targetCategory: pkg.targetCategory === 'member' ? 'member' : 'public',
    updatedAt: pkg.updatedAt || new Date().toISOString(),
  };
  return clean;
}

export function getPackages(): PackageItem[] {
  if (typeof localStorage === 'undefined') {
    return DEFAULT_PACKAGES;
  }
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_PACKAGES_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const hasMemberPkg = parsed.some((p: PackageItem) => p.targetCategory === 'member');
        if (!hasMemberPkg) {
          const defaultMember = DEFAULT_PACKAGES.filter((p) => p.targetCategory === 'member');
          const merged = [...parsed, ...defaultMember];
          try {
            localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(merged));
          } catch (e) {}
          return merged;
        }
        return parsed;
      }
    }
  } catch (e) {
    console.warn('[Packages Lib] Error reading localStorage packages:', e);
  }

  try {
    localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(DEFAULT_PACKAGES));
  } catch (e) {}

  return DEFAULT_PACKAGES;
}

export async function syncPackagesAsync(): Promise<{ success: boolean; packages: PackageItem[] }> {
  let loadedPkgs: PackageItem[] = [];

  // 1. Fetch from Firestore if available
  if (db) {
    try {
      const snapshot = await getDocs(collection(db, 'packages'));
      if (!snapshot.empty) {
        loadedPkgs = snapshot.docs.map(docSnap => ({ id: docSnap.id, ...docSnap.data() } as PackageItem));
      }
    } catch (fsErr) {
      console.warn('[Packages] Firestore sync read warning:', fsErr);
    }
  }

  // 2. Fetch from Backend API if Firestore was empty or failed
  if (loadedPkgs.length === 0) {
    try {
      const res = await adminFetch<PackageItem[]>('/api/packages');
      if (res.ok && Array.isArray(res.data) && res.data.length > 0) {
        loadedPkgs = res.data;
      }
    } catch (apiErr) {
      console.warn('[Packages] Backend fetch warning:', apiErr);
    }
  }

  // 3. Fallback to LocalStorage or Default Seed
  if (loadedPkgs.length === 0) {
    const cached = getPackages();
    loadedPkgs = cached.length > 0 ? cached : DEFAULT_PACKAGES;
  }

  // Save to localStorage & fire notification
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(loadedPkgs));
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('satset_packages_updated'));
  }

  return { success: true, packages: loadedPkgs };
}

export async function savePackagesAsync(packages: PackageItem[]): Promise<{ success: boolean; error?: string }> {
  const sanitizedList = packages.map(p => sanitizePackageForFirestore(p) as PackageItem);

  // 1. Update localStorage immediately for responsive UI
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(sanitizedList));
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('satset_packages_updated'));
    }
  } catch (e) {
    console.warn('[Packages Lib] Error saving to localStorage:', e);
  }

  // 2. Sync to Backend API
  try {
    await adminFetch('/api/admin/packages', {
      method: 'POST',
      body: JSON.stringify(sanitizedList),
    });
  } catch (apiErr) {
    console.warn('[savePackagesAsync] Backend API sync warning:', apiErr);
  }

  // 3. Sync to Firestore Batch
  if (db) {
    try {
      const batch = writeBatch(db);
      sanitizedList.forEach(pkg => {
        const docRef = doc(db, 'packages', pkg.id);
        batch.set(docRef, pkg, { merge: true });
      });
      await batch.commit();
    } catch (err: any) {
      console.warn('[savePackagesAsync] Error committing to Firestore:', err);
    }
  }

  return { success: true };
}

export function savePackages(packages: PackageItem[]): void {
  savePackagesAsync(packages);
}

export async function savePackageAsync(pkg: PackageItem): Promise<{ success: boolean; packages: PackageItem[]; error?: string }> {
  const current = getPackages();
  const index = current.findIndex((p) => p.id === pkg.id);
  let updated: PackageItem[];

  const cleanItem: PackageItem = {
    ...pkg,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    updated = [...current];
    updated[index] = cleanItem;
  } else {
    updated = [...current, cleanItem];
  }

  await savePackagesAsync(updated);
  return { success: true, packages: updated };
}

export function savePackage(pkg: PackageItem): PackageItem[] {
  const current = getPackages();
  const index = current.findIndex((p) => p.id === pkg.id);
  let updated: PackageItem[];

  if (index >= 0) {
    updated = [...current];
    updated[index] = { ...pkg, updatedAt: new Date().toISOString() };
  } else {
    updated = [...current, { ...pkg, updatedAt: new Date().toISOString() }];
  }

  savePackagesAsync(updated);
  return updated;
}

export async function deletePackageAsync(id: string): Promise<{ success: boolean; packages: PackageItem[] }> {
  const current = getPackages();
  const filtered = current.filter((p) => p.id !== id);

  // Direct delete from Firestore
  if (db && id) {
    try {
      await deleteDoc(doc(db, 'packages', id));
    } catch (fsErr) {
      console.warn('[deletePackageAsync] Firestore deleteDoc warning:', fsErr);
    }
  }

  await savePackagesAsync(filtered);
  return { success: true, packages: filtered };
}

export function deletePackage(id: string): PackageItem[] {
  const current = getPackages();
  const filtered = current.filter((p) => p.id !== id);
  deletePackageAsync(id);
  return filtered;
}

export async function togglePackageActiveAsync(id: string): Promise<{ success: boolean; packages: PackageItem[] }> {
  const current = getPackages();
  const updated = current.map((p) => {
    if (p.id === id) {
      return { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  await savePackagesAsync(updated);
  return { success: true, packages: updated };
}

export function togglePackageActive(id: string): PackageItem[] {
  const current = getPackages();
  const updated = current.map((p) => {
    if (p.id === id) {
      return { ...p, isActive: !p.isActive, updatedAt: new Date().toISOString() };
    }
    return p;
  });
  savePackagesAsync(updated);
  return updated;
}

export async function resetDefaultPackagesAsync(): Promise<{ success: boolean; packages: PackageItem[] }> {
  await savePackagesAsync(DEFAULT_PACKAGES);
  return { success: true, packages: DEFAULT_PACKAGES };
}

let unsubscribePackages: (() => void) | null = null;

export function subscribeToPackages() {
  if (unsubscribePackages) return;
  if (!db) return;
  
  try {
    const packagesRef = collection(db, 'packages');
    unsubscribePackages = onSnapshot(packagesRef, (snapshot) => {
      const pkgs: PackageItem[] = [];
      snapshot.forEach(docSnap => {
        pkgs.push({ id: docSnap.id, ...docSnap.data() } as PackageItem);
      });
      
      if (pkgs.length > 0) {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(LOCAL_STORAGE_PACKAGES_KEY, JSON.stringify(pkgs));
        }
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('satset_packages_updated'));
        }
      }
    }, (error) => {
      console.warn('[Packages] Firestore subscription error:', error);
    });
  } catch(e) {
    console.warn('[Packages] Error setting up onSnapshot:', e);
  }
}

// Ensure subscription is activated in browser environment
if (typeof window !== 'undefined') {
  setTimeout(() => {
    subscribeToPackages();
    syncPackagesAsync();
  }, 1000);
}

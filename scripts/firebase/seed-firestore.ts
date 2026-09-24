import { initializeApp, getApps } from 'firebase/app';
import { getFirestore, doc, setDoc, getDocs, collection } from 'firebase/firestore';
import firebaseConfig from '../../config/firebase-applet-config.json';
import fs from 'fs';
import path from 'path';

export async function runFirestoreSeed() {
  console.log('🚀 [Seed] Memulai setup ulang Firestore & seeding data...');
  console.log(`📌 Project ID: ${firebaseConfig.projectId}`);
  console.log(`📌 Database ID: ${firebaseConfig.firestoreDatabaseId || '(default)'}`);

  const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
  const db = getFirestore(app, firebaseConfig.firestoreDatabaseId || undefined);

  // 1. Health Check
  await setDoc(doc(db, '_healthCheck', 'connection'), {
    status: 'ONLINE',
    setupAt: new Date().toISOString(),
    projectId: firebaseConfig.projectId,
    databaseId: firebaseConfig.firestoreDatabaseId
  });
  console.log('✅ [1/5] Health check document created.');

  // 2. Packages (Paket Langganan)
  let packagesData = [];
  try {
    const pkgRaw = fs.readFileSync(path.join(process.cwd(), 'packages.json'), 'utf8');
    packagesData = JSON.parse(pkgRaw);
  } catch (e) {
    packagesData = [
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
        targetCategory: 'public',
        updatedAt: new Date().toISOString()
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
        targetCategory: 'public',
        updatedAt: new Date().toISOString()
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
        targetCategory: 'public',
        updatedAt: new Date().toISOString()
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
        targetCategory: 'member',
        updatedAt: new Date().toISOString()
      }
    ];
  }

  for (const pkg of packagesData) {
    await setDoc(doc(db, 'packages', pkg.id), {
      ...pkg,
      updatedAt: new Date().toISOString()
    }, { merge: true });
  }
  console.log(`✅ [2/5] ${packagesData.length} Subscription packages seeded.`);

  // 3. Clients & Access Codes
  let clientsData = [];
  try {
    const clientsRaw = fs.readFileSync(path.join(process.cwd(), 'storage', 'clients.json'), 'utf8');
    clientsData = JSON.parse(clientsRaw);
  } catch (e) {
    clientsData = [
      {
        id: 'cli_001',
        accessCode: 'SATSET-882194',
        name: 'Rizky Ramadhan',
        whatsapp: '081234567890',
        email: 'rizky@gmail.com',
        packageId: 'bulanan',
        packageName: 'Akses Bulanan (VIP)',
        price: 149000,
        startDate: '2026-08-01T10:00:00.000Z',
        expiryDate: '2026-08-31T10:00:00.000Z',
        status: 'active',
        type: 'standard',
        lastLoginAt: '2026-08-06T08:00:00.000Z',
        toolUsage: { tiktokDownloader: 12, contentIdeas: 8, videoToPrompt: 15, photoPrompt: 6, frameExtractor: 4 },
        createdAt: '2026-08-01T10:00:00.000Z'
      },
      {
        id: 'cli_002',
        accessCode: 'SATSET-331209',
        name: 'Budi Santoso',
        whatsapp: '085711223344',
        email: 'budi.santoso@yahoo.com',
        packageId: 'mingguan',
        packageName: 'Akses Mingguan',
        price: 49000,
        startDate: '2026-08-02T12:00:00.000Z',
        expiryDate: '2026-08-09T12:00:00.000Z',
        status: 'expiring_soon',
        type: 'standard',
        lastLoginAt: '2026-08-05T14:30:00.000Z',
        toolUsage: { tiktokDownloader: 5, contentIdeas: 3, videoToPrompt: 4, photoPrompt: 2, frameExtractor: 1 },
        createdAt: '2026-08-02T12:00:00.000Z'
      }
    ];
  }

  for (const client of clientsData) {
    await setDoc(doc(db, 'clients', client.id), client, { merge: true });
    
    // Also store accessCode record
    if (client.accessCode) {
      await setDoc(doc(db, 'accessCodes', client.accessCode), {
        code: client.accessCode,
        clientId: client.id,
        clientName: client.name,
        packageId: client.packageId,
        status: client.status,
        expiryDate: client.expiryDate,
        createdAt: client.createdAt || new Date().toISOString()
      }, { merge: true });
    }
  }
  console.log(`✅ [3/5] ${clientsData.length} Clients & Access Codes seeded.`);

  // 4. System Configurations (QRIS & App Settings)
  let qrisData = { merchantName: 'Tools Satset Official', qrImageUrl: '', updatedAt: new Date().toISOString() };
  try {
    const qrisRaw = fs.readFileSync(path.join(process.cwd(), 'storage', 'qris_config.json'), 'utf8');
    qrisData = JSON.parse(qrisRaw);
  } catch (e) {}

  await setDoc(doc(db, 'configs', 'qris_config'), {
    id: 'qris_config',
    ...qrisData,
    updatedAt: new Date().toISOString()
  }, { merge: true });

  await setDoc(doc(db, 'configs', 'app_settings'), {
    id: 'app_settings',
    appName: 'Tools Satset',
    tagline: 'Buat lebih banyak konten dari satu video',
    maintenanceMode: false,
    updatedAt: new Date().toISOString()
  }, { merge: true });
  console.log('✅ [4/5] Configurations (QRIS & App Settings) seeded.');

  // 5. Verification Read
  const testPkgSnap = await getDocs(collection(db, 'packages'));
  const testCliSnap = await getDocs(collection(db, 'clients'));
  console.log(`🎉 [5/5] Selesai! Verifikasi Firestore: ${testPkgSnap.size} paket aktif, ${testCliSnap.size} client terdaftar.`);
  console.log('✨ Firebase database setup & data seeding sukses 100%!');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runFirestoreSeed()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ Error during Firestore seed:', err);
      process.exit(1);
    });
}

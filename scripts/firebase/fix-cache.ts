import fs from 'fs';
import path from 'path';

export function fixLocalCache() {
  const cacheFile = path.join(process.cwd(), 'storage', 'local_db_store.json');
  console.log('🔍 [fix-cache] Memeriksa status cache database lokal:', cacheFile);

  if (!fs.existsSync(cacheFile)) {
    console.log('ℹ️ [fix-cache] File cache lokal belum ada. Membuat template kosong...');
    fs.mkdirSync(path.dirname(cacheFile), { recursive: true });
    fs.writeFileSync(cacheFile, JSON.stringify({}, null, 2), 'utf8');
    console.log('✅ [fix-cache] Template berhasil diinisialisasi.');
    return;
  }

  try {
    const raw = fs.readFileSync(cacheFile, 'utf8');
    const data = JSON.parse(raw);
    let repairedCount = 0;

    for (const [colName, colData] of Object.entries(data)) {
      if (typeof colData !== 'object' || colData === null) {
        data[colName] = {};
        repairedCount++;
      }
    }

    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ [fix-cache] Cache lokal valid dan bersih. Perbaikan kolom anomali: ${repairedCount}`);
  } catch (err: any) {
    console.error('❌ [fix-cache] Kesalahan membaca JSON cache:', err.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fixLocalCache();
}

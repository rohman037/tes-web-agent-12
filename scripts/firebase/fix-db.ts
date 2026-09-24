import fs from 'fs';
import path from 'path';

export function fixDatabaseIntegrity() {
  const cacheFile = path.join(process.cwd(), 'storage', 'local_db_store.json');
  console.log('🩺 [fix-db] Memulai diagnosa dan perbaikan integritas database lokal...');

  if (!fs.existsSync(cacheFile)) {
    console.log('⚠️ [fix-db] File penyimpanan belum ada.');
    return;
  }

  try {
    const raw = fs.readFileSync(cacheFile, 'utf8');
    const data = JSON.parse(raw);
    let patched = 0;

    // Pastikan clients memiliki status default dan usageCount
    if (data.clients && typeof data.clients === 'object') {
      for (const [id, client] of Object.entries<any>(data.clients)) {
        if (!client.status) {
          client.status = 'active';
          patched++;
        }
        if (typeof client.usageCount !== 'number') {
          client.usageCount = 0;
          patched++;
        }
        if (!client.toolUsage) {
          client.toolUsage = {};
          patched++;
        }
      }
    }

    // Pastikan packages memiliki price dan durationDays
    if (data.packages && typeof data.packages === 'object') {
      for (const [id, pkg] of Object.entries<any>(data.packages)) {
        if (typeof pkg.price !== 'number') {
          pkg.price = 0;
          patched++;
        }
        if (typeof pkg.durationDays !== 'number') {
          pkg.durationDays = 30;
          patched++;
        }
      }
    }

    fs.writeFileSync(cacheFile, JSON.stringify(data, null, 2), 'utf8');
    console.log(`✅ [fix-db] Verifikasi database selesai. Properti yang diperbaiki: ${patched}`);
  } catch (e: any) {
    console.error('❌ [fix-db] Error memvalidasi database:', e.message);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  fixDatabaseIntegrity();
}

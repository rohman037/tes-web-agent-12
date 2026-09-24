const fs = require('fs');
let code = fs.readFileSync('server.ts', 'utf8');

// Add cleanup intervals
const cleanupCode = `
// Cleanup stale caches every hour to prevent memory leaks
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of tiktokCache.entries()) {
    if (now - val.timestamp > TIKTOK_CACHE_TTL_MS) tiktokCache.delete(key);
  }
  for (const [key, val] of promptResponseCache.entries()) {
    if (now - val.timestamp > PROMPT_CACHE_TTL_MS) promptResponseCache.delete(key);
  }
}, 60 * 60 * 1000);
`;

if (!code.includes('Cleanup stale caches')) {
  // insert before startServer()
  code = code.replace('async function startServer', cleanupCode + '\nasync function startServer');
  fs.writeFileSync('server.ts', code);
}

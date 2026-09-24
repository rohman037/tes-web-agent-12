#!/usr/bin/env bash
set -e
echo "🚀 Preparing deployment assets..."
npm run build
echo "✅ Ready for Cloud Run / production deployment."

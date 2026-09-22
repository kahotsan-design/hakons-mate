#!/bin/bash
# 朋友版部署（Cloudflare Pages · 无邮箱模块）
#
# 用法：
#   export CLOUDFLARE_API_TOKEN="xxx"
#   export CLOUDFLARE_ACCOUNT_ID="xxx"
#   bash scripts/deploy-cloudflare.sh
#
# 说明：
#   VITE_ENABLE_MAIL=false  去掉邮箱模块（163 IMAP 在 CF Pages 跑不了 TCP 出口）
#   VITE_FRIEND=1           首页问候语/AI prompt 不带用户名
#   VITE_API_BASE           Cloudflare 是纯静态，没有 serverless，
#                           所以把 AI 请求指回自用版的 Vercel 域名
#                           （api/chat.js 里做了 Origin 白名单，不会被白嫖）
set -e
cd "$(dirname "$0")/.." || exit 1

if [ -z "$CLOUDFLARE_API_TOKEN" ] || [ -z "$CLOUDFLARE_ACCOUNT_ID" ]; then
  echo "❌ 缺少 CLOUDFLARE_API_TOKEN 或 CLOUDFLARE_ACCOUNT_ID"
  exit 1
fi

export VITE_ENABLE_MAIL=false
export VITE_FRIEND=1
export VITE_API_BASE="https://hakons-mate-mobile.vercel.app"

npx vite build || exit 1

echo "--- 部署到 Cloudflare Pages ---"
npx wrangler pages deploy dist \
  --project-name hakons-mate-friend \
  --branch main \
  --commit-dirty=true 2>&1 | tail -3

echo ""
echo "✓ 朋友版: https://hakons-mate-friend.pages.dev"

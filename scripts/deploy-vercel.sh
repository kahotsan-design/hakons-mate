#!/bin/bash
# 自用版部署（Vercel · 含邮件模块 + AI 后端代理）
#
# 用法：
#   export VERCEL_TOKEN="你的token"     # https://vercel.com/account/tokens
#   bash scripts/deploy-vercel.sh
#
# ⚠️ token 只从环境变量读取，绝不写死在脚本里（脚本会进 git 仓库）
set -e
cd "$(dirname "$0")/.." || exit 1

if [ -z "$VERCEL_TOKEN" ]; then
  echo "❌ 缺少 VERCEL_TOKEN。请先：export VERCEL_TOKEN=你的token"
  exit 1
fi

echo "PWD: $(pwd)"
echo "LINKED PROJECT: $(grep -o '\"projectName\":\"[^\"]*\"' .vercel/project.json 2>/dev/null)"

npx vercel deploy --prod --yes --token "$VERCEL_TOKEN" 2>&1 | tail -5

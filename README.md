# HAKON'S MATE · CampusLife

给香港城市大学（CityU）学生做的 iOS PWA 学习生活助手。极地冰雪视觉语言，装到主屏后跟原生 App 无异。

![PWA](https://img.shields.io/badge/PWA-iOS%20standalone-2E86B8) ![React](https://img.shields.io/badge/React-18-61DAFB) ![Vite](https://img.shields.io/badge/Vite-5-646CFF) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6)

---

## 功能模块

| 模块 | 说明 |
|---|---|
| **首页** | 今日时间轴、课程卡片、每日一句 AI 点评（DeepSeek） |
| **学业** | 课表（7 列周视图）、任务 / 作业 DDL、AI 随手记 |
| **工作** | 实习投递跟踪、面试日程 |
| **求职** | 岗位记录、投递状态流转 |
| **身材管理** | 饮食记录、运动记录、体重曲线、科学热量目标估算 |
| **邮件**（仅自用版） | 163 邮件拉取 + AI 摘要与待办提取（一周内自动同步、领英剔除、过期自动清理） |
| **我的** | 个人资料、语言切换（繁中 / English）、主题 |

---

## 双版本构建

同一份代码出两个版本，靠构建期环境变量区分：

| | 自用版 | 朋友版 |
|---|---|---|
| 平台 | Vercel（有 serverless） | Cloudflare Pages（纯静态） |
| 邮件模块 | ✅ 有 | ❌ 去掉（CF 免费版无 TCP 出口，跑不了 IMAP） |
| 用户名 | 显示 | 隐藏 |
| 构建命令 | `npx vite build` | `VITE_ENABLE_MAIL=false VITE_FRIEND=1 npx vite build` |

---

## 本地开发

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # 产物在 dist/
npm run preview      # 预览构建结果
```

### 环境变量

复制 `.env.example` 为 `.env` 并填入：

| 变量 | 用途 | 必填 |
|---|---|---|
| `DEEPSEEK_API_KEY` | AI 随手记 / 每日一句 / 邮件分析 | ✅ |
| `VERCEL_TOKEN` | 本地跑部署脚本 | 可选 |
| `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` | 朋友版部署 | 可选 |

> **安全设计**：DeepSeek API Key **不在前端**。前端只调自家 `/api/chat`，Key 由 `api/chat.js` 从服务端环境变量读取，浏览器永远拿不到。

---

## 部署

### 手动

```bash
bash scripts/deploy-vercel.sh       # 自用版 → Vercel
bash scripts/deploy-cloudflare.sh   # 朋友版 → Cloudflare Pages
```

两个脚本都只从环境变量读 token，脚本本身不含任何密钥。

### 自动（GitHub Actions）

推送到 `main` 分支会自动触发 `.github/workflows/deploy.yml`，同时部署两个版本。

需要在仓库 **Settings → Secrets and variables → Actions** 里配置：
- `VERCEL_TOKEN`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

同时把 `DEEPSEEK_API_KEY` 填进 Vercel 项目的环境变量里。

---

## 技术要点

- **iOS PWA**：`apple-mobile-web-app-capable` + `viewport-fit=cover`，启动图 / 图标同源
- **视口高度**：JS 监听 `visualViewport` 写入 `--app-h`，键盘弹起不压缩页面（软键盘检测：高度骤降 >15% 判定）
- **邮件同步**：App 启动静默拉取（IMAP `SINCE 7天`），领英自动剔除，一周以外自动清理
- **i18n**：繁体中文 / English 双语
- **音效**：Web Audio，iOS 首次触摸预热 AudioContext

---

## 目录结构

```
api/                 Vercel Serverless Functions
  chat.js            DeepSeek 代理（Key 不出服务端）
  fetch-mails.js     163 IMAP 拉取（SINCE 7天 / 剔除领英）
scripts/             部署脚本（只读环境变量）
src/
  pages/             各功能页面
  components/        底部导航 / 课表 / 弹层等
  utils/             AI、邮件同步、音效
  i18n.tsx           双语
  index.css          全局极地冰雪设计语言
```

---

## 注意

- 邮箱授权码、OAuth secret 等**一律走服务端环境变量**，不要写进源码
- `.env` 已在 `.gitignore` 中，提交前请确认没有真实密钥进仓库

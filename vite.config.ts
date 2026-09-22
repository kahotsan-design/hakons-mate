import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['apple-touch-icon.png', 'favicon.svg'],
      manifest: {
        name: "HAKON'S MATE · 港城大学习生活助手",
        short_name: 'HAKON',
        description: '小曾的个人生活学习管理伙伴',
        lang: 'zh-CN',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#4F97D2',
        theme_color: '#4F97D2',
        icons: [
          {
            src: '/icons/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/icons/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // 运行时缓存策略：主应用导航请求走网络优先，拿不到再回退缓存
        navigateFallback: '/index.html',
        globPatterns: ['**/*.{js,css,html,svg,png,ico,jpg}'],
        runtimeCaching: [
          {
            // 导航请求（打开/刷新 App）网络优先：
            // 在线时永远拿到最新 index.html，部署后立即生效；
            // 弱网 3 秒超时、离线时回退缓存（上次网络拿到的版本）。
            urlPattern: ({ request }: { request: Request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'navigations',
              networkTimeoutSeconds: 3,
              cacheableResponse: { statuses: [200] },
            },
          },
          {
            // API 请求不缓存（走网络）
            urlPattern: /\/api\//,
            handler: 'NetworkOnly',
          },
        ],
      },
    }),
  ],
})

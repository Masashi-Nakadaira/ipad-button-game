import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const basePath = (process.env.APP_BASE || '').replace(/^\/+|\/+$/g, '');
const base = basePath ? `/${basePath}/` : '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      scope: base,
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/apple-touch-icon.png', 'third-party-notices.txt'],
      manifest: {
        id: base,
        name: 'みんなのボタンゲーム',
        short_name: 'ボタンゲーム',
        description: '大きなボタンで遊べる10種類のゲーム',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f6f5ef',
        theme_color: '#f6f5ef',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{html,js,css,png,svg,ico,webp,woff2,json}'],
        globIgnores: ['icons/**'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: `${base}index.html`,
        navigateFallbackDenylist: [/(?:^|\/)api(?:\/|$)/, /(?:^|\/)ws(?:\/|$)/],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false,
        runtimeCaching: []
      }
    })
  ],
  server: { host: '0.0.0.0', port: 5173, proxy: { '/ws': { target: 'ws://127.0.0.1:8787', ws: true }, '/api': 'http://127.0.0.1:8787' } }
});

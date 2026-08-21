import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: [
        'favicon.ico',
        'favicon.png',
        'apple-touch-icon.png',
        'img/*.webp',
        'img/*.png',
      ],
      manifest: {
        name: 'ツギカン',
        short_name: 'ツギカン',
        description: '書店の棚の前で、自分が何巻まで持っているかを3秒以内に思い出す',
        theme_color: '#131A2B',
        background_color: '#131A2B',
        display: 'standalone',
        orientation: 'portrait',
        lang: 'ja',
        start_url: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/maskable-icon-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            // openBD へのAPI通信はキャッシュしない（常に最新を取得）
            urlPattern: /^https:\/\/api\.openbd\.jp\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Google Fonts スタイルシートのキャッシュ
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            // Google Fonts フォントファイルのキャッシュ
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
            },
          },
        ],
      },
    }),
  ],
});

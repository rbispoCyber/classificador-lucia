import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['logo.jpg', 'logo.png'],
      manifest: {
        name: 'RoFlow - Suíte Petrofísica',
        short_name: 'RoFlow',
        description: 'Motor petrofísico para classificação de carbonatos.',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/?source=pwa',
        icons: [
          {
            src: 'logo.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ],
        screenshots: [
          {
            src: 'logo.png',
            sizes: '512x512',
            type: 'image/png',
            form_factor: 'wide',
            label: 'RonCore Analytics'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,jpg,jpeg}'],
        navigateFallback: '/index.html',
        maximumFileSizeToCacheInBytes: 10000000
      }
    })
  ],
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:8000'
    }
  }
})

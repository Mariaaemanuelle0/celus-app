import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['celus.svg'],
      workbox: { globPatterns: ['**/*.{js,css,html,svg,woff2}'] },
      manifest: {
        name: 'Celus',
        short_name: 'Celus',
        description: 'Espaços e serviços por perto, num mapa.',
        lang: 'pt-BR',
        theme_color: '#03050A',
        background_color: '#03050A',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'celus.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})

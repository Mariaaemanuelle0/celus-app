import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['celus.svg'],
      manifest: {
        name: 'Celus',
        short_name: 'Celus',
        description: 'Espaços e serviços por perto, num mapa.',
        lang: 'pt-BR',
        theme_color: '#05070C',
        background_color: '#05070C',
        display: 'standalone',
        start_url: '/',
        icons: [{ src: 'celus.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }],
      },
    }),
  ],
})

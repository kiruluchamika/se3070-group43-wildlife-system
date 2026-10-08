import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'prompt',
        includeAssets: ['favicon.svg'],
        manifest: {
          name: 'WildGuard — Wildlife Conservation',
          short_name: 'WildGuard',
          description: 'Offline-capable wildlife incident reporting and conservation operations.',
          theme_color: '#061419',
          background_color: '#061419',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
            { src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'maskable' },
          ],
        },
        workbox: {
          navigateFallback: '/index.html',
          // API data is intentionally excluded; incident payloads are owned by Dexie.
          navigateFallbackDenylist: [/^\/api\//],
        },
      }),
    ],
    server: {
      proxy: {
        // Local development: /api requests go to the Express backend.
        '/api': env.VITE_DEV_PROXY_TARGET || 'http://localhost:5000',
      },
    },
  }
})

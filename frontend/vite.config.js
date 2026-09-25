import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')

  return {
    plugins: [react(), tailwindcss()],
    server: {
      proxy: {
        // Local development: /api requests go to the Express backend.
        '/api': env.VITE_DEV_PROXY_TARGET || 'http://localhost:5000',
      },
    },
  }
})

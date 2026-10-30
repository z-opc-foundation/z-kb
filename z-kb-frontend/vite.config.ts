import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import {safeEmptyOutDir} from '../build-tools/safe-vite-plugin.ts'

export default defineConfig({
  plugins: [safeEmptyOutDir(), react()],
  server: {
    port: 5173,
    host: '0.0.0.0',
    proxy: {
      '/api': {
        target: 'http://localhost:8080',
        changeOrigin: true
      },
      '/doc.html': 'http://localhost:8080',
      '/webjars': 'http://localhost:8080',
      '/actuator': 'http://localhost:8080'
    }
  }
})

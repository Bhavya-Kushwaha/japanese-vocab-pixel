import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/fetch': 'http://localhost:5000',
      '/sentence': 'http://localhost:5000',
      '/api': 'http://localhost:5000',
      '/static': 'http://localhost:5000'
    }
  },
  test: {
    environment: 'jsdom',
  }
})

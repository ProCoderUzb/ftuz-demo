import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The API runs on :8000 in development; proxying keeps requests same-origin.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
    },
  },
})

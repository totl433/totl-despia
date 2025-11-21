import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Allow external connections (for testing on iPhone)
    port: 5173,
  },
  optimizeDeps: {
    include: ['html2canvas'],
  },
})

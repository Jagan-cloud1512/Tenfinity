import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@monaco-editor')) return 'vendor-monaco'
          if (id.includes('react-markdown') || id.includes('react-syntax-highlighter')) return 'vendor-markdown'
          if (id.includes('@supabase')) return 'vendor-supabase'
          if (id.includes('react-router-dom')) return 'vendor-router'
        },
      },
    },
  },
})

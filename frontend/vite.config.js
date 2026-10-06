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
        manualChunks: {
          'vendor-monaco': ['@monaco-editor/react'],
          'vendor-markdown': ['react-markdown', 'react-syntax-highlighter'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-router': ['react-router-dom'],
        },
      },
    },
  },
})

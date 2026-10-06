






import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  resolve: {
    alias: {
      'monaco-themes/themes': fileURLToPath(
        new URL('./node_modules/monaco-themes/themes', import.meta.url)
      )
    }
  },
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      '/judge0': {
        target: 'https://resume-sandlot-yiddish.ngrok-free.dev',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/judge0/, ''),
        headers: { 'ngrok-skip-browser-warning': 'true' },
        timeout: 30000,
      },
    },
  },
})

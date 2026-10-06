import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 部署於 GitHub Pages 根路徑：/map-point-cloud/
export default defineConfig({
  base: '/map-point-cloud/',
  plugins: [react()],
  build: {
    outDir: '../dist',
    emptyOutDir: true,
  },
})

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 部署於 GitHub Pages 子路徑：/map-point-cloud/ascii-video/
export default defineConfig({
  base: '/map-point-cloud/ascii-video/',
  plugins: [react()],
  build: {
    outDir: '../dist/ascii-video',
    emptyOutDir: true,
  },
})

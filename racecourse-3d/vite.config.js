import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
// 部署於 GitHub Pages 子路徑：/map-point-cloud/racecourse-3d/
export default defineConfig({
  base: '/map-point-cloud/racecourse-3d/',
  plugins: [react()],
  build: {
    outDir: '../dist/racecourse-3d',
    emptyOutDir: true,
  },
})

import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const OUT_DIR = '../dist/racecourse-3d'

/**
 * 角色模型（public/models/*.vrm）版權屬原作者、Mixamo 動作檔（public/animations/*.fbx）不可單獨散布，只供本機開發使用。
 * Vite 會把 public/ 整個複製進建置結果，deploy 時就會被公開，所以建置完成後移除。
 */
const excludeLocalModels = () => ({
  name: 'exclude-local-models',
  apply: 'build',
  closeBundle() {
    for (const dir of ['models', 'animations']) {
      rmSync(fileURLToPath(new URL(`${OUT_DIR}/${dir}`, import.meta.url)), { recursive: true, force: true })
    }
  },
})

// https://vite.dev/config/
// 部署於 GitHub Pages 子路徑：/map-point-cloud/racecourse-3d/
export default defineConfig({
  base: '/map-point-cloud/racecourse-3d/',
  plugins: [react(), excludeLocalModels()],
  build: {
    outDir: OUT_DIR,
    emptyOutDir: true,
  },
})

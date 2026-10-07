# map-point-cloud

pnpm workspace，包含三個獨立的 Vite + React 子專案：

| 子專案 | 說明 | 部署路徑 |
|---|---|---|
| `point-cloud-map/` | 3D 點雲／高度地圖視覺化（three.js / react-three-fiber） | `/map-point-cloud/` |
| `ascii-video/` | 影片轉 ASCII 播放器（`sample-videos/` 為測試用影片，不會打包） | `/map-point-cloud/ascii-video/` |
| `racecourse-3d/` | 東京競馬場 3D 跑道（依 JRA 官方距離／高低斷面圖重建，three.js / react-three-fiber） | `/map-point-cloud/racecourse-3d/` |

## 指令

```bash
pnpm install        # 安裝所有子專案依賴
pnpm dev:map        # 開發點雲地圖
pnpm dev:ascii      # 開發 ASCII 影片
pnpm dev:race       # 開發東京競馬場 3D 跑道
pnpm build          # 依序建置三個子專案到 dist/
pnpm deploy         # 建置並發佈到 gh-pages
pnpm lint           # 對整個 repo 執行 ESLint
```

也可以進入子專案資料夾直接執行 `pnpm dev` / `pnpm build`。

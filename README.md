# Web AR 項鍊試戴 MVP

純前端 Web AR 項鍊試戴原型。使用者開啟相機後，瀏覽器以相機畫面為背景，透過 MediaPipe Face Mesh 偵測單人臉部 landmarks，再用 Three.js 疊加 `.glb` 項鍊模型。

定位方式不是完整 3D 人體或脖子重建，而是根據下巴、臉寬、臉高與頭部傾斜**估算**項鍊位置。若 GLB 內含脖子遮擋模型，專案會讓它不顯示顏色但寫入深度緩衝區，讓項鍊後半段被隱形脖子遮住。

## 文件導覽

> **維護者 / AI 請從架構地圖開始：[`docs/map/INDEX.md`](docs/map/INDEX.md)。**
> 地圖把專案拆成小而單一主題的模組檔（每檔都說明：負責什麼／包含什麼／如何部署／如何檢驗／刪除規範），方便只讀需要的部分。

- 架構地圖（單一事實來源）：[`docs/map/INDEX.md`](docs/map/INDEX.md)
- AI 入口與全域護欄：[`AGENTS.md`](AGENTS.md)
- 設計理由與圖：[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)
- 本機協作 / commit / PR / TypeScript：[`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)
- 部署與發布：[`docs/deployment.md`](docs/deployment.md)
- 重大決策：[`docs/adr/`](docs/adr/)

## 啟動方式

```bash
npm install
npm run dev
```

開啟 Vite 顯示的網址（通常 `http://localhost:5173`）。相機權限通常需要 `localhost` 或 HTTPS。

## 品質驗證

常用閘門如下；各指令用途、覆蓋範圍與只能人工實機的項目見 [`docs/map/verify.md`](docs/map/verify.md)。

```bash
npm run lint
npm run typecheck
npm test
npm run build
npm run test:visual
npm run test:a11y
npm run budget
npm run smoke
npm run lighthouse
npm audit --omit=dev
```

## 專案結構

```text
.
├── AGENTS.md                # AI 入口與全域護欄
├── index.html               # 頁面骨架（含 SEO/OG/JSON-LD/manifest 與三層疊放 canvas）
├── vite.config.js           # base、release/site metadata 注入
├── docs/
│   ├── map/                 # ← 架構地圖：模組化文件（單一事實來源）
│   ├── ARCHITECTURE.md      # 設計理由 + mermaid 圖
│   ├── CONTRIBUTING.md      # commit / PR / TypeScript 規則
│   ├── deployment.md        # 部署 / rollback / headers / SEO
│   ├── assets-compression.md
│   └── adr/                 # 0001 Cloudflare Pages、0002 漸進式 TS、0003 MediaPipe CSP、0004 use-cases
├── scripts/                 # bundle budget / smoke / smoke-release / lighthouse / compress-glb
├── public/                  # models / draco / vendor(mediapipe) / icons / brand / _headers / manifest
├── src/
│   ├── main.js              # 入口：組裝 AppState / UiRoot / CaptureService / runtime / controller
│   ├── app/                 # 狀態、router、reducer、controller、use-cases、services、workflow
│   ├── core/                # 相機、Face Mesh、Three.js scene 子服務、校準、平滑、debug
│   ├── ui/                  # UiRoot composer + 各 View + domHelpers
│   ├── config/              # necklaces / tuning / assets / release / site
│   ├── styles/              # index.css + reset/tokens/layout/states/responsive + components/*
│   ├── telemetry/           # RuntimeErrorReporter（optional，隱私邊界）
│   ├── types/               # domain + app/ui/scene ports（漸進式 TypeScript）
│   └── utils/               # landmarks、stageResize
└── tests/                   # a11y（axe）、visual（Playwright，baseline 於 Linux/CI 產生）
```

各層、各概念（追蹤/換色/WebGL 資源/深連結/部署…）的職責、內容與規範，請見 [`docs/map/INDEX.md`](docs/map/INDEX.md) 的模組路由表。

## 已知限制

- 只支援單人、正面或近正面的臉部追蹤。
- 脖子位置由臉部 landmarks 估算，不是真實 3D 脖子重建。
- 沒有物理碰撞、衣領互動或高精度人體貼合；遮擋依賴 GLB 內遮擋模型與項鍊前後深度。
- MediaPipe Face Mesh wasm/model 已 vendored 到 `public/vendor/mediapipe/face_mesh`，執行時不依賴 CDN。
- iOS Safari 的相機權限與 WebGL 表現可能依裝置與系統版本不同。

## 文件語言約定

README 與主要維護文件優先使用繁體中文，必要技術名詞（`Depth Buffer`、`landmarks`、`GLB`、`mesh`、`pivot`）可保留英文。

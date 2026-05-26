# Web AR 項鍊試戴 MVP

這是一個純前端的 Web AR 項鍊試戴原型。使用者開啟相機後，瀏覽器會以相機畫面作為背景，透過 MediaPipe Face Mesh 偵測單人臉部 landmarks，再用 Three.js 疊加 `.glb` 項鍊模型。

目前的定位方式不是完整的 3D 人體或脖子重建，而是根據下巴、臉寬、臉高與頭部傾斜估算項鍊應該出現的位置。若 GLB 內包含脖子遮擋模型，專案會讓該脖子模型不顯示顏色，但寫入深度緩衝區，讓項鍊後半段能被隱形脖子擋住。

架構設計背景請看 [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md)，本機協作流程請看 [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md)，長期決策請看 [`docs/adr/`](docs/adr/)。

## 專案結構

```text
.
├── .github/
│   └── workflows/
├── docs/
│   ├── ARCHITECTURE.md
│   ├── CONTRIBUTING.md
│   ├── adr/
│   ├── assets-compression.md
│   └── deployment.md
├── index.html
├── package.json
├── package-lock.json
├── scripts/
│   ├── check-bundle-budget.mjs
│   ├── run-lighthouse.mjs
│   ├── smoke.mjs
│   └── smoke-release.mjs
├── vite.config.js
├── public/
│   ├── brand/
│   │   └── lunera-logo.png
│   ├── icons/
│   │   ├── apple-touch-icon.png
│   │   ├── lunera-icon-192.png
│   │   └── lunera-icon-512.png
│   ├── models/
│   │   ├── README.md
│   │   ├── necklace.glb
│   │   └── necklace.draco.glb
│   ├── draco/
│   │   ├── draco_decoder.wasm
│   │   └── draco_wasm_wrapper.js
│   ├── site.webmanifest
│   ├── thumbnails/
│   │   └── default-necklace.svg
│   └── vendor/
│       └── mediapipe/
│           └── face_mesh/
├── src/
│   ├── main.js
│   ├── styles/
│   │   ├── index.css
│   │   ├── reset.css
│   │   ├── tokens.css
│   │   ├── layout.css
│   │   ├── states.css
│   │   ├── responsive.css
│   │   ├── accessibility.css
│   │   └── components/
│   ├── app/
│   │   ├── use-cases/
│   │   ├── AppState.js
│   │   ├── AppState.test.js
│   │   ├── AppRuntimeController.js
│   │   ├── AppRuntimeController.test.js
│   │   ├── router.js
│   │   ├── router.test.js
│   │   ├── ArSessionService.js
│   │   ├── CalibrationService.js
│   │   ├── CalibrationService.test.js
│   │   ├── CaptureService.js
│   │   ├── ModelCatalogService.js
│   │   ├── ModelCatalogService.test.js
│   │   ├── RealtimeTrackingStore.js
│   │   ├── RendererLoop.js
│   │   ├── ShareWorkflow.js
│   │   ├── ShareWorkflow.test.js
│   │   ├── TrackingFeedbackService.js
│   │   ├── app-intents.ts
│   │   ├── app-reducer.ts
│   │   └── createAppRuntime.js
│   ├── config/
│   │   ├── assets.js
│   │   ├── necklaces.js
│   │   ├── release.js
│   │   └── tuning.js
│   ├── core/
│   │   ├── CameraStream.js
│   │   ├── DebugOverlay.js
│   │   ├── FaceQualityAdvisor.js
│   │   ├── FaceTracker.js
│   │   ├── GlbAssetLoader.ts
│   │   ├── MaterialCustomizationEngine.js
│   │   ├── ModelResourceDisposer.js
│   │   ├── NecklaceController.js
│   │   ├── NecklacePlacementAdapter.js
│   │   ├── NecklaceScene.js
│   │   ├── NecklaceScene.test.js
│   │   ├── OccluderProcessor.js
│   │   ├── ShowcasePresenter.ts
│   │   ├── Smoother.js
│   │   ├── ThreeRendererHost.js
│   │   └── WearCalibration.js
│   ├── telemetry/
│   │   └── RuntimeErrorReporter.js
│   ├── types/
│   │   ├── app-ports.ts
│   │   ├── domain.ts
│   │   ├── scene-ports.ts
│   │   └── ui-ports.ts
│   ├── ui/
│   │   ├── UiRoot.js
│   │   └── UiRoot.test.js
│   └── utils/
│       ├── landmarks.js
│       └── stageResize.js
└── tests/
    ├── a11y/
    └── visual/
```

其中 `src/main.js` 只負責載入樣式、安裝 runtime error reporter、暴露 release metadata，並組裝 `AppState`、`UiRoot`、`CaptureService`、runtime services 與 `AppRuntimeController`。`src/app/router.js` 是純函式 hash router，負責解析與序列化可分享的款式/顏色 URL state，不 import controller 或 AppState。`src/app/AppRuntimeController.js` 保留 UI handler routing surface；模式、相機、追蹤、模型、校準、分享、舞台互動、URL hydration 與頁面生命週期副作用都由 controller 轉發或協調到明確邊界。`src/app/` 放應用狀態、工作流程服務與 use-case，`src/ui/` 放 DOM/UI root，`src/core/` 放相機、Face Mesh、Three.js scene 子服務、穿戴校準與品質提示等可重用核心邏輯，`src/utils/` 放 landmark 計算與預覽區尺寸監聽工具。

## 應用流程分層

runtime 的依賴方向是：

```text
UiRoot intent
  -> AppRuntimeController
  -> src/app/use-cases/*
  -> src/app/*Service 或 *Workflow
  -> src/core/*、NecklaceScene、FaceTracker、CaptureService
  -> AppState durable state + RealtimeTrackingStore sampled state
  -> UiRoot sync
```

目前 app services 的責任如下：

- `AppRuntimeController`：保留 `src/main.js` 需要綁定的 handler surface，只負責把 UI intent route 到 use-case。
- `ModeUseCase`：管理模式切換、panel/bottom sheet、debug toggle 與項鍊顯示副作用。
- `StageInteractionUseCase`：區分 showcase 拖曳旋轉與 AR 校準拖曳。
- `RuntimeLifecycleUseCase`：管理初始化、頁面背景暫停/恢復、render loop start 與 AR session 預載入。
- `CameraSessionUseCase`：管理啟動相機、停止相機、切換鏡頭、Face Mesh 載入與重試流程。
- `TrackingUseCase`：接收 Face Mesh result，寫入 realtime store，並只在 live face status 改變時 transition。
- `ModelUseCase`：管理款式選擇、模型載入、套色與模型載入後的 mode effect。
- `CalibrationUseCase`：管理拖曳校準、調參 controls、save/reset/load 與提示狀態。
- `ShareUseCase`：管理截圖、下載、native share fallback 與分享狀態。
- `ArSessionService`：包裝 `CameraStream` 與 `FaceTracker`，管理 start、stop、switch camera、selfie mode 與 session reset。
- `ModelCatalogService`：管理項鍊款式查找、模型載入序列、可換色 target、預設色票與 `NecklaceScene.applyColor()` 流程。
- `RealtimeTrackingStore`：保存每幀 landmarks、debugData、hasFace、frame sequence、FaceTracker stats 與 render stats，不觸發 DOM 全量同步。
- `RendererLoop`：管理 dirty render、AR live RAF、showcase 自轉 RAF、background pause、render FPS、Three.js render 與 debug overlay render。
- `CalibrationService`：管理 `WearCalibration`、拖曳校準、調參 normalize、save/reset/load 與校準提示狀態。
- `ShareWorkflow`：管理截圖前置檢查、capture、download、native share fallback 與分享狀態資料。
- `TrackingFeedbackService`：從節流後的 realtime snapshot 組裝 FaceTracker stats、render FPS、FaceQualityAdvisor advice、developer panel 與 debug status 文字。

## 漸進式 TypeScript 狀態

專案目前採漸進式 TypeScript strict boundary，而不是一次性改成全 TypeScript：

- `tsconfig.json` 使用 `allowJs: true`、`checkJs: false`、`strict: true`。
- `src/types/domain.ts` 保存跨檔案共享的 domain types。
- `src/types/app-ports.ts`、`src/types/ui-ports.ts`、`src/types/scene-ports.ts` 保存 app/UI/scene 邊界 port types。
- 只檢查局部加上 `// @ts-check` 的 `.js` 檔案、`.ts` 檔案與 `vite.config.js`。
- 使用 `npm run typecheck` 執行 `tsc --noEmit`。

目前已納入 typed boundary 的核心範圍包含：

- `AppState` 與 AR session lifecycle。
- config schema：`tuning`、`necklaces`。
- MediaPipe results、RealtimeTrackingStore、FaceTracker、ArSessionService、TrackingUseCase、NecklaceController、landmark metrics 的資料流。
- model/color、calibration、share、tracking feedback、renderer loop、camera stream、debug overlay、capture service。
- scene boundary：NecklaceScene facade、GlbAssetLoader、ThreeRendererHost、NecklacePlacementAdapter、OccluderProcessor、MaterialCustomizationEngine、ModelResourceDisposer、ShowcasePresenter。
- telemetry boundary：RuntimeErrorReporter、release metadata 與 sanitized error context。
- pure logic：landmarks、Smoother、WearCalibration、FaceQualityAdvisor。

仍刻意未完整型別化的區域：

- `src/ui/UiRoot.js`：DOM query、event binding、UI render helper 與 focus trap 噪音較高。若要推進，建議先拆 DOM helper 或 view helper，再分段加 `// @ts-check`。
- `src/main.js`、`src/app/*.test.js` 與 `src/core/*.test.js`：適合作為下一階段低成本補強。

目前不建議打開全域 `checkJs`，也不建議直接把 `UiRoot` 或剩餘高 DOM/WebGL 噪音模組整包轉成 TypeScript。維護時優先持續保護 runtime 資料形狀容易錯接的 service boundary。

`AppState` 保留 durable UI state，例如 mode、sessionStatus、cameraStarted、selectedNecklace、debugEnabled、capture/share 狀態與校準調參。每幀 landmarks、debugData、hasFace、frame sequence、tracker stats 與 render stats 放在 `RealtimeTrackingStore`。UI 只訂閱 `AppState` 以及節流後的 realtime snapshot，FaceMesh result 不再每幀觸發 DOM 同步。

## 可分享深連結

LUNERA 以 hash URL 保存可分享的款式與換色狀態，維持純前端部署與 Cloudflare Pages 根路徑相容。URL schema：

```text
#n=<necklaceId>
#n=<necklaceId>&c=<fallbackColorId>
#n=<necklaceId>&c.<targetId>=<colorId>
```

範例：

```text
http://localhost:5173/#n=crystal-cone-necklace&c.metal=citrine&c.gem=amethyst
```

- `n` 是必填的項鍊款式 id，對應 `src/config/necklaces.js` 的 `NECKLACES[].id`。
- `c` 是 fallback 色票 id，會套用到沒有逐 target 指定的可換色 target。
- `c.<targetId>` 會優先套用到指定 target，例如 `metal`、`gem`；target 與 palette 也都來自 `src/config/necklaces.js`。
- 無效款式、未知 key、空值或不存在於目前款式 palette 的色票會被忽略，不顯示錯誤。
- App 初始化時先根據 hash 更新 `AppState`，避免初始模型雙載；模型載入完成後才依實際可換色材質 target 套用逐 target 顏色。
- 使用者切換款式或換色時，`src/main.js` 會在 UI sync 後用 `history.replaceState` 回寫 hash，不會把每次換色都推成新的瀏覽器歷史紀錄。

AR session lifecycle 以 `sessionStatus` 表達，合法轉換大致為：

```text
showcase -> arIdle -> cameraStarting -> trackingStarting -> noFace <-> tracking -> capturing -> sharing
```

相機成功但 FaceMesh 或 MediaPipe 資產初始化失敗時會進入 `trackingError`，保留 live camera preview 並允許只重試臉部追蹤初始化。`error` 可由各階段進入，使用者重新切換模式或啟動相機後再回到正常流程。離開相機、切換鏡頭或進入背景時會清空 `RealtimeTrackingStore` 的 live tracking data，避免相機已關閉卻保留舊追蹤資料。

## 啟動方式

```bash
npm install
npm run dev
```

開啟 Vite 顯示的網址，通常是：

```text
http://localhost:5173
```

相機權限通常需要 `localhost` 或 HTTPS。

## 品質驗證

本專案使用 Vitest 補輕量單元測試，優先覆蓋不需要真實相機、MediaPipe 或 WebGL 的純邏輯。這些測試主要保護 runtime use-case、app services 與狀態轉換規則。

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

各命令用途：

- `npm run lint`：使用 ESLint 檢查 browser ESM、Vite config、測試與 Node 腳本的常見 JavaScript 問題。
- `npm run typecheck`：執行漸進式 TypeScript boundary 檢查。
- `npm test`：執行 Vitest 單元測試。
- `npm run build`：產出 production bundle 到 `dist/`。
- `npm run test:visual`：用 Playwright/Chromium 比對 showcase 與分享預覽的桌面、平板、手機截圖。
- `npm run test:a11y`：用 Playwright + axe-core 掃描 showcase 初始畫面與分享預覽狀態，不需要相機權限。
- `npm run budget`：檢查 `dist/assets` 的 JS/CSS、`public/models/*.glb` 與 MediaPipe Face Mesh vendored 重要資產大小，需先執行 `npm run build`。
- `npm run smoke`：build 後啟動 Vite preview，或在設定 `SMOKE_BASE_URL` 時檢查遠端部署；會驗證 JS/CSS、GLB header、MediaPipe vendor 檔、release/error-reporting metadata、showcase canvas 與不需相機權限的基本互動。
- `npm run lighthouse`：用 build 後的 Vite preview 跑 Lighthouse showcase 頁面，門檻先採保守 baseline，需先執行 `npm run build`。
- `npm run smoke:release`：對已部署 URL 檢查 `release.json`、build assets、GLB 與 MediaPipe 重要資產，需設定 `SMOKE_BASE_URL`。
- `npm audit --omit=dev`：只檢查 production dependencies；CI 目前以 warning + report artifact 呈現既有 advisory。

目前單元測試重點：

- `AppState`：AR session 合法/不合法 transition，以及 durable UI state cleanup。
- `RealtimeTrackingStore`：每幀資料、debugData、frame sequence、tracker stats 與 render stats。
- `RendererLoop`：dirty idle render、AR live RAF、background pause/resume 的模式切換。
- `TrackingUseCase`：FaceMesh result 寫入 realtime store，且只在 `noFace`/`tracking` 實際變化時 transition。
- `ModelCatalogService`：預設顏色選擇、換色 target fallback、matched target label 與套色呼叫。
- `router` 與 `AppRuntimeController`：hash parse/serialize、初始 URL hydration、模型載入後 pending 顏色套用、hashchange 與 URL sync suppression。
- `CalibrationService`：調參 normalize、save/load/reset hint、localStorage 可用與不可用情境。
- `ShareWorkflow`：截圖前置阻擋條件，包含相機未開、沒有目前影格、未偵測到臉與項鍊隱藏。
- `NecklaceScene`：GLB buffer cache LRU、`dispose()` teardown、共享 geometry/material/texture 去重釋放，以及 depth occluder 替換前原材質釋放。

Playwright 視覺回歸測試會啟動本機 Vite dev server，檢查桌面、平板與手機 viewport 的 showcase shell 與分享預覽。CI 會先執行 `npx playwright install --with-deps chromium` 安裝 Chromium 與 Linux browser dependencies，失敗時上傳 `playwright-report/` 與 `test-results/` 方便比對。

CI 的 npm audit 先以 production dependency 為範圍執行 `npm audit --omit=dev`；若現有 production advisory 尚未修復，會產出 audit report artifact 與 warning，避免 dev dependency 或既有 advisory 讓 PR gate 長期無法通過。

## SEO、社群分享與安裝體驗

目前已補上商業化最低門檻的 SEO / OG / Twitter Card / Web App Manifest / JSON-LD 基礎：

- `index.html`：包含繁體中文 title、description、robots、canonical、theme-color、mobile web app tags、Open Graph、Twitter Card 與 JSON-LD `@graph`。
- `public/site.webmanifest`：定義 `name`、`short_name`、description、start URL、scope、display、theme/background color、`zh-Hant` 語系、categories 與 icon 清單。
- `public/brand/lunera-logo.png`：暫用的 LUNERA logo，供 OG/Twitter image 與 JSON-LD logo/image 使用。
- `public/icons/*`：由暫用 logo 產生的 192、512 與 Apple touch icon，避免 manifest 或 iOS install flow 引用不存在的檔案。

正式上線前仍需確認：

- 將 `index.html` 內 TODO 標註的 canonical、`og:url` 與 JSON-LD `url` 換成 Cloudflare Pages production URL 或自訂網域的絕對 URL。
- 將暫用的方形 `brand/lunera-logo.png` 替換或補上正式 1200x630 社群分享預覽圖，並同步更新 `og:image` / `twitter:image` 與尺寸。
- 確認最終品牌名稱是否使用 `LUNERA`，或改回 `Soft Jewelry Studio` / 其他正式名稱。

## 部署與發布

部署流程設計請見 [`docs/deployment.md`](docs/deployment.md)。目前 repo 內已提供：

- build artifact：CI 會上傳 `ar-necklace-dist-${GITHUB_SHA}`，內容包含 `dist/release.json`。
- release metadata：build 後可在 `release.json`、browser console、`window.__AR_NECKLACE_RELEASE__` 與 debug panel 看到 version、commit SHA、build time、environment。
- SEO/分享/安裝基礎：`index.html`、`public/site.webmanifest` 與 `public/brand` / `public/icons` 提供搜尋、社群分享與行動裝置加入主畫面的最低素材。
- runtime safety：可選 `VITE_ERROR_REPORTING_DSN` 啟用 Sentry-compatible error reporting；未設定時不影響 build 或 app。上報會帶 release metadata，但不包含相機畫面、使用者影像或 Face Mesh landmarks。
- 正式部署目標：Cloudflare Pages，部署 root base path 為 `/`。`vite.config.js` 預設 `base: '/'`，若歷史 GitHub Pages rollback 需要子路徑，可用 `VITE_BASE_PATH=/ar_necklace/ npm run build` 明確覆寫。
- headers/cache：`public/_headers` 會由 Vite 複製到 `dist/_headers`，Cloudflare Pages 會套用 CSP、Permissions-Policy 與 Cache-Control。GitHub Pages 不支援自訂 headers，因此不再作為正式部署目標。
- `.github/workflows/deploy.yml`：Cloudflare Pages PR preview、`staging` branch preview，以及 `master` / `main` push 後的 production deploy。沒有 Cloudflare secrets 時部署 job 會跳過。
- `.github/workflows/rollback.yml`：Cloudflare Pages rollback workflow，rollback 後會以 `npm run smoke:release` 驗證版本、header 與資產。

若使用此 repo 的 GitHub Actions CD workflow 維護 Cloudflare Pages，需在 GitHub repository secrets 設定 `CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_PAGES_PROJECT`；`STAGING_URL`、`PRODUCTION_URL` 可選，用於自訂網域 smoke fallback。建議替 `production` environment 開啟 required reviewers。正式線上入口以 Cloudflare Pages production URL 或自訂網域為準。

線上部署後建議對 Cloudflare Pages production URL 做冒煙測試：

- 執行 `SMOKE_BASE_URL=<Cloudflare Pages URL> npm run smoke`，確認首頁 CSP、Permissions-Policy、Cache-Control、release metadata、JS/CSS、GLB、MediaPipe vendor assets 與 showcase canvas 都正常。
- 用瀏覽器開啟 production URL，確認頁面載入無 console error。
- 確認 `index.html` 指向最新 `assets/index-*.js` 與 `assets/index-*.css`。
- 確認 title、description、canonical、Open Graph、Twitter Card、manifest link 與 JSON-LD 在 production HTML 中存在，且 URL 指向正式網域。
- 確認 `site.webmanifest`、`brand/lunera-logo.png`、`icons/lunera-icon-192.png`、`icons/lunera-icon-512.png` 與 `icons/apple-touch-icon.png` 沒有 404。
- 確認 showcase 初始畫面、Three.js canvas、`models/necklace.draco.glb`、`draco/draco_decoder.wasm` 與 `vendor/mediapipe/face_mesh/*` 路徑沒有 404，且大型資產回應 `Cache-Control: public, max-age=31536000, immutable`。
- 開啟一組 hash 深連結，例如 `#n=crystal-cone-necklace&c.metal=citrine&c.gem=amethyst`，確認會載入指定款式與逐 target 顏色，且切換款式/換色後 URL 即時更新。
- 基本操作款式卡片、色票、AR/模型展示切換與 Debug toggle。
- 相機權限、Face Mesh 真實追蹤、前後鏡頭切換與 iOS Safari 表現仍需人工實機確認。

GitHub Pages 不再是例行發布目標。若仍保留 `https://cooby19.github.io/ar_necklace/`，請把它視為 demo/fallback，並在 README、QR code、對外文件與測試流程中避免把它寫成正式站。

## 放置 GLB 模型

預設 runtime 模型路徑是：

```text
public/models/necklace.draco.glb
```

原始 `public/models/necklace.glb` 保留作為 fallback 與重新壓縮來源。瀏覽器執行時會透過 `versionedPublicAssetUrl('models/necklace.draco.glb')` 載入；在本機 dev 通常解析為：

```text
/models/necklace.draco.glb?v=<version>-<commit>
```

新增或替換模型後，先執行 `npm run compress:glb` 產生 `.draco.glb`，再把 `src/config/necklaces.js` 指向壓縮檔。完整流程請看 `docs/assets-compression.md`。

如果要新增多款項鍊，請在 `src/config/necklaces.js` 匯入並使用 `versionedPublicAssetUrl()` 產生 URL，讓 Cloudflare Pages 根路徑、preview URL、必要時的子路徑 rollback build 與 CDN cache key 差異下都能正確解析資產，避免 404 或讀到舊檔：

```js
import { versionedPublicAssetUrl } from './assets.js';

{
  id: 'silver-chain',
  label: '銀色鍊款',
  url: versionedPublicAssetUrl('models/silver-chain.draco.glb'),
  preserveAuthorOrigin: true,
  occluderParts: {
    nameIncludes: ['neck', '脖', '頸', '圓柱'],
  },
  transform: {
    baseScale: 1,
    offsetX: 0,
    offsetY: 0,
    offsetZ: 0,
    rotationX: 0,
    rotationY: 0,
    rotationZ: 0,
  },
}
```

## 脖子遮擋模型

如果 GLB 裡有用來對位或遮擋的脖子模型，請在 Blender 中保持它是獨立物件或獨立 mesh，並把名稱命名成 `neck`、`neck_helper`、`脖子`、`頸部`、`圓柱體` 等可被 `occluderParts.nameIncludes` 命中的名稱。

目前預設會保留 Blender 匯出的作者原點，也就是 `preserveAuthorOrigin: true`。建議把整組「脖子 + 項鍊」的 origin 放在脖子正面、項鍊實際掛上的位置。程式會把這個 origin 對準偵測到的脖子 anchor，因此它就是 AR 穿戴時的掛點。

被命中的脖子模型會保留在 Three.js 場景裡，但使用特殊深度材質：

- 不寫入顏色，因此使用者看不到脖子模型。
- 寫入 Depth Buffer，因此可以遮住位於它後方的項鍊。
- 項鍊 mesh 仍會正常渲染，並透過深度測試決定哪些珠子或鍊段要被擋住。

若要得到自然的前後遮擋效果，項鍊模型本身需要真的有前後深度。也就是說，項鍊前半段應該位於脖子前方，後半段應該位於脖子後方；如果整條項鍊都在同一個平面上，深度測試無法判斷哪一段該被擋住。

## WebGL 資源與 GLB 快取

`NecklaceScene` 是 scene facade，負責協調 `GlbAssetLoader`、`NecklacePlacementAdapter`、`OccluderProcessor`、`MaterialCustomizationEngine`、`ModelResourceDisposer`、`ShowcasePresenter` 與 `ThreeRendererHost`。切換項鍊款式時，`loadNecklace()` 會 abort 舊載入、釋放舊模型底下的 geometry、material 與 texture，再清空 placement/material state 並載入新 GLB，避免多次切換模型後 GPU memory 持續成長。這些 Three.js 細節維持在 scene/core 層，`ModelCatalogService` 只負責款式選擇、載入流程與套色協調。

`ModelResourceDisposer` 會遞迴 traverse 舊模型，並用 `Set` 對共享的 geometry、material、texture 去重，避免同一個資源被重複 dispose。材質 texture 清理不只處理 `map`，也涵蓋 normal、roughness、metalness、ao、emissive、alpha、bump、displacement、env、light、specular、transmission 等常見 texture-like 欄位；scene-level `environmentMap` 不會在模型切換時釋放，只會在 `ThreeRendererHost.dispose()` teardown 時釋放。

depth occluder 會用新的 `MeshBasicMaterial` 取代原材質以只寫入 Depth Buffer。替換前的原材質會暫存在 `mesh.userData.originalOccluderMaterials`，讓模型 dispose 時可連同原材質、其 texture 與新的 occluder material 一起釋放。

`GlbAssetLoader` 的 GLB `ArrayBuffer` 使用小型 LRU cache，最多保留 5 個最近使用的 GLB buffer。cache hit 會刷新 recently-used 順序；新增後超過上限會移除最久未使用項目。解析 GLB 前仍使用 `glbBuffer.slice(0)`，避免 GLTFLoader 修改共用 cache buffer。

## 測試步驟

1. 將原始 `.glb` 放到 `public/models/`。
2. 執行 `npm install`。
3. 執行 `npm run compress:glb`，並確認 `src/config/necklaces.js` 指向 `.draco.glb`。
4. 執行 `npm run dev`。
5. 用瀏覽器開啟 `http://localhost:5173`。
6. 點擊「開始相機」並允許相機權限。
7. 正面看向鏡頭，確認項鍊出現在下巴下方的脖子位置。
8. 左右移動、靠近或遠離鏡頭、輕微歪頭，確認模型會跟隨位置、縮放與傾斜。
9. 開啟「Debug 視覺化」，確認 landmarks、下巴點、脖子估算點與數值資訊有顯示。
10. 確認脖子遮擋模型本身不可見，但項鍊後半段會被脖子深度遮擋。
11. 離開鏡頭，確認項鍊平滑淡出且畫面不卡死。

## Landmark 與脖子估算假設

目前使用的 MediaPipe Face Mesh 點位：

- 下巴：`152`
- 左右臉側：`234` / `454`
- 額頭上方：`10`
- 臉中心備用點：`168`
- 鼻尖備用點：`1`

脖子中心估算：

```text
neck.y = chin.y + faceHeight * neckOffsetFromChin + necklaceVerticalLift
neck.x = chin.x
```

頭部傾斜角使用左右臉側連線角度：

```text
roll = atan2(rightCheek.y - leftCheek.y, rightCheek.x - leftCheek.x)
```

項鍊縮放使用臉寬估算：

```text
scale = blendedFaceWidthWorld * necklaceWidthToFaceWidth
```

其中 `blendedFaceWidthWorld` 會把實測臉寬與臉高推估寬度混合，側臉時更偏向臉高推估值，降低左右臉側距離變短造成的縮放跳動。

## 可調參數

主要追蹤參數集中在 `src/config/tuning.js`：

- `neckOffsetFromChin`：項鍊 anchor 在下巴下方的距離，比例基準是臉高。
- `necklaceWidthToFaceWidth`：項鍊相對臉寬的寬度比例。
- `necklaceVerticalLift`：項鍊垂直微調，負值會往上。
- `scaleWidthFromFaceHeight`：用臉高推估穩定臉寬。
- `scaleWidthMinFromHeight` / `scaleWidthMaxFromHeight`：用臉高推估寬度保護實測臉寬上下限。
- `sideScaleHeightBlend`：側臉時 scale 從實測臉寬混向臉高推估寬度的比例。
- `yawStrength`：側臉時項鍊繞 Y 軸旋轉的強度，數值越大越有側視透視感。
- `yawDirection`：側臉旋轉方向，若轉側臉時項鍊往反方向旋轉，將 `1` 改成 `-1`。
- `yawNoseWeight` / `yawDepthWeight` / `yawDepthStrength`：混合鼻尖水平偏移與臉側深度差的側臉 yaw 訊號。
- `maxYawRadians`：側臉旋轉的最大角度限制，避免極端 landmarks 讓模型翻太多。
- `yawAnchorBlend`：側臉時 anchor 從下巴往臉側中心靠近的比例，數值越大越貼近側邊脖子。
- `yawPositionShift`：側臉時項鍊 anchor 的小幅水平補償。
- `sideViewVerticalLift`：側臉時項鍊 anchor 的垂直補償，負值會往上貼近下顎與脖子交界。
- `smoothing.position`：位置平滑，數值越小越穩但延遲越高。
- `smoothing.scale`：縮放平滑。
- `smoothing.rotation`：旋轉平滑。
- `smoothing.yaw`：側臉 Y 軸旋轉平滑。
- `smoothing.opacity`：淡入淡出平滑。
- `inference`：FaceTracker adaptive FPS 設定，包含 target/min/max FPS、slow/fast frame ratio、調整冷卻時間與平均視窗大小。

模型資產修正參數在 `src/config/necklaces.js`：

- `preserveAuthorOrigin`：是否保留 GLB 作者原點作為 AR anchor。新模型建議設為 `true`。
- `occluderParts.nameIncludes`：哪些物件、mesh 或材質名稱要被視為隱形遮擋模型。
- `baseScale`：模型本身比例修正。
- `offsetX` / `offsetY` / `offsetZ`：模型 anchor 微調。
- `rotationX` / `rotationY` / `rotationZ`：模型朝向修正。

## 模型製作建議

為了更容易對位：

- 項鍊 pivot 建議放在項鍊上緣中心或佩戴中心。
- 整組「脖子 + 項鍊」的 origin 建議放在脖子正面、項鍊佩戴掛點。
- 模型正面應面向相機。
- 模型左右應以 X 軸置中。
- 模型寬度建議接近 1 個 Three.js 單位。
- 脖子遮擋模型建議略大於實際要遮擋的項鍊後半段，避免邊緣漏出。
- 項鍊後半段應在模型空間中位於脖子遮擋模型後方，才能被深度測試擋住。
- 若側臉時項鍊仍太像正面貼圖，優先調高 `yawStrength`；若旋轉太誇張，降低 `yawStrength` 或 `maxYawRadians`。

若模型載入後偏移明顯，可以先用 `src/config/necklaces.js` 微調。如果模型本身 pivot 在遠離項鍊的位置，建議回到 Blender 或建模工具把 origin 設到項鍊上緣中心，再重新匯出 GLB。

## 已知限制

- 目前只支援單人、正面或接近正面的臉部追蹤。
- 脖子位置是由臉部 landmarks 估算，不是真實 3D 脖子重建。
- 目前沒有物理碰撞、衣領互動或高精度人體貼合。
- 脖子遮擋效果依賴 GLB 內的遮擋模型與項鍊前後深度，模型若沒有正確建深度就無法自然遮擋。
- MediaPipe Face Mesh wasm/model 檔已複製到 `public/vendor/mediapipe/face_mesh`，執行時不需要 CDN。
- iOS Safari 上相機權限與 WebGL 表現可能受裝置與系統版本影響。

## 文件語言約定

此專案的 README 與主要維護文件優先使用繁體中文撰寫。必要的技術名詞可以保留英文原文，例如 `Depth Buffer`、`landmarks`、`GLB`、`mesh`、`pivot`，但說明內容應盡量使用中文。

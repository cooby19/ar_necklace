# 如何檢驗（品質閘門與測試覆蓋）

> 要跑哪些檢查、各自覆蓋什麼、哪些只能人工實機。
> 改完任何東西、合併或發布前讀這個檔。

## 負責什麼

列出所有 `package.json` script 的用途與覆蓋邊界，作為「我該跑哪些指令」的速查。原則：優先測純邏輯與低 DOM 依賴，**不在單元測試啟動真實 camera/MediaPipe/WebGL**。

## 指令一覽（皆對應 `package.json` scripts）

| 指令 | 用途 | 前置 |
| --- | --- | --- |
| `npm run lint` | ESLint 檢查 browser ESM、Vite config、測試、Node 腳本 | — |
| `npm run typecheck` | `tsc --noEmit` 漸進式型別邊界（見 [types-and-ts.md](types-and-ts.md)） | — |
| `npm test` | Vitest 單元測試（純邏輯為主） | — |
| `npm run build` | 產出 `dist/` | — |
| `npm run test:visual` | Playwright/Chromium 視覺回歸（gallery / showcase shell / share sheet，桌面/平板/手機） | — |
| `npm run test:visual:update` | 更新 visual baseline（**僅在 Linux/CI**，見下） | — |
| `npm run test:a11y` | Playwright + axe-core，不需相機權限的 UI 狀態 | — |
| `npm run budget` | 檢查 `dist/assets` JS/CSS、`models/*.glb`、MediaPipe 重要資產大小 | 先 `build` |
| `npm run smoke` | synthetic smoke：build artifact 或 `SMOKE_BASE_URL` 遠端 | 先 `build`（本機模式） |
| `npm run smoke:release` | 只做遠端 release/header/cache/asset HTTP 檢查（不開瀏覽器） | `SMOKE_BASE_URL` |
| `npm run lighthouse` | build preview 跑 Lighthouse showcase baseline | 先 `build` |
| `npm run compress:glb` | 產生 `.draco.glb`（見 [concept-model-assets.md](concept-model-assets.md)） | — |
| `npm audit --omit=dev` | 只查 production 依賴（CI 以 warning + report 呈現） | — |

相機權限通常需 `localhost` 或 HTTPS。

## 單元測試覆蓋重點（`npm test`）

- `AppState`：session 合法/不合法 transition、durable state cleanup。
- `RealtimeTrackingStore` / `RendererLoop`：每幀資料、dirty/AR/showcase RAF、背景暫停。
- `router` / `AppRuntimeController` / `RouteUseCase`：hash parse/serialize、URL hydration、pending 顏色、hashchange、URL sync suppression、Gallery↔Experience。
- `TrackingUseCase` / `ModeUseCase` / `RuntimeLifecycleUseCase` / `StageInteractionUseCase`：realtime 寫入與 transition、模式/顯示、背景暫停/預載、舞台指標。
- `ModelCatalogService` / `CalibrationService` / `ShareWorkflow`：色票 target 解析、調參 normalize/load/save/reset、截圖前置阻擋。
- scene 子服務：GLB cache LRU、resource disposal、occluder、材質自訂、placement、showcase presenter。
- 各 UI View 的 `.test.js`。

## CI 閘門（`.github/workflows/ci.yml`，Node 22 / ubuntu）

- `quality`：lint → typecheck → `npm test` → `npm audit --omit=dev`（report artifact）。
- `a11y`：`npx playwright install --with-deps chromium` → `test:a11y`。
- `visual`：同上 → `test:visual`（失敗上傳 `playwright-report/`、`test-results/`）。
- `build`：build → budget → smoke → lighthouse → 上傳 `dist/` artifact（`ar-necklace-dist-<sha>`，30 天）。

## 只能人工實機（CI 無法驗）

相機權限、真實 Face Mesh 追蹤、前後鏡頭切換、iOS Safari 權限與效能。改相機/Face Mesh/WebGL/座標轉換後，用 `npm run dev` 實機驗：項鍊貼合、Debug overlay、occluder 遮擋、離開鏡頭平滑淡出。追蹤細節見 [concept-face-tracking.md](concept-face-tracking.md)。

## Visual baseline 注意

`tests/visual/*-snapshots/` 的 PNG **在 Linux/CI 產生**。**不要在 macOS 重產**（會因字型/算繪差異造成假性 diff）。需更新時用 CI workflow `update-visual-baselines.yml` 或在 Linux 環境跑 `npm run test:visual:update`。

## 部署相關驗證

部署後 smoke 與 rollback 驗證見 [deploy.md](deploy.md)。完整 smoke 檢查清單見 [../deployment.md](../deployment.md)。

## 相關模組

[deploy.md](deploy.md) · [types-and-ts.md](types-and-ts.md) · [concept-face-tracking.md](concept-face-tracking.md) · [../CONTRIBUTING.md](../CONTRIBUTING.md)

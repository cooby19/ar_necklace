# 架構地圖 INDEX（AI 與維護者入口）

> 這是 **Web AR 項鍊試戴 MVP** 的架構地圖總入口。
> 你（AI 或維護者）應該**先讀這一頁**，再依任務只打開 1～2 個模組檔，**不要一次讀完整個 `docs/`**。

## 這是什麼專案

純前端 Web AR 項鍊試戴 MVP（Vite + Three.js + MediaPipe Face Mesh）。使用者開相機後，瀏覽器以相機畫面為背景，用 Face Mesh 偵測單人臉部 landmarks，再用 Three.js 把 `.glb` 項鍊疊在脖子附近。位置是用下巴／臉寬／臉高／頭部傾斜做的 **2D 估算**，不是真實 3D 脖子重建。UI 語言為繁體中文（`zh-Hant`）。

## 怎麼用這份地圖（給 AI 的指示）

1. 先讀本頁的「模組路由表」與「全域護欄」。
2. 依你的任務，從路由表挑出**最相關的那一個模組檔**打開（例如改追蹤效果 → `concept-face-tracking.md`）。
3. 需要跨層脈絡時，再追該模組檔底部「相關模組」的連結；**避免預先把所有檔案都讀進來**。
4. 每個模組檔都用同一組標題：`負責什麼 / 包含什麼 / 如何運作 / 如何部署 / 如何檢驗 / 刪除與修改規範 / 相關模組`。要找「部署」「檢驗」「刪除規範」時，直接跳該標題。
5. 動手前務必看過「全域護欄」，尤其是刪除規範與隱私邊界。

## 分層相依方向

```text
UiRoot intent (src/ui/*)
  → AppRuntimeController (route only, src/app/AppRuntimeController.js)
    → use-cases (src/app/use-cases/*)
      → services / workflow (src/app/*Service.js, ShareWorkflow, ...)
        → core 副作用 (CameraStream / FaceTracker / NecklaceScene+子服務 / CaptureService)
          → public assets (GLB / Draco / MediaPipe vendor)
  ↘ durable state: AppState (src/app/AppState.js)
  ↘ per-frame sampled state: RealtimeTrackingStore
AppState snapshot → UiRoot sync；款式/換色/route change → hash router serialize
```

設計理由與圖（mermaid）見 [`../ARCHITECTURE.md`](../ARCHITECTURE.md)；長期決策見 [`../adr/`](../adr/)。

## 模組路由表

| 模組檔 | 何時該讀 | 對應程式路徑 |
| --- | --- | --- |
| [app-layer.md](app-layer.md) | 改 controller / use-case / service / 狀態 / router / reducer | `src/app/*` |
| [core-layer.md](core-layer.md) | 改相機、Face Mesh、Three.js scene、校準、平滑、debug overlay | `src/core/*` |
| [ui-layer.md](ui-layer.md) | 改 DOM、畫面區塊、各 View、focus/a11y | `src/ui/*`、`src/styles/*` |
| [config-layer.md](config-layer.md) | 改款式、調參、資產 URL、release/site 注入 | `src/config/*` |
| [types-and-ts.md](types-and-ts.md) | 加型別、查漸進式 TypeScript 邊界 | `src/types/*`、`tsconfig.json` |
| [telemetry.md](telemetry.md) | 改錯誤上報、確認隱私邊界 | `src/telemetry/*` |
| [public-assets.md](public-assets.md) | 改 GLB / Draco / MediaPipe vendor / icons / `_headers` / manifest | `public/*` |
| [concept-session-lifecycle.md](concept-session-lifecycle.md) | 改 AR session 狀態機、live tracking data 清理 | `AppState.js`、`RealtimeTrackingStore.js` |
| [concept-routing-deeplinks.md](concept-routing-deeplinks.md) | 改 Gallery↔Experience 路由、`#n/#c/#c.<target>` 深連結、URL 同步 | `router.js`、`RouteUseCase.js`、`main.js` |
| [concept-face-tracking.md](concept-face-tracking.md) | 改追蹤效果、landmark/脖子估算、tuning 調參 | `core/NecklaceController.js`、`config/tuning.js`、`utils/landmarks.js` |
| [concept-color-customization.md](concept-color-customization.md) | 改換色、`Colorable_*` 材質、palette/target | `config/necklaces.js`、`core/MaterialCustomizationEngine.js` |
| [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md) | 改模型載入/釋放、GLB cache、occluder、scene dispose | `core/NecklaceScene.js` + scene 子服務 |
| [concept-model-assets.md](concept-model-assets.md) | 新增/替換 GLB、壓縮、建模對位、occluder 命名 | `public/models/*`、`scripts/compress-glb.mjs` |
| [deploy.md](deploy.md) | 部署、CI/CD、secrets、headers/cache、rollback | `.github/workflows/*`、`public/_headers`、`vite.config.js` |
| [verify.md](verify.md) | 要跑哪些檢查、各測試覆蓋什麼、人工驗收項目 | `package.json` scripts、`tests/*`、`scripts/*` |
| [conventions.md](conventions.md) | 協作/維護規範、**刪除要求**、commit/PR、文件語言 | 全 repo |

## 全域護欄（動手前必讀，細節見 [conventions.md](conventions.md)）

- **刪除規範**：禁止批量刪除檔案／目錄；不得用 `rm -rf`、`del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`。要刪只能一次刪一個明確路徑；需批量刪除時**停手，改請使用者手動處理**。
- **隱私邊界**：不得上傳相機畫面、截圖 Blob/data URL、Face Mesh landmarks 或 debugData 到任何 telemetry。
- **純前端**：維持純前端架構，不引入後端或新依賴，除非需求明確要求。
- **controller 輕量**：`AppRuntimeController` 只做 routing；新副作用放對應 use-case / service / workflow（見 [ADR-0004](../adr/0004-runtime-use-cases.md)）。
- **文件語言**：README 與維護文件優先繁體中文，技術名詞可保留英文。
- **單一事實來源**：細節只寫在 `docs/map/` 模組檔；`AGENTS.md`、`README.md` 只導覽、不複製內容，避免 drift。

## 深入參考（非地圖，但權威）

- [`../ARCHITECTURE.md`](../ARCHITECTURE.md)：分層設計理由與 mermaid 圖。
- [`../CONTRIBUTING.md`](../CONTRIBUTING.md)：commit / PR / TypeScript 遷移細則。
- [`../deployment.md`](../deployment.md)：完整部署、rollback、headers/cache、SEO 發布細則。
- [`../assets-compression.md`](../assets-compression.md)：GLB Draco 壓縮細節。
- [`../adr/`](../adr/)：0001 Cloudflare Pages、0002 漸進式 TypeScript、0003 MediaPipe CSP、0004 runtime use-cases。

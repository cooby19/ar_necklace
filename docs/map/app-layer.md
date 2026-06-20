# app 層（src/app/*）

> 應用流程的大腦：狀態、路由、controller、use-case、service、workflow。
> 改「使用者做了什麼 → 狀態怎麼變 → 該呼叫哪個副作用」時讀這個檔。

## 負責什麼

把 UI intent 轉成 durable state 變更與 core 副作用，並維持嚴格分層：

- **狀態**：`AppState`（durable UI state）、`RealtimeTrackingStore`（每幀取樣 state）。
- **routing layer**：`AppRuntimeController` 只把 UI handler route 到 use-case，不直接執行副作用。
- **use-case**：每個應用流程一個檔（模式、相機、追蹤、模型、校準、分享、舞台、生命週期、route）。
- **service / workflow**：包裝較重的子系統（AR session、模型 catalog、校準、分享、追蹤回饋、render loop）。
- **URL state**：`router.js` 純函式 hash router；`app-intents.ts` / `app-reducer.ts` 為純函式 intent → patch。

## 包含什麼

狀態與組裝：
- `AppState.js`（+`.test`）：`APP_MODES`、`APP_ROUTES`、`AR_SESSION_STATES`、合法 session 轉換、durable snapshot 與 stale data 清理。
- `RealtimeTrackingStore.js`（+`.test`）：每幀 landmarks / debugData / hasFace / frame sequence / tracker stats / render stats。
- `createAppRuntime.js`（+`.test`）：建立 scene、necklaceController、debugOverlay、rendererLoop、modelCatalog、calibrationService、shareWorkflow、feedbackService 並回傳 `AppRuntime`。
- `AppRuntimeController.js`（+`.test`）：對外 handler surface（`selectMode`、`enterExperience`、`showGallery`、`startExperience`、`switchCamera`、`stopExperience`、`selectNecklace`、`selectColor`、`handleCapture`…）+ URL hydration 協調。

純函式 / URL：
- `router.js`（+`.test`）：`parseUrlState` / `serializeUrlState` / `installRouter`。**不得** import `AppState`、controller 或 use-case，也不得引入 router library。
- `app-intents.ts`：`AppIntent` 聯合型別（mode/panel/bottom-sheet/debug/necklace-visibility）。
- `app-reducer.ts`（+`.test`）：`reduceAppIntent(state, intent)` → `none` / `patch` / `session-transition`。

use-case（`src/app/use-cases/*`，皆有 `.test`）：
- `ModeUseCase`：模式切換、panel/bottom sheet、debug toggle、項鍊顯示副作用。
- `RouteUseCase`：Gallery↔Experience 路由（`enterExperience` / `showGallery`）。
- `CameraSessionUseCase`：啟動/停止/切換相機、Face Mesh 載入與重試、session service 預載。
- `TrackingUseCase`：接 Face Mesh result → 寫 realtime store → 只在 live face status 變化時 transition。
- `ModelUseCase`：款式選擇、GLB 載入、套色、載入後 mode effect、色票可用性。
- `CalibrationUseCase`：拖曳校準、調參 controls、save/reset/load、提示狀態。
- `ShareUseCase`：截圖、下載、native share fallback、分享狀態。
- `StageInteractionUseCase`：區分 showcase 拖曳旋轉與 AR 校準拖曳。
- `RuntimeLifecycleUseCase`：初始化、頁面背景暫停/恢復、render loop start、AR session 預載。

service / workflow：
- `ArSessionService.js`（+`.test`）：包 `CameraStream` + `FaceTracker`，管 start/stop/switch/selfie/session reset。
- `ModelCatalogService.js`（+`.test`）：款式查找、載入序列、可換色 target、預設色票、`NecklaceScene.applyColor()` 協調。
- `RendererLoop.js`（+`.test`）：dirty render、AR live RAF、showcase 自轉 RAF、背景暫停、render FPS。
- `CalibrationService.js`（+`.test`）：`WearCalibration`、拖曳校準、normalize、save/reset/load、提示。
- `ShareWorkflow.js`（+`.test`）：截圖前置檢查、capture、download、native share fallback。
- `TrackingFeedbackService.js`：組裝 tracker stats、render FPS、`FaceQualityAdvisor` 建議、developer panel 與 debug/status 文字。
- `CaptureService.js`：畫面合成截圖（由 `main.js` 建立後注入 runtime）。

## 如何運作

`main.js` 建立 `AppState` + `UiRoot` + `CaptureService`，動態 import `createAppRuntime` 與 `AppRuntimeController`，把 UI handler 綁到 controller，再 `controller.init()`。`init()` 會：解析 hash → `applyInitialUrlState` → populate UI → 載入款式 → 套 pending 顏色 → 綁頁面生命週期 → 啟動 render loop → 安裝 hash router。詳細流程見 [concept-session-lifecycle.md](concept-session-lifecycle.md) 與 [concept-routing-deeplinks.md](concept-routing-deeplinks.md)。

## 如何部署

不直接部署。release metadata 注入見 [config-layer.md](config-layer.md)；部署流程見 [deploy.md](deploy.md)。

## 如何檢驗

`npm test`（Vitest）覆蓋本層大多數純邏輯：session transition、router parse/serialize、controller URL hydration、reducer、realtime store、各 use-case 與 service。完整指令與覆蓋見 [verify.md](verify.md)。

## 刪除與修改規範

- **不要**把 camera/session、模型 catalog/color、render loop、校準、分享、telemetry 組裝塞回 `AppRuntimeController`；新功能放對應 use-case / `*Service.js` / `*Workflow.js`（見 [ADR-0004](../adr/0004-runtime-use-cases.md)）。
- **不要**把 router 邏輯放進 `AppState.js`；`router.js` 維持純函式 + `hashchange` 綁定，不持有 app state 或 suppression flag。
- 調整 session lifecycle 時，先更新 `AR_SESSION_STATES`、合法 transition 與 stale data 清理，不要只用零散 patch。
- 刪檔遵守[全域刪除規範](conventions.md)；移除任何 use-case/service 前，先確認 `AppRuntimeController` 與 `createAppRuntime.js` 的引用已一併處理。

## 相關模組

[core-layer.md](core-layer.md) · [ui-layer.md](ui-layer.md) · [concept-session-lifecycle.md](concept-session-lifecycle.md) · [concept-routing-deeplinks.md](concept-routing-deeplinks.md) · [types-and-ts.md](types-and-ts.md) · [ADR-0004](../adr/0004-runtime-use-cases.md)

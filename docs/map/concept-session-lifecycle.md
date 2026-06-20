# 概念：AR session 狀態機與即時資料

> AR session 的合法狀態、轉換與「每幀資料 vs durable 狀態」的分工。
> 改相機/追蹤流程、狀態切換或 stale data 清理時讀這個檔。

## 負責什麼

用 `sessionStatus` 表達 AR session lifecycle（避免 patch-based state 產生不合法組合），並把每幀取樣資料與 durable UI state 分開存放，避免 Face Mesh 每幀觸發整個 UI 重新同步。

## 包含什麼

- `src/app/AppState.js`：`AR_SESSION_STATES`、`SESSION_TRANSITIONS`（合法轉換白名單）、durable snapshot 與 stale data 清理。
- `src/app/RealtimeTrackingStore.js`：每幀 landmarks / debugData / hasFace / frame sequence / trackerStats / renderStats。
- 寫入者：`TrackingUseCase`、`RendererLoop`、`CameraSessionUseCase`（見 [app-layer.md](app-layer.md)）。

## 如何運作

狀態（`AR_SESSION_STATES`）：`showcase`、`arIdle`、`cameraStarting`、`trackingStarting`、`trackingError`、`noFace`、`tracking`、`capturing`、`sharing`、`error`。

典型流程：

```text
showcase → arIdle → cameraStarting → trackingStarting → noFace ⇄ tracking → capturing → sharing
```

- `showcase`：3D 展示，相機未啟動。
- `arIdle`：AR 模式但相機未啟動。
- `cameraStarting`：啟動/切換相機中，清舊 landmarks/debug data。
- `trackingStarting`：相機已開、Face Mesh 初始化中。
- `trackingError`：相機成功但 Face Mesh/MediaPipe 初始化失敗——保留 live preview，允許只重試臉部追蹤初始化。
- `noFace`：相機運作但目前無臉部資料，清舊 debug data 與 landmarks。
- `tracking`：有 landmarks，項鍊依模型與校準貼合。
- `capturing` / `sharing`：截圖與分享，保留 live tracking data 供畫面/debug 使用。
- `error`：相機/模型/截圖/分享錯誤；相機已停則同步清臉部資料。

分工：`AppState` 存 durable state（mode、route、sessionStatus、cameraStarted、selectedNecklace、debugEnabled、capture/share、adjustments…）；每幀資料只在 `RealtimeTrackingStore`。UI 只訂閱 `AppState` 與節流後的 realtime snapshot。

## 如何部署

不適用（純 runtime 狀態邏輯）。

## 如何檢驗

`npm test` 的 `AppState.test.js`（合法/不合法 transition、durable state cleanup）、`RealtimeTrackingStore.test.js`、`TrackingUseCase.test.js`、`RendererLoop.test.js`（背景暫停/恢復）。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- 調整 lifecycle 時**先**更新 `AR_SESSION_STATES`、`SESSION_TRANSITIONS` 與 stale data 清理規則，不要只用零散 patch。
- 離開相機、切換鏡頭或進入背景時**必須**重設 `RealtimeTrackingStore`，避免相機已關卻殘留舊追蹤資料。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[app-layer.md](app-layer.md) · [concept-routing-deeplinks.md](concept-routing-deeplinks.md) · [concept-face-tracking.md](concept-face-tracking.md) · [core-layer.md](core-layer.md)

# core 層（src/core/*）

> 可重用的低階核心：相機、Face Mesh、Three.js 場景與子服務、穿戴校準、平滑、debug 繪製。
> 改相機/追蹤演算法/WebGL 行為時讀這個檔。

## 負責什麼

包裝外部或低階 API，提供明確方法與錯誤，**不反向依賴 UI**，**不上傳或保存相機影像**。app 層的 use-case/service 透過這些模組產生副作用。

## 包含什麼

相機與追蹤：
- `CameraStream.js`：包 `getUserMedia`、video 播放/停止。
- `FaceTracker.js`（+`.test`）：包 MediaPipe Face Mesh 初始化、每幀送 video、結果/錯誤回呼、adaptive FPS。
- `NecklaceController.js`：把 landmarks 轉成項鍊位置、比例、旋轉、透明度（呼叫 `computeFaceMetrics()`）。
- `FaceQualityAdvisor.js`：依臉部品質產生使用者提示文字。
- `WearCalibration.js`：穿戴校準值（位移/縮放/旋轉）的純邏輯。
- `Smoother.js`：標量與向量線性平滑器。
- `DebugOverlay.js`：在 2D canvas 畫 landmarks、下巴、脖子估算點、臉寬線與 debug 文字。

Three.js 場景（facade + 子服務，scene 細節維持在本層）：
- `NecklaceScene.js`（+`.test`）：scene **facade**，協調以下子服務、暴露 `loadNecklace` / `applyColor` / `dispose`。
- `GlbAssetLoader.ts`（+`.test`）：載入/驗證/解析 GLB，維護 CPU 端 ArrayBuffer LRU cache 與 timing。
- `ThreeRendererHost.js`（+`.test`）：封裝 renderer、orthographic camera、燈光、RoomEnvironment/PMREM、resize observer。
- `NecklacePlacementAdapter.js`（+`.test`）：`necklaceRoot`、模型正規化、作者原點保留、screen/world 座標、AR/showcase transform。
- `OccluderProcessor.js`（+`.test`）：依名稱標記 depth occluder，用只寫 depth 的材質替換原材質。
- `MaterialCustomizationEngine.js`（+`.test`）：gem 材質調校、可換色材質收集、透明度與套色。
- `ModelResourceDisposer.js`（+`.test`）：遞迴釋放 geometry/material/texture，避免釋放 scene-level environment map。
- `ShowcasePresenter.ts`（+`.test`）：展示模式自轉、拖曳旋轉、展示 transform。

## 如何運作

- 追蹤資料流：`FaceTracker` 每幀回 results → `TrackingUseCase` 寫入 `RealtimeTrackingStore` → `NecklaceController.updateFromLandmarks()` → `NecklaceScene` 更新項鍊 group。演算法假設與調參見 [concept-face-tracking.md](concept-face-tracking.md)。
- 模型資源生命週期（載入/釋放/cache/occluder）見 [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md)。

## 如何部署

不直接部署。core 依賴的 runtime 資產（GLB / Draco / MediaPipe vendor）見 [public-assets.md](public-assets.md)。

## 如何檢驗

`npm test` 覆蓋不啟動真實 WebGL/相機/MediaPipe 的純邏輯：GLB cache LRU、resource disposal、occluder、材質自訂、renderer host、placement adapter、showcase presenter、FaceTracker stats。改相機/Face Mesh/座標轉換建議再用 `npm run dev` 實機驗。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- scene 細節（geometry/material/texture disposal）**只**留在本層；`ModelCatalogService` 只做款式選擇、載入流程與套色協調。
- `NecklaceScene.dispose()` 必須可安全重複呼叫。
- 改追蹤效果時，**先**調 [`config/tuning.js`](config-layer.md) 與 `config/necklaces.js`，再考慮改核心演算法。
- 刪檔遵守[全域刪除規範](conventions.md)；移除任何 scene 子服務前，先確認 `NecklaceScene.js` facade 的引用一併調整。

## 相關模組

[app-layer.md](app-layer.md) · [concept-face-tracking.md](concept-face-tracking.md) · [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md) · [concept-color-customization.md](concept-color-customization.md) · [public-assets.md](public-assets.md)

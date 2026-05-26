# 專案筆記：Web AR Necklace MVP

重要導覽：架構設計與分層理由請先查 `docs/ARCHITECTURE.md`，長期決策請查 `docs/adr/`，本機開發與 PR 規範請查 `docs/CONTRIBUTING.md`。README 與本文件應只描述真實存在的檔案與入口。

## 專案概覽

這是一個純前端的 Web AR 項鍊試戴 MVP。使用者開啟相機後，瀏覽器以相機畫面作為背景，透過 MediaPipe Face Mesh 偵測單人臉部 landmarks，再用 Three.js 疊加 `.glb` 項鍊模型。項鍊位置不是精準 3D 脖子重建，而是依據下巴、臉寬、臉高與頭部傾斜估算出脖子附近的位置。

目前 UI 語言主要是繁體中文，HTML 語系為 `zh-Hant`。

## 技術棧

- Vite 5，入口為 `index.html` 與 `src/main.js`。
- Three.js 用於 WebGL 場景、正交相機、燈光與 GLB 模型載入。
- `@mediapipe/face_mesh` 用於臉部 landmark 偵測。
- MediaPipe wasm/model 等執行資產已 vendored 到 `public/vendor/mediapipe/face_mesh`，執行時不依賴 CDN。
- 預設項鍊 runtime 模型位於 `public/models/necklace.draco.glb`，原始 `public/models/necklace.glb` 保留作為 fallback 與重新壓縮來源。設定入口為 `src/config/necklaces.js`。runtime URL 需透過 `src/config/assets.js` 的 `versionedPublicAssetUrl()` 組合，避免 preview、子路徑 hosting 或 CDN cache 造成資產載入錯誤。
- 樣式入口為 `src/styles/index.css`，再拆成 reset、tokens、layout、states、responsive 與 `src/styles/components/*`。
- Runtime release metadata 由 `vite.config.js` 注入，`src/config/release.js` 讀取，build 後會產生 `dist/release.json`。
- `src/telemetry/RuntimeErrorReporter.js` 提供 optional Sentry-compatible error reporting；不得上傳相機畫面、截圖 Blob/data URL 或 Face Mesh landmarks。
- TypeScript 採漸進式 strict boundary：`tsconfig` 使用 `allowJs: true`、`checkJs: false`、`strict: true`，檢查局部 `// @ts-check` 的 `.js`、`.ts` 檔案與 `vite.config.js`。

## 常用命令

```bash
npm install
npm run dev
npm run lint
npm test
npm run build
npm run typecheck
npm run test:visual
npm run test:a11y
npm run budget
npm run smoke
npm run lighthouse
npm run preview
```

- `npm run dev` 執行 `vite --host 0.0.0.0`，設定 port 為 `5173`。
- `npm run lint` 使用 ESLint 檢查 browser ESM、Vite config、測試與 Node 腳本。
- `npm test` 執行 Vitest 單元測試，主要覆蓋不需相機、MediaPipe 或 WebGL 的純邏輯。
- `npm run build` 產出到 `dist/`。
- `npm run typecheck` 執行 `tsc --noEmit`，檢查 `src/**/*`、`vite.config.js`、局部 `// @ts-check` 與 `.ts` 檔案。
- `npm run test:visual` 用 Playwright/Chromium 檢查 showcase 與分享預覽的桌面、平板、手機截圖。
- `npm run test:a11y` 用 Playwright + axe-core 檢查不需相機權限的 UI 狀態。
- `npm run budget` 檢查 build 後 JS/CSS、GLB 與 MediaPipe 重要資產大小，需先 `npm run build`。
- `npm run smoke` 對 build artifact 或 `SMOKE_BASE_URL` 遠端部署做 synthetic smoke。
- `npm run smoke:release` 只做遠端 release/asset HTTP 檢查，適合 rollback 或快速 CDN 探測。
- `npm run lighthouse` 用 build 後 preview 跑 Lighthouse showcase baseline。
- 相機權限通常需要 `localhost` 或 HTTPS。

## 目錄結構重點

- `index.html`：頁面骨架，包含相機 video、Three.js canvas、debug canvas、狀態面板與控制側欄。
- `docs/ARCHITECTURE.md`：架構設計、分層圖、資料流、MediaPipe 取捨與暫時性妥協。
- `docs/CONTRIBUTING.md`：本機指令、commit message、PR checklist 與漸進式 TypeScript 規則。
- `docs/adr/`：Cloudflare Pages、漸進式 TypeScript、MediaPipe CSP 與 runtime use-case 邊界等決策記錄。
- `src/main.js`：應用程式入口，載入樣式、安裝 runtime error reporter、注入 release metadata，並串接 `AppState`、`UiRoot`、`CaptureService`、runtime services 與 `AppRuntimeController`。
- `src/styles/index.css`：全站樣式入口，匯入 reset、tokens、layout、states、responsive 與 component CSS。
- `src/styles/components/*`：控制列、舞台、按鈕、色票、底部面板、分享面板、校準與 developer panel 等 UI 模組樣式。
- `src/config/assets.js`：用 `import.meta.env.BASE_URL` 與 release token 產生 public asset URL。
- `src/config/release.js`：讀取 build-time 注入的 release metadata，供 console、debug panel、smoke 與 error reporting 使用。
- `src/config/tuning.js`：臉部追蹤、項鍊位置、縮放、平滑與 debug 顯示的主要調參位置。
- `src/config/necklaces.js`：項鍊款式清單、每個 GLB 的模型修正參數與顏色自選設定。
- `src/telemetry/RuntimeErrorReporter.js`：全域 error/unhandled rejection/resource load error 與模型、MediaPipe、WebGL 錯誤上報邊界。
- `src/utils/landmarks.js`：Face Mesh landmark index、距離、插值、clamp 與臉部量測邏輯。
- `src/ui/UiRoot.js`：DOM query、event binding、render helper、focus trap 與 UI 同步的 root。
- `src/app/AppRuntimeController.js`：UI handler routing layer，保留 `src/main.js` 綁定 surface，將副作用轉發到 use-case。
- `src/app/createAppRuntime.js`：建立 scene、controller、renderer loop、model catalog、calibration、share 與 tracking feedback 等 runtime services。
- `src/app/use-cases/*`：模式、相機、追蹤、模型、校準、分享、舞台互動與 runtime lifecycle 的 use-case orchestration。
- `src/app/*.test.js`：Vitest 輕量單元測試，優先保護 AppState session lifecycle、model catalog/color、校準與分享前置檢查等純邏輯。
- `src/app/ArSessionService.js`：管理 `CameraStream` 與 `FaceTracker` lifecycle、鏡頭切換、selfie mode 與 session reset。
- `src/app/ModelCatalogService.js`：管理項鍊選擇、模型載入序列、可換色 target、預設色票與套色流程。
- `src/app/RealtimeTrackingStore.js`：保存每幀 landmarks、debugData、FaceTracker stats 與 render stats，避免 FaceMesh result 每幀觸發 DOM 全量同步。
- `src/app/RendererLoop.js`：管理 `requestAnimationFrame`、render FPS、showcase update、scene render 與 debug overlay render。
- `src/app/CalibrationService.js`：管理 `WearCalibration`、拖曳校準、調參 normalize、save/reset/load 與提示狀態。
- `src/app/ShareWorkflow.js`：管理截圖前置檢查、capture、download、native share fallback 與分享狀態資料。
- `src/app/TrackingFeedbackService.js`：組裝 FaceTracker stats、render FPS、FaceQualityAdvisor advice、developer panel 與 debug/status 文字。
- `src/core/CameraStream.js`：封裝 `getUserMedia`、video 播放與停止。
- `src/core/FaceTracker.js`：封裝 MediaPipe Face Mesh 初始化、每幀送入 video、結果回呼與錯誤回呼。
- `src/core/NecklaceController.js`：把 landmarks 轉成項鍊位置、比例、旋轉與透明度。
- `src/core/NecklaceScene.js`：已拆成 facade，協調 GLB 載入、遮擋處理、材質自訂、場景定位、showcase 與 renderer host。
- `src/core/GlbAssetLoader.ts`：載入/驗證/解析 GLB，維護 CPU 端 ArrayBuffer LRU cache 與載入 timing。
- `src/core/ThreeRendererHost.js`：封裝 Three.js renderer、orthographic camera、燈光、RoomEnvironment/PMREM 與 resize observer。
- `src/core/NecklacePlacementAdapter.js`：管理 `necklaceRoot`、模型正規化、作者原點保留、screen/world 座標轉換與 AR/showcase transform。
- `src/core/OccluderProcessor.js`：依名稱比對標記 depth occluder，並用只寫 depth 的材質替換原材質。
- `src/core/MaterialCustomizationEngine.js`：管理 gem 材質調校、可換色材質收集、透明度與套色。
- `src/core/ModelResourceDisposer.js`：遞迴釋放模型 geometry/material/texture，並避免釋放 scene-level environment map。
- `src/core/ShowcasePresenter.ts`：模型展示模式的自轉、拖曳旋轉與展示 transform。
- `src/core/*.test.js`：覆蓋 GLB cache、resource disposal、occluder、材質自訂、renderer host、placement adapter 與 showcase presenter 等不啟動真實 WebGL 的邏輯。
- `src/core/Smoother.js`：標量與向量的線性平滑器。
- `src/core/DebugOverlay.js`：在 2D canvas 上畫 landmarks、下巴、脖子估算點、臉寬線與 debug 文字。
- `src/types/domain.ts`：共享 domain types，包含 AppState snapshot、MediaPipe/landmark、tracking/debug、config schema、render stats、capture/share、workflow status 與 release/error reporting 資料形狀。
- `src/types/app-ports.ts`、`src/types/ui-ports.ts`、`src/types/scene-ports.ts`：App/UI/scene 邊界 port types，避免把大型實作 surface 外洩到全專案。
- `tests/visual/*`：Playwright 視覺回歸測試與 snapshot。
- `tests/a11y/*`：Playwright + axe-core 無障礙測試。
- `scripts/*`：bundle budget、synthetic smoke、release smoke 與 Lighthouse 腳本。
- `.github/workflows/*`：CI、Cloudflare Pages deploy skeleton 與 rollback skeleton。
- `public/models/README.md`：項鍊 GLB 模型放置與建模對位建議。
- `dist/`：建置輸出，已在 `.gitignore` 中忽略。
- `node_modules/`：依賴目錄，已在 `.gitignore` 中忽略。

## 漸進式 TypeScript 邊界

目前專案不做一次性 TypeScript 轉換，也不要打開全域 `checkJs`。型別策略是先保護 runtime 資料形狀容易錯接的低噪音邊界，再逐步擴張。

已納入局部 `// @ts-check` 的重點範圍：

- AppState 與 AR session lifecycle。
- config schema：`tuning`、`necklaces`。
- model/color service、calibration、share workflow。
- MediaPipe results 到 `FaceTracker`、`ArSessionService`、`TrackingUseCase`、`NecklaceController`、`computeFaceMetrics` 的資料流。
- pure logic：landmarks、Smoother、WearCalibration、FaceQualityAdvisor。
- 低噪音 service/debug/render/capture boundary：RealtimeTrackingStore、RendererLoop、TrackingFeedbackService、CameraStream、DebugOverlay、stageResize、CaptureService。
- scene boundary：NecklaceScene facade、GlbAssetLoader、ThreeRendererHost、NecklacePlacementAdapter、OccluderProcessor、MaterialCustomizationEngine、ModelResourceDisposer、ShowcasePresenter 與 `src/types/scene-ports.ts`。
- telemetry boundary：RuntimeErrorReporter 的 public status、release metadata 與 sanitized error context。
- shared domain types：`src/types/domain.ts`。

仍刻意未完整型別化的區域：

- `src/ui/UiRoot.js`：DOM query、event binding、render helper 與 focus trap 噪音高。若要推進，先抽小型 DOM helper 或 view helper，再分段加 `// @ts-check`。
- `src/main.js` 與 `src/app/*.test.js` / `src/core/*.test.js`：可作為下一階段低成本補強，但不應牽動整體架構。

新增型別時優先把跨檔案共享的資料形狀放入 `src/types/domain.ts`。若只描述某個 service 依賴物件的少量方法，優先放入對應的 `src/types/app-ports.ts`、`src/types/ui-ports.ts` 或 `src/types/scene-ports.ts`，或使用該檔案內的 local port/interface。避免把 `UiRoot` 或大型 Three.js 實作 surface 暴露到全專案。

## 執行流程

1. `src/main.js` 載入 `src/styles/index.css`、安裝 `runtimeErrorReporter`、初始化 `AppState`、`UiRoot`、`CaptureService`、runtime services 與 `AppRuntimeController`，並把 release/error-reporting public metadata 暴露到 `window`。
2. 啟動時先依 `NECKLACES[0]` 載入預設模型。
3. `ModelCatalogService` 協調 `NecklaceScene.loadNecklace()` 載入模型，並套用目前款式的預設顏色設定。
4. `RendererLoop` 啟動 render loop，負責 showcase update、Three.js render 與 debug overlay render。
5. 使用者點擊「開始相機」後，`CameraSessionUseCase` 將 `AppState.sessionStatus` 切到 `cameraStarting`，再交給 `ArSessionService` 啟動相機與 Face Mesh。
6. `ArSessionService` 透過 `CameraStream` 要求鏡頭權限，依實際鏡頭設定 `FaceTracker.selfieMode`，再啟動 Face Mesh frame processing。
7. 偵測結果回到 `TrackingUseCase` 後，先寫入 `RealtimeTrackingStore`，再只在需要時提交 `noFace` / `tracking` 狀態與呼叫 `NecklaceController.updateFromLandmarks()`。
8. `NecklaceController` 呼叫 `computeFaceMetrics()`，根據下巴位置、臉高、臉寬、roll、yaw 與校準值計算項鍊 transform。
9. `NecklaceScene` 更新項鍊 group 的 position、scale、rotation 與材質 opacity。若款式設定 `preserveAuthorOrigin: true`，GLB 作者原點會保留為 AR anchor。
10. `TrackingFeedbackService` 從節流後的 realtime snapshot 組裝追蹤狀態、debug panel 與 FaceQualityAdvisor 提示；未偵測到臉或關閉顯示項鍊時，項鍊會平滑淡出。

## AR Session 狀態

`AppState` 仍保存一般 UI 狀態與資料，但 AR session lifecycle 使用 `sessionStatus` 表達，避免 patch-based state 產生不合法組合。

合法流程大致為：

```text
showcase -> arIdle -> cameraStarting -> noFace <-> tracking -> capturing -> sharing
```

- `showcase`：3D 模型展示模式，相機未啟動。
- `arIdle`：AR 模式但相機尚未啟動。
- `cameraStarting`：正在啟動或切換相機，會清除舊 landmarks/debug data。
- `noFace`：相機運作中但目前無可用臉部資料，會清除舊 debug data 與 landmarks。
- `tracking`：有臉部 landmarks，項鍊可依目前模型與校準值貼合。
- `capturing` / `sharing`：截圖與分享流程狀態，會保留 live tracking data 供畫面與 debug 使用。
- `error`：相機、模型、截圖或分享錯誤。若相機已停止，狀態轉換會同步清掉臉部資料。
- 每幀 landmarks、debugData、tracker stats 與 render stats 放在 `RealtimeTrackingStore`，不是 durable `AppState`。離開相機、切換鏡頭或進入背景時需重設 store，避免舊追蹤資料殘留。

## 項鍊顏色自選

顏色自選保持純前端實作，設定入口在 `src/config/necklaces.js` 的每個款式 `colorCustomization`。

- `palette`：色票清單，目前預設包含粉晶、月光石、黃水晶、紫水晶等寶石語意色票；每個色票可附 `meaning` 與 `material` 調校資料。
- `defaultColor`：使用者切換到該款式後自動套用的預設色票 id。
- `defaultTarget`：預設套色目標，通常使用 `all`，表示套用所有找到的可換色材質。
- `targets`：可換色材質群組，每個群組用 `materialNameIncludes` 比對 GLB material name。

目前約定的 GLB material name 關鍵字：

- `Colorable_Metal`：金屬鍊身、扣件或主要金屬部分。
- `Colorable_Pendant`：墜飾主體。
- `Colorable_Gem`：寶石、水晶或可換色裝飾件。

`NecklaceScene` 載入模型後會收集符合上述名稱的材質，並透過 `applyColor(target, color)` 改變 `material.color`。套色時只改顏色，不應覆蓋或移除原本的 `normalMap`、`roughnessMap`、`metalnessMap`、`aoMap`、`opacity` 等材質設定。

如果 GLB 沒有找到任何可換色材質，控制欄會顯示溫和提示並停用色票，但相機、Face Mesh、追蹤、debug overlay 與模型試戴仍應正常運作。新增或替換模型時，若希望啟用換色，請在建模工具中替對應 material 命名加入上述 `Colorable_*` 關鍵字後重新匯出 GLB。

## Landmark 與追蹤假設

目前採用的 MediaPipe Face Mesh 點位：

- 額頭：`10`
- 下巴：`152`
- 左臉側：`234`
- 右臉側：`454`
- 鼻尖 fallback：`1`
- 臉中心 fallback：`168`

核心估算邏輯：

- 臉寬：左右臉側的 2D 距離。
- 臉高：額頭到下巴的 2D 距離。
- 頭部傾斜：左右臉側連線的 `atan2`。
- 側臉 yaw：鼻尖相對左右臉側中心的水平偏移與左右臉側 Z 深度差混合，乘上 `yawStrength` 後 clamp 到 `maxYawRadians`。
- 脖子中心：正面時以 `chin.y + faceHeight * neckOffsetFromChin + necklaceVerticalLift` 為基準；側臉時會依 `yawAnchorBlend`、`yawPositionShift` 與 `sideViewVerticalLift` 往臉側中心補償。
- 項鍊 scale：world space 臉寬與臉高推估寬度混合後乘上 `necklaceWidthToFaceWidth`，再 clamp 在 `0.18` 到 `2.4`。

## 調參位置

追蹤行為主要調整 `src/config/tuning.js`：

- `neckOffsetFromChin`：項鍊 anchor 在下巴下方的距離，比例基準是臉高。
- `necklaceWidthToFaceWidth`：項鍊相對臉寬的寬度比例。
- `necklaceVerticalLift`：項鍊垂直微調，負值往上。
- `scaleWidthFromFaceHeight`：用臉高推估穩定臉寬，降低側臉時左右臉側點距離變短造成的縮放跳動。
- `scaleWidthMinFromHeight` / `scaleWidthMaxFromHeight`：用臉高推估寬度對實測臉寬做上下限保護。
- `sideScaleHeightBlend`：側臉時 scale 從實測臉寬混向臉高推估寬度的比例。
- `yawStrength`：側臉時項鍊繞 Y 軸旋轉的強度。
- `yawDirection`：側臉旋轉方向，若模型往反方向轉可在 `1` 和 `-1` 間切換。
- `yawNoseWeight` / `yawDepthWeight` / `yawDepthStrength`：混合鼻尖水平偏移與臉側深度差的 yaw 訊號。
- `maxYawRadians`：側臉 Y 軸旋轉最大值。
- `yawAnchorBlend`：側臉時 anchor 從下巴往臉側中心靠近的比例。
- `yawPositionShift`：側臉時項鍊 anchor 的小幅水平補償。
- `sideViewVerticalLift`：側臉時項鍊 anchor 的垂直補償。
- `smoothing.position`：位置平滑，數值越小越穩但延遲越高。
- `smoothing.scale`：縮放平滑。
- `smoothing.rotation`：旋轉平滑。
- `smoothing.yaw`：側臉旋轉平滑。
- `smoothing.opacity`：淡入淡出平滑。
- `inference`：FaceTracker adaptive FPS 設定，包含 target/min/max FPS、slow/fast frame ratio、調整冷卻時間與平均視窗大小。
- `debug.landmarkSampleStep`：debug canvas 抽樣繪製 landmarks 的間隔。
- `debug.pointRadius`：debug canvas landmark 點半徑。

模型修正主要調整 `src/config/necklaces.js`：

- `preserveAuthorOrigin`：保留 GLB 作者原點作為穿戴 anchor，新模型建議開啟。
- `colorCustomization`：色票、預設顏色與可換色材質名稱比對設定。
- `baseScale`：模型自身大小修正。
- `offsetX` / `offsetY` / `offsetZ`：模型 anchor 微調。
- `rotationX` / `rotationY` / `rotationZ`：模型朝向修正，單位是 radians。

## 模型資產注意事項

- 預設模型必須是有效 GLB，且檔案標頭應為 `glTF`。
- `GlbAssetLoader.assertGlbFile()` 會在 fetch GLB 後檢查模型檔標頭、版本與長度，若路徑回 HTML 或檔案不是有效 GLB 會報錯。
- 若 `preserveAuthorOrigin` 為 `false`，載入模型後會用 bounding box 將模型中心移到 origin；若為 `true`，保留 GLB 作者原點，只做尺寸正規化。
- 建議 GLB pivot 放在項鍊上緣中心或佩戴 anchor 附近。
- 若 GLB 是「脖子 + 項鍊」穿戴組合，整組 origin 應放在脖子正面、項鍊實際掛點，並設定 `preserveAuthorOrigin: true`。
- 建議模型正面面向相機，X 軸置中，寬度接近 1 個 Three.js 單位。
- 若模型載入後太大、太小、反向、上下顛倒或 anchor 不準，先調 `src/config/necklaces.js`；若 pivot 差距太大，應回建模工具修 origin 後重新匯出。
- 若 GLB 包含脖子遮擋模型，應保持為獨立物件或 mesh，並讓名稱符合 `occluderParts.nameIncludes`。程式會讓該模型不寫入顏色但寫入 Depth Buffer，用來遮住位於脖子後方的項鍊段。

## WebGL 資源生命週期

- `NecklaceScene` 是 scene facade；`ModelCatalogService` 只負責款式選擇、載入流程與套色協調，不應碰 geometry/material/texture disposal 細節。
- `loadNecklace(config)` 切換模型時，必須 abort 舊載入、釋放舊模型資源、清空 placement/model state、重設材質自訂與 showcase timing，再載入新 GLB。
- `ModelResourceDisposer` 需遞迴 traverse Object3D，並用 `Set` 對共享 geometry/material/texture 去重，避免同一資源被重複 dispose。
- material texture 清理不能只處理 `map`；需涵蓋 normal/roughness/metalness/ao/emissive/alpha/bump/displacement/env/light/specular/transmission 等常見 texture 欄位，或維持安全泛用掃描。
- 不要在模型切換時釋放 scene-level `environmentMap`；它由 `ThreeRendererHost.dispose()` teardown 時釋放。
- depth occluder 會用新的 `MeshBasicMaterial` 替換原材質。替換前的原材質必須保留在 `mesh.userData.originalOccluderMaterials`，讓 `ModelResourceDisposer` 連同原材質、其 texture 與新的 occluder material 一起釋放。
- `GlbAssetLoader.glbBufferCache` 是 CPU 端 ArrayBuffer cache，目前最多保留 5 個最近使用的 GLB buffer。cache hit 需 refresh LRU 順序；新增後超過上限要移除最久未使用項目。解析前仍需 `slice(0)`，避免 GLTFLoader 修改共用 cache buffer。
- `NecklaceScene.dispose()` 應可安全重複呼叫，並負責 abort active load、釋放目前模型、清空 placement/material/cache state，再交由 `ThreeRendererHost` 停止 resize observer、解除 scene environment、釋放 `environmentMap`、`PMREMGenerator` 與 `WebGLRenderer`。

## UI 與互動

- 預覽區包含相機 video、Three.js canvas 和 debug canvas，三者絕對定位重疊。
- 相機 video 以 `transform: scaleX(-1)` 鏡像顯示。
- Face Mesh 設定 `selfieMode: true`，使 landmarks 與鏡像後的使用者畫面匹配。
- 控制欄提供模型展示/AR 模式、開始/切換/停止相機、顯示項鍊、Debug 視覺化、項鍊款式、顏色色票、校準、截圖分享與錯誤顯示。
- 狀態面板會顯示模型載入、相機、追蹤、未偵測到臉、錯誤等狀態。
- 窄螢幕會使用底部面板與分頁式控制，避免控制欄壓縮預覽區。

## Cloudflare Pages 部署與 GitHub Pages 備援

- 正式線上入口以 Cloudflare Pages production URL 或自訂網域為準，GitHub Pages 不再是例行發布目標。
- `npm run build` 會產出 `dist/`；Cloudflare Pages 部署應使用 build 後的 `dist`，並讓 `PRODUCTION_URL` 指向目前正式站。
- 靜態資產 URL 應透過 `import.meta.env.BASE_URL` 或相容方式組合，避免硬編碼根目錄造成模型或 MediaPipe 資產在 preview、子路徑 hosting 或 CDN 環境載入失敗。
- 部署 Cloudflare Pages production 前先確認 `npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run budget` 與 `npm run smoke` 成功。
- 部署後需對 Cloudflare Pages production URL 做冒煙測試：頁面載入無 console error、bundle 指向最新檔、showcase/Three.js canvas 正常、`models/necklace.draco.glb`、`draco/draco_decoder.wasm` 與 `vendor/mediapipe/face_mesh/*` 沒有 404，款式卡片/色票/debug toggle 基本互動可用。
- 若仍保留 `https://cooby19.github.io/ar_necklace/`，應定位為 demo/fallback 或舊版，不需要每次 Cloudflare Pages production release 都手動更新。
- 自動化環境通常無法完整驗證相機權限、真實 Face Mesh 追蹤、前後鏡頭切換、iOS Safari 權限與效能；這些需人工實機確認。

## 單元測試策略

- 使用 Vitest，測試命令為 `npm test`。
- 使用 TypeScript 做漸進式型別檢查，命令為 `npm run typecheck`。
- 使用 ESLint、Playwright visual、Playwright + axe a11y、bundle budget、synthetic smoke 與 Lighthouse 作為不需真實相機權限的品質閘門。
- 優先測純邏輯與低 DOM 依賴，避免在單元測試中啟動真實 camera、MediaPipe 或 WebGL。
- 目前測試重點包含 `AppState` session transition 與 stale data cleanup、`RealtimeTrackingStore` live data、`RendererLoop` RAF/background pause、`TrackingUseCase` realtime 寫入與 session transition、`ModeUseCase` 模式/顯示切換、`RuntimeLifecycleUseCase` 背景暫停與預載入、`StageInteractionUseCase` 舞台指標事件、`ModelCatalogService` default color/target resolution/matched target labels、`CalibrationService` normalize/load/save/reset hint 與 localStorage 可用性、`ShareWorkflow` capture blocker 判斷，以及 `NecklaceScene`/scene 子服務的 GLB cache LRU、resource disposal、occluder、材質自訂、placement 與 showcase presenter。
- 新增或調整 runtime use-case 周邊 service 時，優先補對應 service/use-case 的單元測試，再視風險補瀏覽器或人工驗證。

## 已知限制

- 目前只支援單人臉部追蹤。
- 最適合正面或接近正面的臉。
- 脖子位置是 2D landmark 推估，不是真實人體或頸部 3D 重建。
- 支援 GLB 內建脖子模型的隱形深度遮擋，但仍沒有物理碰撞、衣領互動或高精度人體貼合。
- iOS Safari 的相機權限、WebGL 與效能可能依裝置和系統版本不同。
- `TRACKING_TUNING` 中有 `minVisibilityConfidence`、`missingFaceFadeStep`、`presentFaceFadeStep`，目前程式主要使用 smoothing opacity 來處理淡入淡出，這些欄位未被核心流程直接使用。

## 協作與維護規範

- 禁止批量刪除文件或目錄。
- 不要使用 `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 需要刪除文件時，只能一次刪除一個明確路徑的文件。
- 如果需要批量刪除文件，應停止操作並請用戶手動刪除。
- 優先保持目前的純前端架構，不要引入後端，除非需求明確要求。
- `AppRuntimeController` 應維持輕量 routing layer；新增功能時優先放入明確的 `src/app/use-cases/*`、`src/app/*Service.js` 或 `src/app/*Workflow.js`，再由 controller 轉發 UI intent。
- 不要把 camera/session lifecycle、模型 catalog/color 邏輯、render loop、校準流程、分享流程或 telemetry/debug 資料組裝塞回 `AppRuntimeController`。
- 調整 AR session lifecycle 時，優先更新 `AppState.AR_SESSION_STATES`、合法 transition 與 stale data cleanup 規則，不要只用零散 patch。
- 修改追蹤效果時，優先從 `src/config/tuning.js` 與 `src/config/necklaces.js` 調整，再考慮改核心演算法。
- 新增項鍊款式時，將 GLB 放入 `public/models/`，再於 `src/config/necklaces.js` 新增一筆設定。
- 新增可換色項鍊時，優先在 GLB material name 使用 `Colorable_Metal`、`Colorable_Pendant`、`Colorable_Gem` 等關鍵字，再於 `colorCustomization.targets` 補上對應設定。
- README 與主要維護文件優先使用繁體中文撰寫；必要技術名詞可保留英文原文，但說明內容盡量中文化。
- 如果改動相機、Face Mesh、WebGL 或座標轉換，建議用 `npm run dev` 在瀏覽器實測相機、模型載入、追蹤與 debug overlay。

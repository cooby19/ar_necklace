# 專案筆記：Web AR Necklace MVP

## 專案概覽

這是一個純前端的 Web AR 項鍊試戴 MVP。使用者開啟相機後，瀏覽器以相機畫面作為背景，透過 MediaPipe Face Mesh 偵測單人臉部 landmarks，再用 Three.js 疊加 `.glb` 項鍊模型。項鍊位置不是精準 3D 脖子重建，而是依據下巴、臉寬、臉高與頭部傾斜估算出脖子附近的位置。

目前 UI 語言主要是繁體中文，HTML 語系為 `zh-Hant`。

## 技術棧

- Vite 5，入口為 `index.html` 與 `src/main.js`。
- Three.js 用於 WebGL 場景、正交相機、燈光與 GLB 模型載入。
- `@mediapipe/face_mesh` 用於臉部 landmark 偵測。
- MediaPipe wasm/model 等執行資產已 vendored 到 `public/vendor/mediapipe/face_mesh`，執行時不依賴 CDN。
- 預設項鍊模型位於 `public/models/necklace.glb`，URL 為 `/models/necklace.glb`。
- TypeScript 採漸進式 strict boundary：`tsconfig` 使用 `allowJs: true`、`checkJs: false`、`strict: true`，只檢查局部 `// @ts-check` 的 `.js` 與 `src/types/domain.ts`。

## 常用命令

```bash
npm install
npm run dev
npm test
npm run build
npm run typecheck
npm run preview
```

- `npm run dev` 執行 `vite --host 0.0.0.0`，設定 port 為 `5173`。
- `npm test` 執行 Vitest 單元測試，主要覆蓋不需相機、MediaPipe 或 WebGL 的純邏輯。
- `npm run build` 產出到 `dist/`。
- `npm run typecheck` 執行 `tsc --noEmit`，檢查 `src/types/domain.ts` 與局部 `// @ts-check` 檔案。
- 相機權限通常需要 `localhost` 或 HTTPS。

## 目錄結構重點

- `index.html`：頁面骨架，包含相機 video、Three.js canvas、debug canvas、狀態面板與控制側欄。
- `src/main.js`：應用程式入口，串接 UI、相機、Face Mesh、Three.js 場景、控制器與 debug overlay。
- `src/styles.css`：全站樣式與響應式布局。桌面為預覽區加右側控制欄，窄螢幕改為上下布局。
- `src/config/tuning.js`：臉部追蹤、項鍊位置、縮放、平滑與 debug 顯示的主要調參位置。
- `src/config/necklaces.js`：項鍊款式清單、每個 GLB 的模型修正參數與顏色自選設定。
- `src/utils/landmarks.js`：Face Mesh landmark index、距離、插值、clamp 與臉部量測邏輯。
- `src/app/ModeController.js`：輕量 use-case orchestrator，接收 UI intent、協調 app services、提交 `AppState`，避免直接承擔底層流程細節。
- `src/app/*.test.js`：Vitest 輕量單元測試，優先保護 AppState session lifecycle、model catalog/color、校準與分享前置檢查等純邏輯。
- `src/app/ArSessionService.js`：管理 `CameraStream` 與 `FaceTracker` lifecycle、鏡頭切換、selfie mode 與 session reset。
- `src/app/ModelCatalogService.js`：管理項鍊選擇、模型載入序列、可換色 target、預設色票與套色流程。
- `src/app/RendererLoop.js`：管理 `requestAnimationFrame`、render FPS、showcase update、scene render 與 debug overlay render。
- `src/app/CalibrationService.js`：管理 `WearCalibration`、拖曳校準、調參 normalize、save/reset/load 與提示狀態。
- `src/app/ShareWorkflow.js`：管理截圖前置檢查、capture、download、native share fallback 與分享狀態資料。
- `src/app/TrackingFeedbackService.js`：組裝 FaceTracker stats、render FPS、FaceQualityAdvisor advice、developer panel 與 debug/status 文字。
- `src/core/CameraStream.js`：封裝 `getUserMedia`、video 播放與停止。
- `src/core/FaceTracker.js`：封裝 MediaPipe Face Mesh 初始化、每幀送入 video、結果回呼與錯誤回呼。
- `src/core/NecklaceController.js`：把 landmarks 轉成項鍊位置、比例、旋轉與透明度。
- `src/core/NecklaceScene.js`：Three.js 場景、GLB 載入、模型正規化、隱形深度遮擋、透明度、座標轉換、渲染、GLB buffer cache 與 WebGL 模型資源釋放。
- `src/core/NecklaceScene.test.js`：以 fake Object3D/material/texture 測 GLB cache LRU、dispose teardown、共享資源去重釋放與 depth occluder 原材質釋放，不啟動真實 WebGL。
- `src/core/Smoother.js`：標量與向量的線性平滑器。
- `src/core/DebugOverlay.js`：在 2D canvas 上畫 landmarks、下巴、脖子估算點、臉寬線與 debug 文字。
- `src/types/domain.ts`：共享 domain types，包含 AppState snapshot、MediaPipe/landmark、tracking/debug、config schema、render stats、capture/share 與 workflow status 資料形狀。
- `public/models/README.md`：項鍊 GLB 模型放置與建模對位建議。
- `dist/`：建置輸出，已在 `.gitignore` 中忽略。
- `node_modules/`：依賴目錄，已在 `.gitignore` 中忽略。

## 漸進式 TypeScript 邊界

目前專案不做一次性 TypeScript 轉換，也不要打開全域 `checkJs`。型別策略是先保護 runtime 資料形狀容易錯接的低噪音邊界，再逐步擴張。

已納入局部 `// @ts-check` 的重點範圍：

- AppState 與 AR session lifecycle。
- config schema：`tuning`、`necklaces`。
- model/color service、calibration、share workflow。
- MediaPipe results 到 `FaceTracker`、`ArSessionService`、`ModeController`、`NecklaceController`、`computeFaceMetrics` 的資料流。
- pure logic：landmarks、Smoother、WearCalibration、FaceQualityAdvisor。
- 低噪音 service/debug/render/capture boundary：RendererLoop、TrackingFeedbackService、CameraStream、DebugOverlay、stageResize、CaptureService。
- shared domain types：`src/types/domain.ts`。

仍刻意未完整型別化的區域：

- `src/app/UiController.js`：DOM query、event binding、render helper 與 focus trap 噪音高。若要推進，先抽小型 DOM helper 或 view helper，再分段加 `// @ts-check`。
- `src/core/NecklaceScene.js`：Three.js、GLTFLoader、材質 traverse、WebGL render 與 asset cache 噪音高。外部檔案應優先用小型 port 描述它們實際使用的 surface，不要為了型別化整包重構。
- `src/main.js` 與 `src/app/*.test.js`：可作為下一階段低成本補強，但不應牽動整體架構。

新增型別時優先把跨檔案共享的資料形狀放入 `src/types/domain.ts`。若只描述某個 service 依賴物件的少量方法，使用該檔案內的 local port/interface 即可，避免把 `NecklaceScene` 或 `UiController` 的完整實作 surface 暴露到全專案。

## 執行流程

1. `src/main.js` 初始化 `AppState`、`UiController`、`CaptureService` 與 `ModeController`。
2. 啟動時先依 `NECKLACES[0]` 載入預設模型。
3. `ModelCatalogService` 協調 `NecklaceScene.loadNecklace()` 載入模型，並套用目前款式的預設顏色設定。
4. `RendererLoop` 啟動 render loop，負責 showcase update、Three.js render 與 debug overlay render。
5. 使用者點擊「開始相機」後，`ModeController` 將 `AppState.sessionStatus` 切到 `cameraStarting`，再交給 `ArSessionService` 啟動相機與 Face Mesh。
6. `ArSessionService` 透過 `CameraStream` 要求鏡頭權限，依實際鏡頭設定 `FaceTracker.selfieMode`，再啟動 Face Mesh frame processing。
7. 偵測結果回到 `ModeController` 後，只負責提交 `noFace` / `tracking` 狀態與呼叫 `NecklaceController.updateFromLandmarks()`。
8. `NecklaceController` 呼叫 `computeFaceMetrics()`，根據下巴位置、臉高、臉寬、roll、yaw 與校準值計算項鍊 transform。
9. `NecklaceScene` 更新項鍊 group 的 position、scale、rotation 與材質 opacity。若款式設定 `preserveAuthorOrigin: true`，GLB 作者原點會保留為 AR anchor。
10. `TrackingFeedbackService` 組裝追蹤狀態、debug panel 與 FaceQualityAdvisor 提示；未偵測到臉或關閉顯示項鍊時，項鍊會平滑淡出。

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

## 項鍊顏色自選

顏色自選保持純前端實作，設定入口在 `src/config/necklaces.js` 的每個款式 `colorCustomization`。

- `palette`：色票清單，目前至少包含金色、銀色、玫瑰金、黑鋼、珍珠白。
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
- 側臉 yaw：鼻尖相對左右臉側中心的水平偏移，乘上 `yawStrength` 後 clamp 到 `maxYawRadians`。
- 脖子中心：`chin.y + faceHeight * neckOffsetFromChin + necklaceVerticalLift`，X 使用下巴 X。
- 項鍊 scale：world space 的臉寬乘上 `necklaceWidthToFaceWidth`，並 clamp 在 `0.18` 到 `2.4`。

## 調參位置

追蹤行為主要調整 `src/config/tuning.js`：

- `neckOffsetFromChin`：項鍊 anchor 在下巴下方的距離，比例基準是臉高。
- `necklaceWidthToFaceWidth`：項鍊相對臉寬的寬度比例。
- `necklaceVerticalLift`：項鍊垂直微調，負值往上。
- `yawStrength`：側臉時項鍊繞 Y 軸旋轉的強度。
- `yawDirection`：側臉旋轉方向，若模型往反方向轉可在 `1` 和 `-1` 間切換。
- `maxYawRadians`：側臉 Y 軸旋轉最大值。
- `yawAnchorBlend`：側臉時 anchor 從下巴往臉側中心靠近的比例。
- `yawPositionShift`：側臉時項鍊 anchor 的小幅水平補償。
- `sideViewVerticalLift`：側臉時項鍊 anchor 的垂直補償。
- `smoothing.position`：位置平滑，數值越小越穩但延遲越高。
- `smoothing.scale`：縮放平滑。
- `smoothing.rotation`：旋轉平滑。
- `smoothing.yaw`：側臉旋轉平滑。
- `smoothing.opacity`：淡入淡出平滑。
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
- `NecklaceScene.assertGlbFile()` 會在 fetch GLB 後檢查模型檔標頭與長度，若路徑回 HTML 或檔案不是有效 GLB 會報錯。
- 若 `preserveAuthorOrigin` 為 `false`，載入模型後會用 bounding box 將模型中心移到 origin；若為 `true`，保留 GLB 作者原點，只做尺寸正規化。
- 建議 GLB pivot 放在項鍊上緣中心或佩戴 anchor 附近。
- 若 GLB 是「脖子 + 項鍊」穿戴組合，整組 origin 應放在脖子正面、項鍊實際掛點，並設定 `preserveAuthorOrigin: true`。
- 建議模型正面面向相機，X 軸置中，寬度接近 1 個 Three.js 單位。
- 若模型載入後太大、太小、反向、上下顛倒或 anchor 不準，先調 `src/config/necklaces.js`；若 pivot 差距太大，應回建模工具修 origin 後重新匯出。
- 若 GLB 包含脖子遮擋模型，應保持為獨立物件或 mesh，並讓名稱符合 `occluderParts.nameIncludes`。程式會讓該模型不寫入顏色但寫入 Depth Buffer，用來遮住位於脖子後方的項鍊段。

## WebGL 資源生命週期

- `NecklaceScene` 擁有 Three.js 模型資源生命週期；`ModelCatalogService` 只負責款式選擇與套色流程，不應碰 geometry/material/texture disposal 細節。
- `loadNecklace(config)` 切換模型時，必須先釋放舊 `currentModel` 底下的 geometry、material、texture，再清空 `necklaceRoot` 與重設 `currentModel`、`colorableMaterials`、opacity/showcase 狀態。
- disposal helper 需遞迴 traverse Object3D，並用 `Set` 對共享 geometry/material/texture 去重，避免同一資源被重複 dispose。
- material texture 清理不能只處理 `map`；需涵蓋 normal/roughness/metalness/ao/emissive/alpha/bump/displacement/env/light/specular 等常見 texture 欄位，或維持安全泛用掃描。
- 不要在模型切換時釋放 scene-level `environmentMap`；它只應在 `NecklaceScene.dispose()` teardown 時釋放。
- depth occluder 會用新的 `MeshBasicMaterial` 替換原材質。替換前的原材質必須保留在 `mesh.userData.originalOccluderMaterials`，讓模型 dispose 時連同原材質、其 texture 與新的 occluder material 一起釋放。
- `glbBufferCache` 是 CPU 端 ArrayBuffer cache，目前最多保留 5 個最近使用的 GLB buffer。cache hit 需 refresh LRU 順序；新增後超過上限要移除最久未使用項目。
- `NecklaceScene.dispose()` 應可安全重複呼叫，並負責 abort active load、停止 resize observer、釋放目前模型、清空 `necklaceRoot` / `colorableMaterials` / `glbBufferCache`、解除 scene environment，再釋放 `environmentMap`、`PMREMGenerator` 與 `WebGLRenderer`。

## UI 與互動

- 預覽區包含相機 video、Three.js canvas 和 debug canvas，三者絕對定位重疊。
- 相機 video 以 `transform: scaleX(-1)` 鏡像顯示。
- Face Mesh 設定 `selfieMode: true`，使 landmarks 與鏡像後的使用者畫面匹配。
- 控制欄提供開始相機、顯示項鍊、Debug 視覺化、項鍊款式選擇、項鍊顏色色票與錯誤顯示。
- 狀態面板會顯示模型載入、相機、追蹤、未偵測到臉、錯誤等狀態。

## GitHub Pages 部署

- `npm run build` 會產出 `dist/`，正式部署到 GitHub Pages 時應使用 build 後的 `dist` 內容更新 `gh-pages` 分支。
- 此專案在 GitHub Pages 子路徑執行時，靜態資產 URL 應透過 `import.meta.env.BASE_URL` 或相容方式組合，避免硬編碼根目錄造成模型或 MediaPipe 資產載入失敗。
- 更新 `gh-pages` 前先確認 `npm test`、`npm run build` 與 `npm run typecheck` 成功，並盡量避免把 `node_modules/`、本機暫存檔或未建置來源檔放入部署分支。
- 目前線上 URL 為 `https://cooby19.github.io/ar_necklace/`。部署後需做冒煙測試：頁面載入無 console error、bundle 指向最新檔、showcase/Three.js canvas 正常、`models/necklace.glb` 與 `vendor/mediapipe/face_mesh/*` 沒有 404、款式卡片/色票/debug toggle 基本互動可用。
- 自動化環境通常無法完整驗證相機權限、真實 Face Mesh 追蹤、前後鏡頭切換、iOS Safari 權限與效能；這些需人工實機確認。

## 單元測試策略

- 使用 Vitest，測試命令為 `npm test`。
- 使用 TypeScript 做漸進式型別檢查，命令為 `npm run typecheck`。
- 優先測純邏輯與低 DOM 依賴，避免在單元測試中啟動真實 camera、MediaPipe 或 WebGL。
- 目前測試重點包含 `AppState` session transition 與 stale data cleanup、`ModelCatalogService` default color/target resolution/matched target labels、`CalibrationService` normalize/load/save/reset hint 與 localStorage 可用性、`ShareWorkflow` capture blocker 判斷，以及 `NecklaceScene` 的 GLB cache LRU 與 WebGL resource disposal helper。
- 新增或調整 ModeController 周邊 service 時，優先補對應 service 的單元測試，再視風險補瀏覽器或人工驗證。

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
- `ModeController` 應維持輕量 use-case orchestrator；新增功能時優先放入明確的 `src/app/*Service.js` 或 `src/app/*Workflow.js`，再由 `ModeController` 協調。
- 不要把 camera/session lifecycle、模型 catalog/color 邏輯、render loop、校準流程、分享流程或 telemetry/debug 資料組裝重新塞回 `ModeController`。
- 調整 AR session lifecycle 時，優先更新 `AppState.AR_SESSION_STATES`、合法 transition 與 stale data cleanup 規則，不要只用零散 patch。
- 修改追蹤效果時，優先從 `src/config/tuning.js` 與 `src/config/necklaces.js` 調整，再考慮改核心演算法。
- 新增項鍊款式時，將 GLB 放入 `public/models/`，再於 `src/config/necklaces.js` 新增一筆設定。
- 新增可換色項鍊時，優先在 GLB material name 使用 `Colorable_Metal`、`Colorable_Pendant`、`Colorable_Gem` 等關鍵字，再於 `colorCustomization.targets` 補上對應設定。
- README 與主要維護文件優先使用繁體中文撰寫；必要技術名詞可保留英文原文，但說明內容盡量中文化。
- 如果改動相機、Face Mesh、WebGL 或座標轉換，建議用 `npm run dev` 在瀏覽器實測相機、模型載入、追蹤與 debug overlay。

# Web AR 項鍊試戴 MVP

這是一個純前端的 Web AR 項鍊試戴原型。使用者開啟相機後，瀏覽器會以相機畫面作為背景，透過 MediaPipe Face Mesh 偵測單人臉部 landmarks，再用 Three.js 疊加 `.glb` 項鍊模型。

目前的定位方式不是完整的 3D 人體或脖子重建，而是根據下巴、臉寬、臉高與頭部傾斜估算項鍊應該出現的位置。若 GLB 內包含脖子遮擋模型，專案會讓該脖子模型不顯示顏色，但寫入深度緩衝區，讓項鍊後半段能被隱形脖子擋住。

## 專案結構

```text
.
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js
├── public/
│   ├── models/
│   │   ├── README.md
│   │   └── necklace.glb
│   ├── thumbnails/
│   │   └── default-necklace.svg
│   └── vendor/
│       └── mediapipe/
│           └── face_mesh/
└── src/
    ├── main.js
    ├── styles.css
    ├── app/
    │   ├── AppState.js
    │   ├── AppState.test.js
    │   ├── ArSessionService.js
    │   ├── CalibrationService.js
    │   ├── CalibrationService.test.js
    │   ├── CaptureService.js
    │   ├── ModelCatalogService.js
    │   ├── ModelCatalogService.test.js
    │   ├── ModeController.js
    │   ├── RendererLoop.js
    │   ├── ShareWorkflow.js
    │   ├── ShareWorkflow.test.js
    │   ├── TrackingFeedbackService.js
    │   └── UiController.js
    ├── config/
    │   ├── necklaces.js
    │   └── tuning.js
    ├── core/
    │   ├── CameraStream.js
    │   ├── DebugOverlay.js
    │   ├── FaceQualityAdvisor.js
    │   ├── FaceTracker.js
    │   ├── NecklaceController.js
    │   ├── NecklaceScene.js
    │   ├── Smoother.js
    │   └── WearCalibration.js
    ├── types/
    │   └── domain.ts
    └── utils/
        ├── landmarks.js
        └── stageResize.js
```

其中 `src/main.js` 只負責組裝狀態、UI、模式控制與截圖服務。`src/app/ModeController.js` 現在是輕量 use-case orchestrator：接收 UI intent、協調 app services、提交 `AppState`，但不直接管理相機生命週期、模型 catalog/color、render loop、校準流程、分享流程或 debug/status 資料組裝。`src/app/` 放應用狀態、UI 綁定、工作流程服務與模式協調，`src/core/` 放相機、Face Mesh、Three.js、穿戴校準與品質提示等可重用核心邏輯，`src/utils/` 放 landmark 計算與預覽區尺寸監聽工具。

## 應用流程分層

`ModeController` 的依賴方向是：

```text
UiController intent
  -> ModeController
  -> src/app/*Service 或 *Workflow
  -> src/core/*、NecklaceScene、FaceTracker、CaptureService
  -> AppState + UiController sync
```

目前 app services 的責任如下：

- `ArSessionService`：包裝 `CameraStream` 與 `FaceTracker`，管理 start、stop、switch camera、selfie mode 與 session reset。
- `ModelCatalogService`：管理項鍊款式查找、模型載入序列、可換色 target、預設色票與 `NecklaceScene.applyColor()` 流程。
- `RendererLoop`：管理 `requestAnimationFrame`、render FPS、showcase update、Three.js render 與 debug overlay render。
- `CalibrationService`：管理 `WearCalibration`、拖曳校準、調參 normalize、save/reset/load 與校準提示狀態。
- `ShareWorkflow`：管理截圖前置檢查、capture、download、native share fallback 與分享狀態資料。
- `TrackingFeedbackService`：組裝 FaceTracker stats、render FPS、FaceQualityAdvisor advice、developer panel 與 debug status 文字。

## 漸進式 TypeScript 狀態

專案目前採漸進式 TypeScript strict boundary，而不是一次性改成全 TypeScript：

- `tsconfig.json` 使用 `allowJs: true`、`checkJs: false`、`strict: true`。
- `src/types/domain.ts` 保存跨檔案共享的 domain types。
- 只檢查局部加上 `// @ts-check` 的 `.js` 檔案，以及 `src/types/domain.ts`。
- 使用 `npm run typecheck` 執行 `tsc --noEmit`。

目前已納入 typed boundary 的核心範圍包含：

- `AppState` 與 AR session lifecycle。
- config schema：`tuning`、`necklaces`。
- MediaPipe results、FaceTracker、ArSessionService、ModeController、NecklaceController、landmark metrics 的資料流。
- model/color、calibration、share、tracking feedback、renderer loop、camera stream、debug overlay、capture service。
- pure logic：landmarks、Smoother、WearCalibration、FaceQualityAdvisor。

仍刻意未完整型別化的區域：

- `src/app/UiController.js`：DOM query、event binding、UI render helper 與 focus trap 噪音較高。若要推進，建議先拆 DOM helper 或 view helper，再分段加 `// @ts-check`。
- `src/core/NecklaceScene.js`：Three.js、GLTFLoader、材質 traverse、WebGL render 與 asset cache 型別噪音較高。其他模組應先用小型 port 描述實際使用 surface，不要為了型別化整包重構。
- `src/main.js` 與 `src/app/*.test.js`：適合作為下一階段低成本補強。

目前不建議打開全域 `checkJs`，也不建議直接把 `UiController` 或 `NecklaceScene` 整包轉成 TypeScript。維護時優先持續保護 runtime 資料形狀容易錯接的 service boundary。

`AppState` 保留一般 UI 狀態與資料，但 AR session lifecycle 另有輕量狀態欄位 `sessionStatus`。合法轉換大致為：

```text
showcase -> arIdle -> cameraStarting -> noFace <-> tracking -> capturing -> sharing
```

`error` 可由各階段進入，使用者重新切換模式或啟動相機後再回到正常流程。`showcase`、`arIdle`、`cameraStarting`、`noFace` 會清掉過期的 landmarks/debug data，避免出現相機已關閉卻保留舊追蹤資料的狀態組合。

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

本專案使用 Vitest 補輕量單元測試，優先覆蓋不需要真實相機、MediaPipe 或 WebGL 的純邏輯。這些測試主要保護 ModeController 重構後拆出的 app services 與狀態轉換規則。

```bash
npm test
npm run build
npm run typecheck
```

目前單元測試重點：

- `AppState`：AR session 合法/不合法 transition，以及 `showcase`、`arIdle`、`cameraStarting`、`noFace` 對過期 landmarks/debug data 的清理。
- `ModelCatalogService`：預設顏色選擇、換色 target fallback、matched target label 與套色呼叫。
- `CalibrationService`：調參 normalize、save/load/reset hint、localStorage 可用與不可用情境。
- `ShareWorkflow`：截圖前置阻擋條件，包含相機未開、沒有目前影格、未偵測到臉與項鍊隱藏。

線上部署後建議對 GitHub Pages 做冒煙測試：

- 開啟 `https://cooby19.github.io/ar_necklace/`，確認頁面可載入且 console 沒有 error。
- 確認 `index.html` 指向最新 `assets/index-*.js` 與 `assets/index-*.css`。
- 確認 showcase 初始畫面、Three.js canvas、`models/necklace.glb` 與 `vendor/mediapipe/face_mesh/*` 路徑沒有 404。
- 基本操作款式卡片、色票、AR/模型展示切換與 Debug toggle。
- 相機權限、Face Mesh 真實追蹤、前後鏡頭切換與 iOS Safari 表現仍需人工實機確認。

## 放置 GLB 模型

預設模型路徑是：

```text
public/models/necklace.glb
```

瀏覽器執行時會載入：

```text
/models/necklace.glb
```

如果要新增多款項鍊，請在 `src/config/necklaces.js` 新增設定：

```js
{
  id: 'silver-chain',
  label: '銀色鍊款',
  url: '/models/silver-chain.glb',
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

## 測試步驟

1. 將 `.glb` 放到 `public/models/necklace.glb`。
2. 執行 `npm install`。
3. 執行 `npm run dev`。
4. 用瀏覽器開啟 `http://localhost:5173`。
5. 點擊「開始相機」並允許相機權限。
6. 正面看向鏡頭，確認項鍊出現在下巴下方的脖子位置。
7. 左右移動、靠近或遠離鏡頭、輕微歪頭，確認模型會跟隨位置、縮放與傾斜。
8. 開啟「Debug 視覺化」，確認 landmarks、下巴點、脖子估算點與數值資訊有顯示。
9. 確認脖子遮擋模型本身不可見，但項鍊後半段會被脖子深度遮擋。
10. 離開鏡頭，確認項鍊平滑淡出且畫面不卡死。

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
scale = faceWidthWorld * necklaceWidthToFaceWidth
```

## 可調參數

主要追蹤參數集中在 `src/config/tuning.js`：

- `neckOffsetFromChin`：項鍊 anchor 在下巴下方的距離，比例基準是臉高。
- `necklaceWidthToFaceWidth`：項鍊相對臉寬的寬度比例。
- `necklaceVerticalLift`：項鍊垂直微調，負值會往上。
- `yawStrength`：側臉時項鍊繞 Y 軸旋轉的強度，數值越大越有側視透視感。
- `yawDirection`：側臉旋轉方向，若轉側臉時項鍊往反方向旋轉，將 `1` 改成 `-1`。
- `maxYawRadians`：側臉旋轉的最大角度限制，避免極端 landmarks 讓模型翻太多。
- `yawAnchorBlend`：側臉時 anchor 從下巴往臉側中心靠近的比例，數值越大越貼近側邊脖子。
- `yawPositionShift`：側臉時項鍊 anchor 的小幅水平補償。
- `sideViewVerticalLift`：側臉時項鍊 anchor 的垂直補償，負值會往上貼近下顎與脖子交界。
- `smoothing.position`：位置平滑，數值越小越穩但延遲越高。
- `smoothing.scale`：縮放平滑。
- `smoothing.rotation`：旋轉平滑。
- `smoothing.yaw`：側臉 Y 軸旋轉平滑。
- `smoothing.opacity`：淡入淡出平滑。

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

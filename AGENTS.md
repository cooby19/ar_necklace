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

## 常用命令

```bash
npm install
npm run dev
npm run build
npm run preview
```

- `npm run dev` 執行 `vite --host 0.0.0.0`，設定 port 為 `5173`。
- `npm run build` 產出到 `dist/`。
- 相機權限通常需要 `localhost` 或 HTTPS。

## 目錄結構重點

- `index.html`：頁面骨架，包含相機 video、Three.js canvas、debug canvas、狀態面板與控制側欄。
- `src/main.js`：應用程式入口，串接 UI、相機、Face Mesh、Three.js 場景、控制器與 debug overlay。
- `src/styles.css`：全站樣式與響應式布局。桌面為預覽區加右側控制欄，窄螢幕改為上下布局。
- `src/config/tuning.js`：臉部追蹤、項鍊位置、縮放、平滑與 debug 顯示的主要調參位置。
- `src/config/necklaces.js`：項鍊款式清單、每個 GLB 的模型修正參數與顏色自選設定。
- `src/utils/landmarks.js`：Face Mesh landmark index、距離、插值、clamp 與臉部量測邏輯。
- `src/core/CameraStream.js`：封裝 `getUserMedia`、video 播放與停止。
- `src/core/FaceTracker.js`：封裝 MediaPipe Face Mesh 初始化、每幀送入 video、結果回呼與錯誤回呼。
- `src/core/NecklaceController.js`：把 landmarks 轉成項鍊位置、比例、旋轉與透明度。
- `src/core/NecklaceScene.js`：Three.js 場景、GLB 載入、模型正規化、隱形深度遮擋、透明度、座標轉換與渲染。
- `src/core/Smoother.js`：標量與向量的線性平滑器。
- `src/core/DebugOverlay.js`：在 2D canvas 上畫 landmarks、下巴、脖子估算點、臉寬線與 debug 文字。
- `public/models/README.md`：項鍊 GLB 模型放置與建模對位建議。
- `dist/`：建置輸出，已在 `.gitignore` 中忽略。
- `node_modules/`：依賴目錄，已在 `.gitignore` 中忽略。

## 執行流程

1. `src/main.js` 初始化 UI、相機、Three.js 場景、項鍊控制器、debug overlay 與 Face Mesh tracker。
2. 啟動時先依 `NECKLACES[0]` 載入預設模型。
3. 使用者點擊「開始相機」後，`CameraStream` 要求前鏡頭權限並播放 video。
4. `FaceTracker` 初始化 MediaPipe Face Mesh，設定最多追蹤 1 張臉、`refineLandmarks: true`、`selfieMode: true`。
5. 每個 animation frame 將 video frame 送進 Face Mesh。
6. 偵測到臉時，`NecklaceController` 呼叫 `computeFaceMetrics()` 取得臉部量測。
7. 控制器根據下巴位置和臉高估算脖子點，轉換到 Three.js world 座標。
8. 控制器使用臉寬推算項鍊 scale，使用左右臉側連線推算 roll，使用鼻尖相對臉中心偏移估算 yaw，並套用平滑。
9. `NecklaceScene` 更新項鍊 group 的 position、scale、rotation 與材質 opacity。若款式設定 `preserveAuthorOrigin: true`，GLB 作者原點會保留為 AR anchor。
10. 未偵測到臉或關閉顯示項鍊時，項鍊會平滑淡出。

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
- `NecklaceScene.assertGlbFile()` 會用 `Range: bytes=0-15` 先檢查模型 URL，若路徑回 HTML 或檔案不是 GLB 會報錯。
- 若 `preserveAuthorOrigin` 為 `false`，載入模型後會用 bounding box 將模型中心移到 origin；若為 `true`，保留 GLB 作者原點，只做尺寸正規化。
- 建議 GLB pivot 放在項鍊上緣中心或佩戴 anchor 附近。
- 若 GLB 是「脖子 + 項鍊」穿戴組合，整組 origin 應放在脖子正面、項鍊實際掛點，並設定 `preserveAuthorOrigin: true`。
- 建議模型正面面向相機，X 軸置中，寬度接近 1 個 Three.js 單位。
- 若模型載入後太大、太小、反向、上下顛倒或 anchor 不準，先調 `src/config/necklaces.js`；若 pivot 差距太大，應回建模工具修 origin 後重新匯出。
- 若 GLB 包含脖子遮擋模型，應保持為獨立物件或 mesh，並讓名稱符合 `occluderParts.nameIncludes`。程式會讓該模型不寫入顏色但寫入 Depth Buffer，用來遮住位於脖子後方的項鍊段。

## UI 與互動

- 預覽區包含相機 video、Three.js canvas 和 debug canvas，三者絕對定位重疊。
- 相機 video 以 `transform: scaleX(-1)` 鏡像顯示。
- Face Mesh 設定 `selfieMode: true`，使 landmarks 與鏡像後的使用者畫面匹配。
- 控制欄提供開始相機、顯示項鍊、Debug 視覺化、項鍊款式選擇、項鍊顏色色票與錯誤顯示。
- 狀態面板會顯示模型載入、相機、追蹤、未偵測到臉、錯誤等狀態。

## GitHub Pages 部署

- `npm run build` 會產出 `dist/`，正式部署到 GitHub Pages 時應使用 build 後的 `dist` 內容更新 `gh-pages` 分支。
- 此專案在 GitHub Pages 子路徑執行時，靜態資產 URL 應透過 `import.meta.env.BASE_URL` 或相容方式組合，避免硬編碼根目錄造成模型或 MediaPipe 資產載入失敗。
- 更新 `gh-pages` 前先確認 `npm run build` 成功，並盡量避免把 `node_modules/`、本機暫存檔或未建置來源檔放入部署分支。

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
- 修改追蹤效果時，優先從 `src/config/tuning.js` 與 `src/config/necklaces.js` 調整，再考慮改核心演算法。
- 新增項鍊款式時，將 GLB 放入 `public/models/`，再於 `src/config/necklaces.js` 新增一筆設定。
- 新增可換色項鍊時，優先在 GLB material name 使用 `Colorable_Metal`、`Colorable_Pendant`、`Colorable_Gem` 等關鍵字，再於 `colorCustomization.targets` 補上對應設定。
- README 與主要維護文件優先使用繁體中文撰寫；必要技術名詞可保留英文原文，但說明內容盡量中文化。
- 如果改動相機、Face Mesh、WebGL 或座標轉換，建議用 `npm run dev` 在瀏覽器實測相機、模型載入、追蹤與 debug overlay。

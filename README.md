# Web AR 項鍊試戴 MVP

這是一個純前端的 Web AR 項鍊試戴原型。使用者開啟相機後，瀏覽器會以相機畫面作為背景，透過 MediaPipe Face Mesh 偵測單人臉部 landmarks，再用 Three.js 疊加 `.glb` 項鍊模型。

目前的定位方式不是完整的 3D 人體或脖子重建，而是根據下巴、臉寬、臉高與頭部傾斜估算項鍊應該出現的位置。若 GLB 內包含脖子遮擋模型，專案會讓該脖子模型不顯示顏色，但寫入深度緩衝區，讓項鍊後半段能被隱形脖子擋住。

## 專案結構

```text
.
├── index.html
├── package.json
├── vite.config.js
├── public/
│   ├── models/
│   │   ├── README.md
│   │   └── necklace.glb
│   └── vendor/
│       └── mediapipe/
│           └── face_mesh/
└── src/
    ├── main.js
    ├── styles.css
    ├── config/
    │   ├── necklaces.js
    │   └── tuning.js
    ├── core/
    │   ├── CameraStream.js
    │   ├── DebugOverlay.js
    │   ├── FaceTracker.js
    │   ├── NecklaceController.js
    │   ├── NecklaceScene.js
    │   └── Smoother.js
    └── utils/
        └── landmarks.js
```

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

# Web AR Necklace MVP

純前端 Web AR 項鍊展示 MVP。使用瀏覽器相機作為背景，MediaPipe Face Mesh 偵測單人臉部 landmarks，Three.js 疊加 `.glb` 項鍊模型，並根據下巴、臉寬、臉高與頭部傾斜估算脖子位置。

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

## 放置 GLB 模型

請將現有項鍊模型放在：

```text
public/models/necklace.glb
```

第一版預設會載入：

```text
/models/necklace.glb
```

如果要支援多款項鍊，請在 `src/config/necklaces.js` 新增資料：

```js
{
  id: 'silver-chain',
  label: 'Silver chain',
  url: '/models/silver-chain.glb',
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

## 測試步驟

1. 將 `.glb` 放到 `public/models/necklace.glb`。
2. 執行 `npm install`。
3. 執行 `npm run dev`。
4. 用瀏覽器開啟 `http://localhost:5173`。
5. 點擊「開始相機」並允許相機權限。
6. 正面看向鏡頭，確認項鍊出現在下巴下方的脖子位置。
7. 左右移動、靠近/遠離、輕微歪頭，確認模型會跟隨位置、縮放與傾斜。
8. 開啟「Debug 視覺化」，確認 landmarks、下巴點、脖子估算點與數值資訊有顯示。
9. 離開鏡頭，確認項鍊平滑淡出且畫面不卡死。

## Landmark 與脖子估算假設

目前 MVP 使用 MediaPipe Face Mesh 常見點位：

- 下巴：`152`
- 左右臉側：`234` / `454`
- 額頭上方：`10`
- 臉中心 fallback：`168` 或鼻尖 `1`

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

主要參數集中在 `src/config/tuning.js`：

- `neckOffsetFromChin`：脖子中心在下巴下方的距離，比例基準是臉高。
- `necklaceWidthToFaceWidth`：項鍊相對臉寬的寬度比例。
- `necklaceVerticalLift`：項鍊垂直微調，負值會往上。
- `smoothing.position`：位置 smoothing，越小越穩但延遲越高。
- `smoothing.scale`：縮放 smoothing。
- `smoothing.rotation`：旋轉 smoothing。
- `smoothing.opacity`：淡入淡出 smoothing。

模型資產修正參數在 `src/config/necklaces.js`：

- `baseScale`：模型本身比例修正。
- `offsetX/Y/Z`：模型 anchor 微調。
- `rotationX/Y/Z`：模型朝向修正。

## 模型 pivot、比例與朝向建議

為了更容易對位：

- pivot 建議放在項鍊上緣中心或佩戴中心。
- 模型正面應面向相機。
- 模型左右應以 X 軸置中。
- 模型寬度建議接近 1 個 Three.js 單位。

若目前模型載入後偏移明顯，可以先用 `src/config/necklaces.js` 微調。如果模型本身 pivot 在遠離項鍊的位置，建議回到 Blender 或建模工具把 origin 設到項鍊上緣中心，再重新匯出 GLB。

## 已知限制

- 目前只支援單人、正面或接近正面的臉部追蹤。
- 脖子位置是由臉部 landmarks 估算，不是真實 3D 脖子重建。
- 沒有遮擋、碰撞或高精度貼合。
- MediaPipe Face Mesh wasm/model 檔已複製到 `public/vendor/mediapipe/face_mesh`，執行時不需要 CDN。
- iOS Safari 上相機權限與 WebGL 表現可能受裝置與系統版本影響。

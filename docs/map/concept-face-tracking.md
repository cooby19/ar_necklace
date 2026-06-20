# 概念：臉部追蹤、脖子估算與調參

> landmark 假設、脖子位置估算、側臉 yaw，以及「哪個參數調什麼」。
> 改追蹤貼合效果時讀這個檔。

## 負責什麼

用 MediaPipe Face Mesh 單人 landmarks 估算項鍊 transform（**2D 估算，非 3D 脖子重建**），並把行為集中到可調參，讓模型/演算法逐步收斂而不重寫流程。

## 包含什麼

- `src/utils/landmarks.js`：landmark index、距離、插值、clamp、`computeFaceMetrics()` 臉部量測。
- `src/core/NecklaceController.js`：landmarks → 位置/比例/旋轉/透明度。
- `src/core/Smoother.js`：位置/縮放/旋轉/yaw/opacity 平滑。
- `src/config/tuning.js`：`TRACKING_TUNING` 主調參。

## 如何運作

Face Mesh 點位：額頭 `10`、下巴 `152`、左臉側 `234`、右臉側 `454`、鼻尖 fallback `1`、臉中心 fallback `168`。

核心估算：
- 臉寬 = 左右臉側 2D 距離；臉高 = 額頭→下巴 2D 距離。
- roll = 左右臉側連線 `atan2`。
- yaw = 鼻尖相對左右臉側中心的水平偏移 + 左右臉側 Z 深度差，混合後 ×`yawStrength`、clamp 到 `maxYawRadians`。
- 脖子中心：正面 `chin.y + faceHeight * neckOffsetFromChin + necklaceVerticalLift`；側臉再依 `yawAnchorBlend`/`yawPositionShift`/`sideViewVerticalLift` 往臉側補償。
- scale = blended 臉寬（實測臉寬與臉高推估寬度混合，側臉偏臉高推估）×`necklaceWidthToFaceWidth`，clamp `0.18`～`2.4`。

Face Mesh 設 `selfieMode: true`，相機 video 以 `transform: scaleX(-1)` 鏡像，使 landmarks 與鏡像畫面匹配。

## 調參位置（`src/config/tuning.js`）

- 位置/比例：`neckOffsetFromChin`、`necklaceWidthToFaceWidth`、`necklaceVerticalLift`。
- 臉高推估寬度：`scaleWidthFromFaceHeight`、`scaleWidthMinFromHeight`、`scaleWidthMaxFromHeight`、`sideScaleHeightBlend`。
- 側臉：`yawStrength`、`yawDirection`（`1`/`-1`）、`yawNoseWeight`、`yawDepthWeight`、`yawDepthStrength`、`maxYawRadians`、`yawAnchorBlend`、`yawPositionShift`、`sideViewVerticalLift`。
- 平滑：`smoothing.position/scale/rotation/yaw/opacity`（越小越穩但延遲越高）。
- 效能：`inference`（target/min/max FPS、slow/fast frame ratio、冷卻、平均視窗）。
- Debug：`debug.landmarkSampleStep`、`debug.pointRadius`。

模型對位修正在 `src/config/necklaces.js`（`baseScale`、`offset*`、`rotation*`、`preserveAuthorOrigin`），見 [concept-model-assets.md](concept-model-assets.md)。

## 如何部署

不適用。

## 如何檢驗

`npm test` 含 landmark/Smoother 純邏輯。追蹤貼合**無法只靠 CI 驗**——改相機/Face Mesh/座標轉換後用 `npm run dev` 實機驗：正面項鍊在下巴下方、左右移動/遠近/歪頭跟隨、Debug overlay 顯示。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- 改貼合**優先**調 `tuning.js` / `necklaces.js`，再動 `NecklaceController` 演算法。
- 已知：`TRACKING_TUNING` 的 `minVisibilityConfidence`、`missingFaceFadeStep`、`presentFaceFadeStep` 目前未被核心流程直接使用（淡入淡出走 smoothing opacity）。
- 限制：只支援單人、正面或近正面臉；側臉與多人不保證準確。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[core-layer.md](core-layer.md) · [config-layer.md](config-layer.md) · [concept-model-assets.md](concept-model-assets.md) · [concept-session-lifecycle.md](concept-session-lifecycle.md)

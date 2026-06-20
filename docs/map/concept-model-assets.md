# 概念：GLB 模型資產、壓縮與建模對位

> 新增/替換項鍊 GLB、Draco 壓縮、pivot/origin 對位、occluder 命名。
> 要加一款項鍊或修模型偏移時讀這個檔。

## 負責什麼

定義 runtime 模型資產的格式、壓縮流程與建模對位約定，讓模型在 AR 試戴時對齊脖子 anchor 並可被深度遮擋。

## 包含什麼

- `public/models/*.glb`（原始）、`*.draco.glb`（runtime）；`public/models/README.md`。
- `scripts/compress-glb.mjs`（`npm run compress:glb`）。
- `src/config/necklaces.js`：每款 `url`、`preserveAuthorOrigin`、`occluderParts.nameIncludes`、`transform`。
- 壓縮細節：[../assets-compression.md](../assets-compression.md)。

## 如何運作

**模型檔**：必須是有效 GLB（標頭 `glTF`）。`GlbAssetLoader.assertGlbFile()` 會檢查 magic header、version、length；路徑回 HTML 或非有效 GLB 會報錯。

**原點**：`preserveAuthorOrigin: true`（新模型建議）保留 GLB 作者原點作 AR anchor，只做尺寸正規化；`false` 則用 bounding box 把中心移到 origin。「脖子+項鍊」組合：整組 origin 放脖子正面、項鍊實際掛點，並設 `true`。

**建模建議**：pivot 放項鍊上緣中心/佩戴中心；正面面向相機；X 軸置中；寬度接近 1 個 Three.js 單位。偏移先用 `necklaces.js` 的 `baseScale`/`offset*`/`rotation*` 微調；pivot 差太多就回建模工具修 origin 重匯。

**occluder**：若 GLB 含脖子遮擋模型，保持為獨立物件/mesh，命名命中 `occluderParts.nameIncludes`（預設 `neck`、`body_neck`、`neck_helper`、`脖`、`頸`、`圓柱`、`cylinder`）。程式讓它不寫顏色但寫 Depth Buffer，遮住脖子後方的項鍊段。要自然遮擋，項鍊本身需有前後深度。occluder 的資源處理見 [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md)。

**新增/替換流程**：
1. 原始 GLB 放 `public/models/`。
2. `npm run compress:glb` 產生 `.draco.glb`（掃 `public/models/**/*.glb`，略過既有 `.draco.glb`）。
3. `necklaces.js` 用 `versionedPublicAssetUrl('models/<name>.draco.glb')` 指向壓縮檔（**不要硬編碼根路徑**）。
4. 確認 `public/draco/` 仍含 decoder。
5. `npm run build`、`npm run smoke`，瀏覽器檢查外觀/UV/法線/反射。

## 如何部署

`models/*`、`draco/*` 走長效 immutable cache（`_headers` 已設），runtime URL 帶 release token。見 [public-assets.md](public-assets.md)、[deploy.md](deploy.md)。

## 如何檢驗

`npm run smoke` / `npm run smoke:release` 檢查 `.draco.glb` header、Draco decoder、`.wasm` MIME；`npm run budget` 檢查 GLB 大小。外觀需 `npm run dev` 人工確認。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- **保留** `public/models/*.glb` 原始檔作為 fallback 與重壓來源，**不要**只留 `.draco.glb`。
- 啟用換色需在 GLB material name 加 `Colorable_*`，見 [concept-color-customization.md](concept-color-customization.md)。
- 刪檔遵守[全域刪除規範](conventions.md)：一次刪一個明確路徑。

## 相關模組

[config-layer.md](config-layer.md) · [public-assets.md](public-assets.md) · [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md) · [concept-color-customization.md](concept-color-customization.md) · [../assets-compression.md](../assets-compression.md)

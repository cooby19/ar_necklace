# public 資產（public/*）

> Runtime 靜態資產、安全 headers 與安裝/分享素材。
> 改 GLB、Draco、MediaPipe vendor、icons、`_headers` 或 manifest 時讀這個檔。

## 負責什麼

放執行時直接由瀏覽器抓取的資產（不經 bundler 改名），以及部署端 headers 與 PWA/SEO 素材。

## 包含什麼

- `models/`：`necklace.glb` / `necklace_2.glb`（原始，fallback 與重壓來源）與 `*.draco.glb`（runtime）。`models/README.md` 有建模對位建議。
- `draco/`：Draco decoder（`draco_decoder.js/.wasm`、`draco_wasm_wrapper.js`），給壓縮 GLB 解碼。
- `vendor/mediapipe/face_mesh/`：vendored MediaPipe Face Mesh runtime（`face_mesh.js`、`.binarypb`、packed assets `.data`/loader、SIMD/非 SIMD wasm 與 JS、`index.d.ts`、`package.json`、`README.md`）。**執行時不依賴 CDN**。
- `icons/`、`brand/`：`lunera-icon-192/512`、`apple-touch-icon`、`lunera-logo.png`（OG/Twitter/JSON-LD/manifest 用）。
- `thumbnails/`：款式縮圖 SVG。
- `site.webmanifest`：PWA manifest（name/short_name/scope/display/theme/lang/categories/icons）。
- `_headers`：CSP、`Permissions-Policy: camera=(self)`、Cache-Control；Vite build 時複製到 `dist/_headers`，由 Cloudflare Pages/Netlify 套用。

## 如何運作

- runtime URL 由 [`config/assets.js`](config-layer.md) 的 `versionedPublicAssetUrl()` 組出，帶 `?v=<version>-<sha>` 當 cache key。
- CSP 需允許 MediaPipe generated runtime 的 `'unsafe-eval'`／`'wasm-unsafe-eval'`（見 [ADR-0003](../adr/0003-mediapipe-csp.md)）。
- GLB 載入/釋放/cache 細節見 [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md)；壓縮見 [concept-model-assets.md](concept-model-assets.md)。

## 如何部署

`_headers` 提供 CSP/Permissions-Policy/Cache-Control baseline；`assets/*`、`models/*`、`draco/*`、`vendor/*` 走長效 immutable cache，`index.html`/`release.json` 走 `no-cache`。完整 headers/cache/平台範例見 [deploy.md](deploy.md) 與 [deployment.md](../deployment.md)。

## 如何檢驗

`npm run smoke`（本機/遠端）與 `npm run smoke:release`（遠端）會檢查 GLB header、Draco、MediaPipe vendor、`.wasm` MIME、`_headers` 的 CSP/Permissions-Policy/Cache-Control。`npm run budget` 檢查 JS/CSS、GLB 與 MediaPipe 重要資產大小。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- **不要**刪 `models/necklace.glb`（fallback/重壓來源）或任何 MediaPipe vendor 檔——刪了會破壞 fallback 或 Face Mesh 初始化。
- 改 CSP/外部來源（新網域、worker、blob/data、WASM、runtime eval）時，連動 `_headers`、`smoke` 腳本與 [ADR-0003](../adr/0003-mediapipe-csp.md)。
- 換正式 logo/icon 時，連動 `index.html`、`site.webmanifest` 與部署後 404 檢查。
- 刪檔遵守[全域刪除規範](conventions.md)：一次一個明確路徑，禁止批量刪 `vendor/` 等目錄。

## 相關模組

[config-layer.md](config-layer.md) · [concept-model-assets.md](concept-model-assets.md) · [concept-webgl-lifecycle.md](concept-webgl-lifecycle.md) · [deploy.md](deploy.md) · [ADR-0003](../adr/0003-mediapipe-csp.md)

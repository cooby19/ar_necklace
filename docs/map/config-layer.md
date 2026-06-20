# config 層（src/config/*）

> 調參與資產設定的集中入口：款式、追蹤參數、資產 URL、release/site 注入值。
> 想「不改演算法就調行為」時，先來這裡。

## 負責什麼

把可調整的值與外部注入值集中，讓追蹤效果、款式、資產路徑、release metadata 可在不動核心程式的前提下調整。

## 包含什麼

- `necklaces.js`（+`.test`）：款式清單 `NECKLACES`。每筆含 `id`、`label`、`url`（用 `versionedPublicAssetUrl()`）、`preserveAuthorOrigin`、`occluderParts.nameIncludes`、`transform`（baseScale/offset*/rotation*）、`colorCustomization`（palette / defaultColor / defaultTarget / targets 的 `materialNameIncludes`）。
- `tuning.js`：`TRACKING_TUNING` 追蹤主調參——脖子位移、寬度比例、垂直微調、臉高推估寬度、側臉 yaw（強度/方向/權重/上限）、anchor 補償、`smoothing.*`、`inference`（adaptive FPS）、`debug.*`。
- `assets.js`：`versionedPublicAssetUrl(path)` 用 `import.meta.env.BASE_URL` + release token 組 public asset URL，避免 preview/子路徑/CDN cache 載入錯誤。
- `release.js`：讀 build-time 注入的 `RELEASE_METADATA`（version/commitSha/buildTime/environment），含本機 fallback 與 `formatReleaseLabel()`。
- `site.js`：讀 build-time `__SITE_URL__` 注入的 `SITE_URL`（供 canonical/OG/JSON-LD/Web Share）。

## 如何運作

- `release.js` 與 `site.js` 的值由 `vite.config.js` 在 build 時注入（`__APP_RELEASE_METADATA__`、`__SITE_URL__`），dev 用 fallback。
- runtime 載入款式時，URL 一律經 `versionedPublicAssetUrl()`；新增款式照樣套用，CDN cache key 才會帶 `?v=<version>-<sha>`。
- 追蹤參數語意與「哪個參數調什麼」見 [concept-face-tracking.md](concept-face-tracking.md)；換色設定語意見 [concept-color-customization.md](concept-color-customization.md)。

## 如何部署

`release.js`/`site.js` 依賴部署時的環境變數注入（`BUILD_TIME`、`DEPLOY_ENVIRONMENT`、`VITE_SITE_URL`/`PRODUCTION_URL`/`STAGING_URL`）。見 [deploy.md](deploy.md)。

## 如何檢驗

`npm test` 含 `necklaces.test.js`（款式 schema）。改資產 URL 後跑 `npm run build` + `npm run smoke` 確認 GLB/vendor 無 404 且 release metadata 正確。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- 改追蹤效果**優先**從 `tuning.js`、`necklaces.js` 調，再動 [core 演算法](core-layer.md)。
- 新增款式：把（壓縮後）GLB 放 `public/models/`，在 `necklaces.js` 用 `versionedPublicAssetUrl()` 加一筆，**不要硬編碼根路徑 URL**。流程見 [concept-model-assets.md](concept-model-assets.md)。
- 改款式 id / palette id / target id 時，連動 [深連結測試](concept-routing-deeplinks.md)（`router.test.js`、`AppRuntimeController.test.js`）。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[concept-face-tracking.md](concept-face-tracking.md) · [concept-color-customization.md](concept-color-customization.md) · [concept-model-assets.md](concept-model-assets.md) · [public-assets.md](public-assets.md) · [deploy.md](deploy.md)

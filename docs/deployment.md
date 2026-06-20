# 部署與發布流程

本文定義商業化前可接受的靜態前端部署流程。正式部署目標已切換為 Cloudflare Pages，正式線上入口以 Cloudflare Pages production URL 或自訂網域為準；使用 GitHub Actions 先建置並驗證 `dist/`，再用 Wrangler Direct Upload 發布到 Cloudflare Pages。GitHub Pages 僅保留為歷史 demo 或緊急 rollback 參考，不再作為正式安全 header / cache 驗收來源，也不需要跟著每次 Cloudflare Pages production release 例行更新。

## 目前限制與設計前提

- 專案是純前端 Vite app，正式建置輸出在 `dist/`。
- 相機、MediaPipe live tracking、iOS Safari 實機體驗不可作為 CI 必通條件；部署 smoke 檢查 showcase 可載入、版本 metadata、核心靜態資產與不需真實相機的基本互動。
- `vite.config.js` 預設 `base: '/'`，符合 Cloudflare Pages production / preview 的根路徑部署；不得沿用 GitHub Pages 的 `/ar_necklace/` 作為正式 build base。
- 款式與換色深連結使用 hash router，例如 `#n=crystal-cone-necklace&c.metal=citrine&c.gem=amethyst`；hash 不會送到 CDN 或 server，因此 Cloudflare Pages 只需要回應同一份 `index.html`，不需 rewrite 規則或額外路由設定。
- 若需要重建歷史 GitHub Pages fallback，才使用 `VITE_BASE_PATH=/ar_necklace/ npm run build` 明確覆寫。
- runtime 資產已透過 `import.meta.env.BASE_URL` 組出 `models/`、`thumbnails/` 與 MediaPipe vendor 路徑，並加上 release token query string。正式 Cloudflare Pages build 會解析為 `/models/...`、`/vendor/...`，大型 GLB/WASM/data 可搭配 Cloudflare edge cache。
- 不硬編碼正式站 URL；canonical、OG、JSON-LD 與 Web Share URL 由 build-time `VITE_SITE_URL` 注入，GitHub Actions deploy workflow 會依 target 從 `PRODUCTION_URL` / `STAGING_URL` secrets 帶入。
- GitHub Pages 不再是例行 production 發布目標；若保留既有 URL，定位為 demo/fallback 或停在穩定版本，避免對外文件同時出現兩個「正式站」。

## 環境規劃

| 環境 | 觸發 | 用途 | 部署條件 | 驗證 |
| --- | --- | --- | --- | --- |
| PR preview | Pull request opened / synchronized | 給 PM、設計、QA、客戶看單一 PR 改動 | CI build artifact 成功，且 hosting secrets 可用 | `npm run smoke` 檢查 preview URL |
| staging | push 到 `staging` branch，或手動 dispatch target=`staging` | 合併前/發布前的整體驗收環境 | lint/typecheck/unit/build/budget 成功 | staging URL 必須 smoke 通過 |
| production | push 到 `master` / `main`、GitHub Release published，或手動 dispatch target=`production` | 正式公開環境 | 同一個 artifact 先部署 staging preview 並 smoke 通過 | production URL smoke 驗證 |

Production deploy 在 `.github/workflows/deploy.yml` 中明確依賴 `smoke-staging`。若 staging smoke 無法取得 URL 或驗證失敗，production job 不會執行。

## Hosting 選型

### 建議排序

1. **Cloudflare Pages（primary）**
   - 優點：靜態資產 CDN 非常適合本專案；官方支援 PR preview deployments、branch preview、Direct Upload with Wrangler、production rollback。
   - 取捨：若使用 Direct Upload，需自行管理 GitHub Actions 與 secrets；preview deployment 不是 production rollback target。
   - 適合本專案原因：目前是純靜態 app，資產含 GLB、WASM、data files，Cloudflare edge cache 與 Pages preview 模型足夠；可保留 GitHub Actions 的品質閘門後再上傳 prebuilt `dist/`，同時讓 `_headers` 在正式站生效。

2. **Netlify**
   - 優點：Deploy Preview、branch deploy、deploy permalink、rollback 體驗成熟；協作 preview 功能強。
   - 取捨：商業團隊功能與存取控制常受方案限制；若未來需要自訂 image/header/cache，需維護 Netlify config。

3. **Vercel**
   - 優點：Git preview deployment 與 instant rollback 體驗非常順；團隊 PR review flow 很成熟。
   - 取捨：本專案不是 Next.js，Vercel 的框架優勢不明顯；靜態 GLB/WASM 大資產仍需確認方案流量與 cache 策略。

4. **Firebase Hosting**
   - 優點：preview channels、live channel、GitHub Action 整合明確；若之後接 Firebase/Auth/Firestore 會很自然。
   - 取捨：目前沒有 Firebase backend 需求；rollback 與多環境權限模型需額外規劃。

5. **S3 + CloudFront**
   - 優點：企業 AWS 標準解；S3 versioning 可保留物件版本，CloudFront 可控 cache/invalidation。
   - 取捨：PR preview、branch deploy、rollback、權限、cache invalidation 都要自建；商業化前維運成本最高。

### GitHub Pages 歷史/rollback 策略

- Cloudflare Pages 是 primary hosting；發布 checklist、smoke test、README、QR code 與對外文件都應指向 Cloudflare Pages production URL 或自訂網域。
- 可保留既有 `https://cooby19.github.io/ar_necklace/` 作為歷史 demo/fallback，但不要把它視為 production security headers 驗收來源。
- GitHub Pages 不支援自訂 response headers，`public/_headers` 不會在該平台生效，因此不適合承擔這個相機 Web AR App 的正式站。
- GitHub Pages 不需要跟著每次 Cloudflare Pages production release 手動更新；若仍公開可訪問，請在文件或頁面說明它不是正式入口，避免使用者誤開舊版。
- 若緊急需要重建 GitHub Pages fallback，請使用 `VITE_BASE_PATH=/ar_necklace/ npm run build` 產生子路徑 build，再明確記錄「沒有 CSP / Permissions-Policy / cache header」這個 release risk。

## Release metadata

每次 `npm run build` 都會產生：

- `dist/release.json`
- runtime `window.__AR_NECKLACE_RELEASE__`
- console safe metadata：`[release] {...}`
- debug panel「版本」欄位

欄位：

```json
{
  "version": "0.1.0",
  "commitSha": "GITHUB_SHA 或 git rev-parse",
  "buildTime": "ISO-8601 UTC timestamp",
  "environment": "ci | preview | staging | production | local"
}
```

這些資料不包含 secret，可用於客服回報、QA 截圖、rollback 驗證與 artifact 對照。

## Runtime error reporting

Production 建議使用 Sentry 或同級服務。專案目前內建一個 Sentry envelope-compatible 的輕量 reporter，不把 SDK 或 secret 當成 build 必要條件。

啟用方式：

```bash
VITE_ERROR_REPORTING_DSN=https://<public-key>@<org>.ingest.sentry.io/<project-id>
VITE_ERROR_REPORTING_SAMPLE_RATE=1
npm run build
```

未設定 `VITE_ERROR_REPORTING_DSN` 時，reporter 會保持 disabled，app 初始化、build、test、smoke 都不受影響。DSN 是 client public key，不是 server secret；正式環境仍應在 hosting secret / environment variable 管理。

目前捕捉範圍：

- 全域 JavaScript error。
- `unhandledrejection`。
- resource load error，例如 JS/CSS/image/script 載入失敗。
- GLB fetch/header/parse 失敗與 HTTP status。
- MediaPipe Face Mesh script 載入、初始化與推論錯誤。
- WebGL renderer/environment 初始化錯誤。

隱私邊界：

- 不上傳 camera frame、canvas、使用者照片、share capture data URL、Blob。
- 不上傳 MediaPipe landmarks、world landmarks、debugData 或原始 FaceMesh results。
- event context 只保留 release metadata、錯誤訊息、stack、asset path/status、feature/event type 等維運必要資訊。

每筆 error event 都會帶：

- `release`: `web-ar-necklace@<package-version>+<commit-sha>`
- `environment`: `preview | staging | production | ci | local`
- `contexts.release`: version、commitSha、buildTime、environment

瀏覽器端也會暴露不含 secret 的 `window.__AR_NECKLACE_ERROR_REPORTING__`，可和 `window.__AR_NECKLACE_RELEASE__` 一起用於客服截圖與 smoke debug。

若改用完整 `@sentry/browser` SDK，請維持同樣隱私規則：不要啟用 Session Replay、不要附加 screenshots、不要把 breadcrumbs 塞入相機 frame 或 landmarks，並在 CSP `connect-src` 加上實際 ingest domain。

## CI artifact

`.github/workflows/ci.yml` 的 build job 會上傳：

```text
ar-necklace-dist-${GITHUB_SHA}
```

內容為完整 `dist/`，保留 30 天。artifact 可用於：

- 查驗某個 commit 實際 build 內容。
- 比對 `release.json` 的 version / commit / buildTime。
- 必要時下載後手動上傳到 hosting 平台。

## Cloudflare Pages CD workflow

`.github/workflows/deploy.yml` 已啟用以下流程：

1. Resolve target：依 event 決定 `preview` / `staging` / `production`。
2. Secret preflight：沒有 secrets 時 deploy jobs 會跳過，不假裝部署成功。
3. Build deploy artifact：執行 lint、typecheck、unit、build、budget、synthetic smoke，並上傳 `dist/` artifact；production build 以 `PRODUCTION_URL` secret 設定 `VITE_SITE_URL`，未設定時 fallback 到 Cloudflare Pages project URL；staging build 以 `STAGING_URL` secret 設定 `VITE_SITE_URL`，未設定時 fallback 到 `staging` branch URL；preview build 若無穩定可預知 URL 則保留 Vite fallback。
4. PR preview：用 Cloudflare Pages branch deploy `pr-<number>`。
5. Staging：部署到 Cloudflare Pages `staging` branch，接著跑 smoke。
6. Production：push 到 `master` / `main`、release event 或手動 target=`production` 時，只有 staging smoke 成功後才把同一份 artifact 部署到 Cloudflare Pages project 的 `production_branch`。
7. Production smoke：使用 `PRODUCTION_URL` secret；若未設定則 fallback 到 `<project>.pages.dev`。注意 smoke URL 只決定遠端驗證目標，不會改變已經建好的 `dist/index.html`。

需要設定的 GitHub Secrets：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PAGES_PROJECT
```

`CLOUDFLARE_PAGES_PROJECT` 是 Wrangler `--project-name` 使用的 Cloudflare Pages project name / slug，不是 GitHub repository name 也不是正式站 URL。

可選的 GitHub Secrets：

```text
STAGING_URL
PRODUCTION_URL
```

`STAGING_URL`、`PRODUCTION_URL` 用於 build-time `VITE_SITE_URL` 注入，也用於自訂網域或 Wrangler output 無法解析 Pages URL 時的 smoke fallback；不應在程式碼中硬編碼正式站 URL。若 production target 未設定 `PRODUCTION_URL`，artifact 會使用 `https://${CLOUDFLARE_PAGES_PROJECT}.pages.dev`；若 staging target 未設定 `STAGING_URL`，artifact 會使用 `https://staging.${CLOUDFLARE_PAGES_PROJECT}.pages.dev`。只有 Cloudflare Pages project secret 也缺漏時，才會保留 `vite.config.js` 的本機開發 fallback `http://localhost:5173/` 並輸出 notice。

建議設定的 GitHub Environments：

- `pr-preview`：可不需人工 approval。
- `staging`：可不需人工 approval，但限制可部署 branch。
- `production`：必須開 required reviewers，禁止未審核直接部署。

Cloudflare token 最小權限建議只授予該 Pages project 的 deploy/rollback 所需權限，不要使用全帳號管理 token。

Cloudflare Pages project 設定：

- Project 類型：Direct Upload，因為 GitHub Actions 會負責 build/test/smoke，再上傳 prebuilt `dist/`；不要同時啟用 Cloudflare Git integration 讓 Cloudflare 端重複 build。
- 建立 project 時的 production branch 選目前主分支 `master`（若 repo 改名再改為 `main`）；workflow production deploy 會讀取 Cloudflare Pages project 的 `production_branch`，並用 `wrangler pages deploy dist --project-name ... --branch <production_branch>` 發布 production。
- Build command / output directory：若使用 Direct Upload，不需要在 Cloudflare 端設定 build command；GitHub Actions 產出的 `dist/` 是唯一部署輸入。
- Production base path：`/`。正式 build 不設定 `VITE_BASE_PATH`，避免 `/ar_necklace/` 這類 GitHub Pages 子路徑殘留。
- 自訂網域：可在 Cloudflare Pages project 綁定正式網域；綁定後把該 URL 放入 `PRODUCTION_URL` 方便 smoke。
- Environment variables：目前是 GitHub Actions build + Cloudflare Pages Direct Upload，`VITE_SITE_URL` 必須存在於 GitHub Actions build 環境。只有改成 Cloudflare Pages 端 build 時，Cloudflare Pages project 的 build env 才會影響產出的 HTML 與 runtime bundle。

## Release versioning

建議流程：

1. 更新 `package.json` version，例如 `0.2.0`。
2. 合併功能到目前的主分支（此 repo 為 `master`；若之後改名則使用 `main`）。
3. 建立 release branch 或 tag，例如 `v0.2.0`。
4. 發布 GitHub Release。
5. `deploy.yml` 以 release event 建置 artifact，先部署 staging。
6. staging smoke 通過後部署 production。
7. production smoke 通過後，在 release notes 記錄 production URL、commit SHA、artifact name 與 release metadata。

手動發布 production 時，使用 workflow dispatch：

```text
target=production
ref=<commit SHA 或 tag>
```

這會重建指定 ref，仍然先部署 staging 並 smoke，通過後才部署 production。

## Synthetic smoke 驗證

本機或 CI artifact smoke 使用：

```bash
npm run build
npm run smoke
```

`npm run smoke` 會在沒有 `SMOKE_BASE_URL` 時啟動 Vite preview server，檢查 build 後的 `dist/`。若設定 `SMOKE_BASE_URL`，同一套 synthetic smoke 會直接檢查遠端部署 URL：

```bash
SMOKE_BASE_URL=https://example.com/ npm run smoke
```

可選版本驗證：

```bash
SMOKE_BASE_URL=https://example.com/ \
EXPECTED_COMMIT_SHA=<sha-prefix> \
EXPECTED_VERSION=0.2.0 \
npm run smoke
```

`npm run smoke` 目前檢查：

- `index.html` 可讀。
- 當設定 `SMOKE_BASE_URL` 檢查遠端部署時，首頁必須有 `Content-Security-Policy` 與 `Permissions-Policy: camera=(self)`，`index.html` / `release.json` 必須要求重新驗證。
- `index.html` 指向的 `assets/*.js` / `assets/*.css` 可讀，不是 404。
- 當設定 `SMOKE_BASE_URL` 檢查遠端部署時，`assets/*`、`models/*` 與 `vendor/mediapipe/face_mesh/*` 必須回應長效 immutable Cache-Control。
- `release.json` 可讀且包含 `version`、`commitSha`、`buildTime`、`environment`。
- `window.__AR_NECKLACE_RELEASE__` 與 error reporting public status 已注入 runtime。
- `models/necklace.draco.glb` 可讀，且 GLB magic header、version、declared length 正確。
- `draco/draco_wasm_wrapper.js` 與 `draco/draco_decoder.wasm` 可讀；遠端 smoke 會確認 `.wasm` 是 `application/wasm`。
- MediaPipe `face_mesh.js`、binarypb、packed data、loader JS、SIMD wasm JS、SIMD wasm 檔案可讀。
- Showcase 初始頁載入，`#threeCanvas` 可見且尺寸合理。
- 款式卡片、色票、Debug toggle 可基本互動。
- Hash 深連結可載入指定款式與逐 target 色票，例如 `#n=crystal-cone-necklace&c.metal=citrine&c.gem=amethyst`；換色與切換款式後 URL 應以 `replaceState` 更新，不累積每一步 browser history。
- Share sheet 可在不要求 camera permission 的測試狀態下開啟與關閉。

部署後輕量 release smoke 仍保留：

```bash
SMOKE_BASE_URL=https://example.com/ npm run smoke:release
```

`smoke:release` 不啟動 browser，只做遠端 HTTP/release/header/cache/asset 檢查，適合 rollback workflow、CDN 快速探測或瀏覽器環境暫時不可用時使用。

CI/CD 串接：

- CI build job 在 `npm run build` 與 `npm run budget` 後執行 `npm run smoke`。
- Deploy build artifact job 也會先對 artifact 跑 `npm run smoke`，通過才上傳/部署。
- PR preview、staging、production 部署後會以 `SMOKE_BASE_URL=<deployed-url> npm run smoke` 做遠端 synthetic smoke。
- Rollback workflow 使用 `smoke:release` 驗證回退後的版本與核心 asset；若要做完整 UI smoke，可手動對 rollback URL 執行 `SMOKE_BASE_URL=<url> npm run smoke`。

CI 不要求真實 camera permission。相機權限、Face Mesh 真實追蹤、前後鏡頭切換、iOS Safari 權限與效能仍是人工實機驗收項目。

發布 hash router 或款式分享相關改動時，production smoke 之外還要用瀏覽器人工確認：

- 直接開啟 production 深連結後，初始款式不應先載入預設模型再載入目標模型。
- 逐 target 指定的色票優先於 fallback `c=<colorId>`。
- 無效款式或未知色票不應讓 app 初始化失敗。
- 切換款式/換色後的 URL 可複製到新分頁並重現相同款式與顏色狀態。

## Cache-control 與 asset CDN

正式 hosting 使用 Cloudflare Pages，理由是同一個純前端架構即可取得 `_headers`、edge cache、preview deployment 與 rollback。不要把 GitHub Pages 當成 production security/cache control 的落點，因為 GitHub Pages 不支援自訂 response headers。

目前 repo 提供 `public/_headers`，Vite build 時會複製到 `dist/_headers`。Cloudflare Pages 與 Netlify 會套用它：

- `index.html` 與 `/`：`Cache-Control: no-cache, max-age=0, must-revalidate`，確保新部署能立即拿到最新 asset manifest。
- `release.json`：`no-cache`，確保 smoke、客服與 rollback 查驗看到當前部署版本。
- `assets/*`：Vite hashed JS/CSS，`public, max-age=31536000, immutable`。
- `models/*`、`draco/*` 與 `vendor/mediapipe/face_mesh/*`：runtime URL 會加 release token query string，例如 `?v=0.2.0-<sha>`，因此即使 GLB/WASM/data 檔名未 hash，也可搭配 `public, max-age=31536000, immutable`。
- `site.webmanifest`、`brand/*` 與 `icons/*`：支援 SEO、社群分享與加入主畫面的 public assets。若正式品牌圖或 icon 會在同一路徑替換，部署後需確認 CDN 已更新或短時間內可重新驗證。

CDN 策略：

- 預設使用 same-origin hosting CDN，避免額外 CORS 與 CSP 複雜度。
- Cloudflare Pages 預設會把 query string 納入 cache key；若使用其他 CDN，需確認 CDN cache key 包含 `v` query string。
- 若某平台或企業 CDN 忽略 query string，請改用 release-prefixed 路徑或 hashed filenames，例如 `/runtime-assets/<sha>/models/necklace.draco.glb`，或把 `models/*` / `draco/*` / `vendor/*` cache 降為短 TTL。
- GLB、WASM、data 檔案若改走獨立 asset CDN，需要同時設定 CORS、CSP `script-src` / `connect-src` / `img-src`，並重新跑 `npm run smoke` 確認沒有 404 或 WebGL taint 問題。

## Security headers

`public/_headers` 目前提供 baseline：

- `Content-Security-Policy`
  - `default-src 'self'`
  - `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'`：允許同源 JS、MediaPipe WASM 與 MediaPipe generated runtime 的動態 JavaScript 初始化。
  - `connect-src 'self' blob: https://*.ingest.sentry.io https://*.sentry.io`：允許 GLB 內嵌 texture 的 blob fetch 與 optional Sentry-compatible error reporting。
  - `img-src 'self' data: blob:`：支援 UI thumbnail 與本機 share preview。
  - `media-src 'self' blob:`：保留相機/媒體元素需要的安全範圍。
  - `frame-ancestors 'none'`、`object-src 'none'`、`base-uri 'self'`。
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(self), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=()`

相機權限仍由瀏覽器 permission prompt 控制；`Permissions-Policy: camera=(self)` 的目的，是允許本站使用 camera，同時避免第三方 iframe 任意取得權限。

## SEO / OG / Manifest 發布檢查

目前 `index.html` 已包含商業化最低門檻的 SEO 與社群分享基礎：

- 繁體中文 title、description、robots、canonical、theme-color、color-scheme 與 mobile web app tags。
- Open Graph 與 Twitter Card，暫用 `public/brand/lunera-logo.png` 作為分享圖片。
- `public/site.webmanifest`，包含 `name`、`short_name`、description、`start_url`、`scope`、`display`、`theme_color`、`background_color`、`lang`、categories 與 icons。
- JSON-LD `@graph`，包含 `Organization`、`WebSite` 與 `WebApplication`，描述線上 AR 項鍊試戴、免安裝、瀏覽器相機即時預覽與飾品展示 / 電商導購用途。
- canonical、`og:url`、JSON-LD URL 與 runtime Web Share URL 都來自同一個 build-time `VITE_SITE_URL` / `__SITE_URL__` 注入值。

正式 Cloudflare Pages production 發布前需完成：

- 確認 GitHub Actions production build 可讀取 `PRODUCTION_URL` secret；若未設定，build-time `VITE_SITE_URL` 會 fallback 到 Cloudflare Pages project 的穩定 `pages.dev` URL。
- 將暫用方形 logo 換成正式品牌素材；社群分享建議另備 1200x630 preview image，並同步更新 `og:image:width` / `og:image:height` / alt。
- 用 production URL 檢查 `site.webmanifest`、`brand/lunera-logo.png`、`icons/lunera-icon-192.png`、`icons/lunera-icon-512.png`、`icons/apple-touch-icon.png` 沒有 404。
- 用社群分享偵錯工具或瀏覽器檢查 production HTML 中的 title、description、OG、Twitter Card 與 JSON-LD 都讀得到最新內容。

### 平台設定範例

Cloudflare Pages / Netlify：

```text
public/_headers -> dist/_headers
```

已由 repo 提供，部署平台會讀取。

Vercel `vercel.json` 範例：

```json
{
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        { "key": "X-Content-Type-Options", "value": "nosniff" },
        { "key": "Referrer-Policy", "value": "strict-origin-when-cross-origin" },
        { "key": "Permissions-Policy", "value": "camera=(self), microphone=(), geolocation=()" }
      ]
    },
    {
      "source": "/assets/(.*)",
      "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
    },
    {
      "source": "/index.html",
      "headers": [{ "key": "Cache-Control", "value": "no-cache, max-age=0, must-revalidate" }]
    }
  ]
}
```

Firebase Hosting `firebase.json` 範例：

```json
{
  "hosting": {
    "public": "dist",
    "headers": [
      {
        "source": "/assets/**",
        "headers": [{ "key": "Cache-Control", "value": "public, max-age=31536000, immutable" }]
      },
      {
        "source": "/index.html",
        "headers": [{ "key": "Cache-Control", "value": "no-cache, max-age=0, must-revalidate" }]
      }
    ]
  }
}
```

S3 + CloudFront：

- Upload `index.html` / `release.json` 時設定 `Cache-Control: no-cache, max-age=0, must-revalidate`。
- Upload `assets/*`、`models/*`、`vendor/*` 時設定長效 cache；若 CDN 不把 `v` query string 納入 cache key，請改 release-prefixed asset path。
- 在 CloudFront Response Headers Policy 設定 CSP、`nosniff`、Referrer-Policy、Permissions-Policy。

GitHub Pages：

- 不支援自訂 response headers，`_headers` 不會被套用。
- 可作 demo/fallback 或停在穩定版本，但不應視為 production security headers 的驗收來源。
- Cloudflare Pages 已作為 primary hosting 時，GitHub Pages 不需要例行更新；若保留公開 URL，請避免在對外文件中把它標示為正式站。
- 若必須暫時使用 GitHub Pages production，至少保留 `npm run smoke:release` 與人工相機驗收，並把「無法 enforce CSP/cache headers」列為 release risk。

## Rollback 策略

### Hosting deployment rollback

Cloudflare Pages production 可回退到先前成功的 production deployment。流程：

1. 從 Cloudflare Pages Deployments 找到上一個健康 deployment id。
2. 手動執行 `.github/workflows/rollback.yml`。
3. 輸入：
   - `environment=production`
   - `cloudflare_deployment_id=<target deployment id>`
   - `smoke_url=<production URL>`
   - `expected_commit_sha=<上一版 release.json commit 前綴>`
   - `expected_version=<上一版 package version>`
4. Workflow 呼叫 Cloudflare rollback API。
5. `npm run smoke:release` 驗證 rollback 後 URL 的資產與版本。

### Artifact / commit rollback

若 hosting rollback 不適用，使用 workflow dispatch 重建舊版 ref：

```text
workflow: Deploy
target=production
ref=<上一個健康 commit SHA 或 tag>
```

此路徑會重新 build 舊 commit、上傳 artifact、部署 staging、跑 staging smoke，通過後才部署 production。

### Rollback 驗證

Rollback 完成後至少確認：

- `release.json.commitSha` 符合預期上一版。
- `release.json.version` 符合預期上一版。
- `index.html` 指向的 `assets/index-*.js` / `assets/index-*.css` 可讀。
- `models/necklace.draco.glb`、`draco/draco_decoder.wasm` 與 MediaPipe vendor 重要資產沒有 404。
- Showcase 初始畫面無 console error；相機與 iOS Safari 仍需人工實機抽測。
- 若 rollback 是為了解 runtime crash，先查 error reporting 是否停止出現新版 release 的同類 event，再用 `SMOKE_BASE_URL=<production-url> EXPECTED_COMMIT_SHA=<old-sha> npm run smoke` 做完整 browser smoke。

## 參考官方文件

- Cloudflare Pages preview deployments: https://developers.cloudflare.com/pages/configuration/preview-deployments/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages rollbacks: https://developers.cloudflare.com/pages/configuration/rollbacks/
- Netlify Deploy Previews: https://docs.netlify.com/deploy/deploy-types/deploy-previews/
- Vercel Git deployments: https://vercel.com/docs/deployments/git
- Firebase Hosting GitHub integration / preview channels: https://firebase.google.com/docs/hosting/github-integration
- GitHub Pages custom workflows: https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Amazon S3 Versioning: https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html

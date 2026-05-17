# 部署與發布流程

本文定義商業化前可接受的靜態前端部署流程。現階段 repo 已提供可落地的 artifact、metadata、smoke test、Cloudflare Pages workflow skeleton 與 rollback skeleton；正式部署前仍需在 GitHub repository secrets / environments 補齊 hosting credentials。

## 目前限制與設計前提

- 專案是純前端 Vite app，正式建置輸出在 `dist/`。
- 相機、MediaPipe live tracking、iOS Safari 實機體驗不可作為 CI 必通條件；部署 smoke 只檢查 showcase 可載入、版本 metadata 與核心靜態資產。
- `vite.config.js` 保持 `base: './'`，確保 GitHub Pages 子路徑、Cloudflare Pages 根路徑、Netlify/Vercel preview URL 都能使用相對 build assets。
- runtime 資產已透過 `import.meta.env.BASE_URL` 組出 `models/`、`thumbnails/` 與 MediaPipe vendor 路徑，避免 GitHub Pages 子路徑 404。
- GitHub Pages 目前保留為 fallback / demo channel，不在本次 workflow 直接替換；商業化 primary hosting 建議改由 Cloudflare Pages 或等價平台承接。

## 環境規劃

| 環境 | 觸發 | 用途 | 部署條件 | 驗證 |
| --- | --- | --- | --- | --- |
| PR preview | Pull request opened / synchronized | 給 PM、設計、QA、客戶看單一 PR 改動 | CI build artifact 成功，且 hosting secrets 可用 | `npm run smoke:release` 檢查 preview URL |
| staging | push 到 `staging` branch，或手動 dispatch target=`staging` | 合併前/發布前的整體驗收環境 | lint/typecheck/unit/build/budget 成功 | staging URL 必須 smoke 通過 |
| production | GitHub Release published，或手動 dispatch target=`production` | 正式公開環境 | 同一個 artifact 先部署 staging 並 smoke 通過 | production URL smoke 驗證 |

Production deploy 在 `.github/workflows/deploy.yml` 中明確依賴 `smoke-staging`。若 staging smoke 無法取得 URL 或驗證失敗，production job 不會執行。

## Hosting 選型

### 建議排序

1. **Cloudflare Pages（建議 primary）**
   - 優點：靜態資產 CDN 非常適合本專案；官方支援 PR preview deployments、branch preview、Direct Upload with Wrangler、production rollback。
   - 取捨：若使用 Direct Upload，需自行管理 GitHub Actions 與 secrets；preview deployment 不是 production rollback target。
   - 適合本專案原因：目前是純靜態 app，資產含 GLB、WASM、data files，Cloudflare edge cache 與 Pages preview 模型足夠；可保留 GitHub Actions 的品質閘門後再上傳 prebuilt `dist/`。

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

### GitHub Pages 保留或替換策略

- 短期保留 GitHub Pages 作為 demo/fallback，不破壞既有 `https://cooby19.github.io/ar_necklace/`。
- 商業化 primary domain 建議切到 Cloudflare Pages。GitHub Pages 可留作「最新 main demo」或停在穩定版本。
- 若仍使用 GitHub Pages production，建議改成 GitHub Pages custom workflow，使用 `actions/upload-pages-artifact` 與 `actions/deploy-pages` 從同一份 `dist/` artifact 發布，避免手動更新 `gh-pages` 分支。

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

## CI artifact

`.github/workflows/ci.yml` 的 build job 會上傳：

```text
ar-necklace-dist-${GITHUB_SHA}
```

內容為完整 `dist/`，保留 30 天。artifact 可用於：

- 查驗某個 commit 實際 build 內容。
- 比對 `release.json` 的 version / commit / buildTime。
- 必要時下載後手動上傳到 hosting 平台。

## CD workflow skeleton

`.github/workflows/deploy.yml` 已建立以下流程：

1. Resolve target：依 event 決定 `preview` / `staging` / `production`。
2. Secret preflight：沒有 secrets 時 deploy jobs 會跳過，不假裝部署成功。
3. Build deploy artifact：執行 lint、typecheck、unit、build、budget，並上傳 `dist/` artifact。
4. PR preview：用 Cloudflare Pages branch deploy `pr-<number>`。
5. Staging：部署到 Cloudflare Pages `staging` branch，接著跑 smoke。
6. Production：只有 staging smoke 成功後，才把同一份 artifact 部署 production。
7. Production smoke：若有 `PRODUCTION_URL`，部署後檢查版本與資產。

需要設定的 GitHub Secrets：

```text
CLOUDFLARE_API_TOKEN
CLOUDFLARE_ACCOUNT_ID
CLOUDFLARE_PAGES_PROJECT
STAGING_URL
PRODUCTION_URL
```

建議設定的 GitHub Environments：

- `pr-preview`：可不需人工 approval。
- `staging`：可不需人工 approval，但限制可部署 branch。
- `production`：必須開 required reviewers，禁止未審核直接部署。

Cloudflare token 最小權限建議只授予該 Pages project 的 deploy/rollback 所需權限，不要使用全帳號管理 token。

## Release versioning

建議流程：

1. 更新 `package.json` version，例如 `0.2.0`。
2. 合併功能到 `main`。
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

## Smoke 驗證

部署 smoke 使用：

```bash
SMOKE_BASE_URL=https://example.com/ npm run smoke:release
```

可選版本驗證：

```bash
SMOKE_BASE_URL=https://example.com/ \
EXPECTED_COMMIT_SHA=<sha-prefix> \
EXPECTED_VERSION=0.2.0 \
npm run smoke:release
```

目前檢查：

- `index.html` 可讀。
- `dist/assets` 中 JS/CSS 可讀。
- `release.json` 可讀且包含 `version`、`commitSha`、`buildTime`、`environment`。
- `models/necklace.glb` 可讀。
- MediaPipe `face_mesh.js`、packed assets data、SIMD wasm 可讀。

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
- `models/necklace.glb` 與 MediaPipe vendor 重要資產沒有 404。
- Showcase 初始畫面無 console error；相機與 iOS Safari 仍需人工實機抽測。

## 參考官方文件

- Cloudflare Pages preview deployments: https://developers.cloudflare.com/pages/configuration/preview-deployments/
- Cloudflare Pages direct upload: https://developers.cloudflare.com/pages/get-started/direct-upload/
- Cloudflare Pages rollbacks: https://developers.cloudflare.com/pages/configuration/rollbacks/
- Netlify Deploy Previews: https://docs.netlify.com/deploy/deploy-types/deploy-previews/
- Vercel Git deployments: https://vercel.com/docs/deployments/git
- Firebase Hosting GitHub integration / preview channels: https://firebase.google.com/docs/hosting/github-integration
- GitHub Pages custom workflows: https://docs.github.com/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- Amazon S3 Versioning: https://docs.aws.amazon.com/AmazonS3/latest/userguide/versioning-workflows.html

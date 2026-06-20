# 如何部署（Cloudflare Pages + CI/CD）

> 部署目標、CI/CD 流程、secrets、headers/cache、rollback 的 AI 速查。
> 完整細則見 [../deployment.md](../deployment.md) 與 [ADR-0001](../adr/0001-cloudflare-pages.md)。

## 負責什麼

把驗證過的 `dist/` 發布到 **Cloudflare Pages**（primary）。流程是 GitHub Actions 先 build/test/smoke，再用 Wrangler Direct Upload 上傳 prebuilt `dist/`。GitHub Pages 僅作歷史 demo/fallback，**不**作正式安全 header/cache 驗收來源。

## 包含什麼

- `vite.config.js`：預設 `base: '/'`（Cloudflare Pages 根路徑）；注入 release metadata 與 `__SITE_URL__`。
- `public/_headers` → `dist/_headers`：CSP、`Permissions-Policy: camera=(self)`、Cache-Control。
- `.github/workflows/ci.yml`：quality / a11y / visual / build 閘門（見 [verify.md](verify.md)）。
- `.github/workflows/deploy.yml`：PR preview / staging / production Direct Upload。
- `.github/workflows/rollback.yml`：Cloudflare Pages rollback + `smoke:release` 驗證。
- `.github/workflows/update-visual-baselines.yml`：在 Linux/CI 更新 visual baseline。

## 如何運作

環境（`deploy.yml`）：
- **PR preview**：PR 開啟/更新 → Cloudflare Pages branch deploy `pr-<number>` → `SMOKE_BASE_URL` 遠端 smoke。
- **staging**：push `staging` 或手動 dispatch → 部署後 smoke。
- **production**：push `master`/`main`、release published 或手動 `target=production` → **依賴 `smoke-staging` 成功** → 同一份 artifact 部署 production → production smoke。

沒有 Cloudflare secrets 時 deploy job 會跳過（不假裝部署成功）。

release metadata 每次 build 產生：`dist/release.json`、`window.__AR_NECKLACE_RELEASE__`、console `[release]`、debug panel（version/commitSha/buildTime/environment）。

## Secrets

必填：`CLOUDFLARE_API_TOKEN`、`CLOUDFLARE_ACCOUNT_ID`、`CLOUDFLARE_PAGES_PROJECT`（Wrangler `--project-name`，非 repo 名/非 URL）。
可選：`STAGING_URL`、`PRODUCTION_URL`（build-time `VITE_SITE_URL` 注入 + smoke fallback；未設定則 fallback 到 `<project>.pages.dev` / `staging.<project>.pages.dev`）。
建議 `production` environment 開 required reviewers；token 給最小權限。

## Headers / cache（`public/_headers`）

- `index.html`、`release.json`：`no-cache, must-revalidate`。
- `assets/*`（hashed JS/CSS）、`models/*`、`draco/*`、`vendor/mediapipe/face_mesh/*`：`public, max-age=31536000, immutable`（runtime 資產靠 release token query 當 cache key）。
- CSP `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'`（MediaPipe runtime，見 [ADR-0003](../adr/0003-mediapipe-csp.md)）；`connect-src` 含 Sentry ingest。

## 部署前/後檢查

- 前：`npm run lint`、`npm run typecheck`、`npm test`、`npm run build`、`npm run budget`、`npm run smoke` 通過。
- 後：對 production URL 跑 `SMOKE_BASE_URL=<url> npm run smoke`，確認 CSP/Permissions-Policy/Cache-Control/release metadata、JS/CSS、`models/necklace.draco.glb`、`draco/draco_decoder.wasm`、`vendor/mediapipe/face_mesh/*` 無 404，深連結可重現款式與逐 target 顏色。相機/iOS Safari 人工抽測。

## Rollback

1. Cloudflare Pages Deployments 找上一個健康 deployment id。
2. 手動跑 `rollback.yml`（`environment=production`、`cloudflare_deployment_id`、`smoke_url`、`expected_commit_sha`、`expected_version`）。
3. `smoke:release` 驗版本/header/asset。
或用 `deploy.yml` dispatch 重建舊 ref（`target=production`、`ref=<sha/tag>`），仍先 staging smoke。

## 刪除與修改規範

- **不要**把 GitHub Pages 當正式站；它不支援自訂 response headers，`_headers` 不生效。
- 改 CSP/外部來源時連動 `_headers`、`smoke` 腳本與 [ADR-0003](../adr/0003-mediapipe-csp.md)。
- **不**硬編碼正式站 URL；canonical/OG/JSON-LD/Web Share 由 `VITE_SITE_URL` 注入。
- 刪 workflow/headers 前確認 CD 與 smoke 仍可運作；遵守[全域刪除規範](conventions.md)。

## 相關模組

[verify.md](verify.md) · [public-assets.md](public-assets.md) · [telemetry.md](telemetry.md) · [../deployment.md](../deployment.md) · [ADR-0001](../adr/0001-cloudflare-pages.md) · [ADR-0003](../adr/0003-mediapipe-csp.md)

# 0001 Cloudflare Pages 作為正式部署目標

## Status

Accepted

## Context

此專案是純前端 Vite app，但 runtime assets 包含 GLB、Draco WASM、MediaPipe binary/data/wasm 與 hashed JS/CSS。正式站需要支援安全 headers、長效 cache、PR preview、production deploy 與 rollback。從 `c854965`、`a2d4fd3` 等部署相關 commit 可看出，專案已從 GitHub Pages demo/fallback 轉向 Cloudflare Pages production，並透過 GitHub Actions 先 build/test/smoke，再用 Wrangler Direct Upload 發布同一份 `dist/` artifact。

Vercel 與 Netlify 都能部署靜態站，也有成熟 preview flow；但本專案不是框架式 SSR app，主要需求是 same-origin 大型靜態資產、`_headers`、edge cache、preview deployment、rollback 與可由 GitHub Actions 掌控的品質閘門。

## Decision

正式部署目標採 Cloudflare Pages。GitHub Actions 負責 lint、typecheck、unit、build、budget、smoke，通過後把 prebuilt `dist/` 上傳到 Cloudflare Pages。`public/_headers` 由 Vite 複製到 `dist/_headers`，由 Cloudflare Pages 套用 CSP、Permissions-Policy 與 Cache-Control。GitHub Pages 僅保留為歷史 demo/fallback，不作為正式安全 header 或 cache 驗收來源。

## Consequences

Cloudflare Pages Direct Upload 讓 production 使用同一份已驗證 artifact，避免 hosting 端重複 build。大型 GLB/WASM/data 可以搭配 Cloudflare edge cache 與 release token query string。PR preview 與 staging/production smoke 也能用相同腳本檢查 release metadata、headers、資產與 showcase 基本互動。

代價是需要維護 Cloudflare secrets、Wrangler deploy script、URL fallback 與 rollback workflow。若未來換回 Netlify/Vercel，必須重新驗證 `_headers` 對應設定、cache policy、CSP、preview URL 與 smoke scripts。

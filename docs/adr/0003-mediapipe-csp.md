# 0003 MediaPipe runtime eval 的 CSP 例外

## Status

Accepted

## Context

`fefee0c` 顯示專案曾因 MediaPipe runtime 初始化需求調整 CSP：`script-src` 從只允許 same-origin 與 `wasm-unsafe-eval`，擴充為允許 `unsafe-eval`。MediaPipe Face Mesh 的 vendored runtime 會載入 WASM、binarypb、packed assets，並在 generated runtime 初始化時使用動態 JavaScript 行為。若 CSP 完全禁止 eval，Face Mesh 可能無法初始化，AR 試戴核心流程會失效。

同時，專案有隱私與安全要求：不依賴 CDN、不上傳相機畫面或 landmarks，並用 smoke scripts 驗證 headers、資產與 runtime metadata。

## Decision

正式 CSP 允許 `script-src 'self' 'wasm-unsafe-eval' 'unsafe-eval'`，只為支援 same-origin MediaPipe generated runtime。MediaPipe assets 維持 vendored 到 `public/vendor/mediapipe/face_mesh`，避免額外 CDN script/connect 來源。`scripts/smoke.mjs` 與 `scripts/smoke-release.mjs` 必須驗證 CSP directive，防止部署平台漏套 headers。

## Consequences

Face Mesh 可在 Cloudflare Pages production/preview 中初始化，且 asset 路徑、cache 與 release token 可由本專案控制。此例外也讓 CSP 比純靜態 UI 更寬，因此任何新增第三方 script、worker、CDN 或 runtime eval 需求，都必須重新審視 CSP、smoke scripts 與本 ADR。

如果未來改用不需要 runtime eval 的 face tracking library，或 MediaPipe 提供可在嚴格 CSP 下運作的 build，應移除 `unsafe-eval` 並更新 smoke checks。

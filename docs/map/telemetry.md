# telemetry（src/telemetry/*）

> Optional 錯誤上報與其隱私邊界。
> 改錯誤上報或要確認「什麼絕對不能上傳」時讀這個檔。

## 負責什麼

提供 optional、Sentry envelope-compatible 的輕量 error reporter，不把 SDK 或 secret 當成 build 必要條件，並守住隱私邊界。

## 包含什麼

- `RuntimeErrorReporter.js`：全域 error / `unhandledrejection` / resource load error，以及 GLB、MediaPipe、WebGL 錯誤的上報邊界；`installGlobalHandlers()`、`captureError()`、`getPublicStatus()`。

## 如何運作

- `main.js` 開機時 `runtimeErrorReporter.installGlobalHandlers()`，並把 `getPublicStatus()` 暴露到 `window.__AR_NECKLACE_ERROR_REPORTING__`。
- 啟用方式：build 時設 `VITE_ERROR_REPORTING_DSN`（client public key，非 server secret）、`VITE_ERROR_REPORTING_SAMPLE_RATE`。未設定時 reporter 保持 disabled，不影響 build/test/smoke。
- 每筆 event 帶 release metadata（version/commitSha/buildTime/environment）。

## 如何部署

DSN 由 hosting secret/環境變數管理；CSP `connect-src` 已含 `https://*.ingest.sentry.io`。完整設定見 [deploy.md](deploy.md) 與 [deployment.md](../deployment.md)。

## 如何檢驗

`npm run smoke` 會確認 error reporting public status 已注入 runtime。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- **隱私邊界（不可違反）**：不得上傳相機 frame、canvas、使用者照片、share capture data URL/Blob、MediaPipe landmarks/world landmarks/debugData 或原始 FaceMesh results。event context 只保留 release metadata、錯誤訊息、stack、asset path/status、feature/event type。
- 改用完整 `@sentry/browser` 時維持同規則：不開 Session Replay、不附 screenshots、breadcrumbs 不得含相機 frame/landmarks，並在 CSP `connect-src` 加實際 ingest domain。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[deploy.md](deploy.md) · [config-layer.md](config-layer.md) · [conventions.md](conventions.md)

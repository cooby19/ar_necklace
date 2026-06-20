# 協作與維護規範（含刪除要求）

> 動手前的硬規則：刪除要求、隱私、純前端、分層、文件語言、commit/PR。
> 任何改動前都該掃過這一頁。

## 刪除要求（最重要）

- **禁止批量刪除**檔案或目錄。
- **不得使用** `del /s`、`rd /s`、`rmdir /s`、`Remove-Item -Recurse`、`rm -rf`。
- 需要刪除時，**一次只刪一個明確路徑的檔案**。
- 若需批量刪除，**停止操作並請使用者手動刪除**。
- 刪任何模組/資產前，先確認引用端已一併處理（facade、`createAppRuntime.js`、`index.html`、CSS、測試、`_headers`）。

## 隱私邊界

不得上傳相機畫面、截圖 Blob/data URL、Face Mesh landmarks/world landmarks、debugData 或原始 FaceMesh results 到任何 telemetry。細節見 [telemetry.md](telemetry.md)。

## 架構規範

- 維持**純前端**，不引入後端或新依賴，除非需求明確要求。
- `AppRuntimeController` 維持輕量 routing；新副作用放對應 `use-cases/*`、`*Service.js` 或 `*Workflow.js`，再由 controller 轉發（[ADR-0004](../adr/0004-runtime-use-cases.md)）。
- 不要把 camera/session、模型 catalog/color、render loop、校準、分享、telemetry/debug 組裝塞回 controller。
- 不要把 router 邏輯放進 `AppState.js`；`router.js` 維持純函式 + `hashchange` 綁定。
- 調整 session lifecycle 先更新 `AR_SESSION_STATES`、合法 transition 與 stale data 清理（[concept-session-lifecycle.md](concept-session-lifecycle.md)）。
- 改追蹤效果先調 `config/tuning.js`、`config/necklaces.js`，再動核心演算法（[concept-face-tracking.md](concept-face-tracking.md)）。
- 新增款式：GLB 放 `public/models/`，在 `config/necklaces.js` 用 `versionedPublicAssetUrl()` 加一筆（[concept-model-assets.md](concept-model-assets.md)）。
- 新增可換色款式：GLB material name 用 `Colorable_Metal`/`Colorable_Pendant`/`Colorable_Gem`，再補 `colorCustomization.targets`（[concept-color-customization.md](concept-color-customization.md)）。

## 文件語言與單一事實來源

- README 與維護文件**優先繁體中文**；技術名詞（`Depth Buffer`、`landmarks`、`GLB`、`mesh`、`pivot`…）可保留英文。
- 細節只寫在 `docs/map/` 模組檔；`AGENTS.md`、`README.md` 只導覽、不複製內容，避免再次 drift。
- 改動程式時同步更新對應模組檔，讓檔名/流程與程式一致。

## Commit / PR（細則見 [../CONTRIBUTING.md](../CONTRIBUTING.md)）

- Conventional Commits：`feat` / `fix` / `refactor` / `test` / `docs` / `ci` / `chore`。
- 改 controller / use-case / session lifecycle / CSP / deployment 時，在 commit body 說明動機與取捨。
- PR 前至少跑相關 `npm test`；共享流程/發布前跑完整閘門（[verify.md](verify.md)）。
- 改相機/Face Mesh/座標轉換/GLB/renderer 時補單元測試並安排實機驗證。
- 改 router/款式/換色/URL sync 時測深連結並確認換色不累積 history（[concept-routing-deeplinks.md](concept-routing-deeplinks.md)）。

## 相關模組

[INDEX.md](INDEX.md) · [app-layer.md](app-layer.md) · [telemetry.md](telemetry.md) · [verify.md](verify.md) · [../CONTRIBUTING.md](../CONTRIBUTING.md) · [../adr/](../adr/)

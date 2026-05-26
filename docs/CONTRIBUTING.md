# 貢獻指南

本指南整理本機開發、commit、PR 與漸進式 TypeScript 規則。架構背景請先讀 [ARCHITECTURE.md](./ARCHITECTURE.md)，重大決策請查 [ADR](./adr/)。

## 本機開發

```bash
npm install
npm run dev
```

常用品質檢查：

```bash
npm test
npm run lint
npm run typecheck
npm run build
npm run budget
npm run smoke
npm run test:visual
npm run test:a11y
npm run lighthouse
```

`npm run dev` 使用 Vite，預設 port 是 `5173`。相機權限通常需要 `localhost` 或 HTTPS。`budget` 與 `smoke` 需要先有 build artifact；遠端部署檢查可設定 `SMOKE_BASE_URL`。

## Commit Message

建議使用 Conventional Commits，並沿用 repo 既有的 `docs:`、`feat:` 風格：

- `feat:` 新增使用者可見能力。
- `fix:` 修正 bug 或行為回歸。
- `refactor:` 不改變外部行為的結構調整。
- `test:` 新增或調整測試。
- `docs:` 文件與 ADR。
- `ci:` GitHub Actions、部署或品質閘門。
- `chore:` 依賴、工具或非產品行為更新。

標題保持短句。若改動 controller / use-case / session lifecycle / CSP / deployment，請在 commit body 說明動機與取捨，避免之後只能從 diff 猜原因。

## PR 檢查清單

- 測試：至少跑與改動相關的 `npm test`，共享流程或發布前改動需跑完整品質閘門。
- Lint / typecheck：`npm run lint` 與 `npm run typecheck` 必須通過。
- Build：部署、資產、CSP、Vite base path 或 release metadata 改動需跑 `npm run build`。
- 文檔同步：README、AGENTS、ARCHITECTURE、CONTRIBUTING、ADR 與實際檔名/流程要一致。
- CSP 影響：新增外部網域、worker、blob/data URL、WASM 或 runtime eval 需求時，同步更新 `public/_headers`、smoke scripts 與 ADR。
- Cloudflare Pages：PR 需要貼 preview link；部署相關 PR 需確認 production/staging URL、release metadata、cache header 與 smoke 結果。
- 深連結：改 `src/app/router.js`、款式 catalog、換色 state 或 URL sync 時，需測 `#n=<necklaceId>`、`#c=<colorId>`、`#c.<targetId>=<colorId>`、無效值忽略，以及換色後不累積 browser history。
- 相機與 WebGL：改相機、Face Mesh、座標轉換、GLB 載入或 renderer lifecycle 時，補單元測試；合併前安排瀏覽器或實機驗證。
- 隱私：不得上傳相機畫面、截圖 Blob/data URL 或 Face Mesh landmarks 到 telemetry。

## TypeScript 遷移規則

目前策略是漸進式 strict boundary，不做一次性全專案轉換，也不打開全域 `checkJs`。

新增檔案時：

- 新的 app use-case、service、core helper 或 telemetry boundary 優先加 `// @ts-check`。
- 跨檔案共享 domain shape 放在 `src/types/domain.ts`。
- service 依賴的窄 port 放在 `src/types/app-ports.ts`、`src/types/ui-ports.ts`、`src/types/scene-ports.ts`，或先放 local typedef。
- 不要把整個 `UiRoot` 或大型 Three.js 實作 surface 暴露成全域共享型別；use-case 應只宣告自己需要的方法。
- 測試可以保持 `.js`，但新增測試資料應貼近 domain shape，避免用不存在欄位讓型別邊界失真。
- 若某段 DOM 或 WebGL 噪音太高，先抽小 helper 或窄 port，再逐段加 `// @ts-check`。

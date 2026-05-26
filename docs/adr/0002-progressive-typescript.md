# 0002 漸進式 TypeScript 邊界

## Status

Accepted

## Context

專案起點是 browser ESM + JavaScript，已累積相機、MediaPipe、Three.js、DOM 控制、GLB 載入、分享與部署 smoke 等多種邊界。一次性轉成全 TypeScript 或打開全域 `checkJs` 會把大量 DOM/WebGL 噪音帶進同一個 PR，容易掩蓋真正的 runtime shape 問題，也會拖慢功能迭代。

Git log 中的 TypeScript 邊界相關 commit 顯示，專案已採 `allowJs: true`、`checkJs: false`、`strict: true`，先保護 app state、domain types、port types、scene services 與低噪音 use-case/service。

## Decision

採漸進式 TypeScript。共享資料形狀放在 `src/types/domain.ts`；app/UI/scene 依賴面用 `src/types/app-ports.ts`、`src/types/ui-ports.ts`、`src/types/scene-ports.ts` 或 local typedef 描述。新的低噪音 service、use-case、core helper 優先加 `// @ts-check`。高 DOM 或大型 Three.js surface 先用窄 port 隔離，不急著整包轉型。

## Consequences

這讓 `npm run typecheck` 能先抓住 session lifecycle、MediaPipe results、model/color、calibration、share、scene resource lifecycle 與 telemetry shape 錯接。新增程式碼也能逐步靠近 strict boundary，而不要求一次處理全部歷史 DOM 細節。

代價是 repo 會短期維持 `.js`、局部 `// @ts-check` 與 `.ts` 並存。文檔必須清楚說明哪些邊界已受保護，哪些仍是暫時性妥協；新增型別時也要避免把 `UiRoot` 或 Three.js 實作細節暴露到全專案。

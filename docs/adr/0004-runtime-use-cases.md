# 0004 AppRuntimeController 只保留 routing

## Status

Accepted

## Context

runtime wiring 曾同時保留歷史相容 shim、兩套 UI 命名，以及一個同時轉發 UI handler 又直接執行副作用的 controller。這會讓新貢獻者或 AI agent 依舊命名 import 到錯誤入口，也會讓模式切換、debug toggle、頁面可見性、showcase 拖曳等副作用散落在 controller 內。

本專案已經有明確 use-case/service 分層：相機、追蹤、模型、校準、分享都各有 use-case 或 service。controller 再持續承擔副作用，會讓分層規則失去可執行性。

## Decision

`AppRuntimeController` 保留為 UI handler routing layer。模式與顯示副作用搬到 `ModeUseCase`；showcase/AR 指標事件搬到 `StageInteractionUseCase`；初始化、背景暫停/恢復與預載入搬到 `RuntimeLifecycleUseCase`。UI composition 統一使用 `uiRoot` 命名，描述它是 DOM 樹根與 UI port，而不是另一個 controller 物件。

## Consequences

`src/main.js` 仍只需要建立 `UiRoot`、runtime services 與 `AppRuntimeController`，UI callback surface 不變。副作用現在落在語意對應的 use-case，測試也能直接保護模式切換、生命週期與舞台互動。代價是 use-case 檔案數增加，但每個檔案的責任邊界更清楚，文檔與 import 路徑也不再暗示不存在的 controller。

# ui 層（src/ui/* + src/styles/*）

> Presentation：DOM query、event binding、狀態文字、表單控制、底部面板、focus/a11y。
> 改畫面區塊、按鈕、面板、無障礙時讀這個檔。

## 負責什麼

`UiRoot` 知道按鈕、色票、canvas 與面板，並把使用者操作轉成 handler 呼叫；**但不應**知道相機如何恢復、Face Mesh 如何初始化、GLB 怎麼釋放，也**不直接**改 `AppState`。它把這些 intent 交給 `AppRuntimeController`。

> 注意：`UiRoot` 已從單一巨類拆成 **composer/facade**，底下由多個專責 View 組成。舊文件曾把 `src/ui/` 描述成只有 `UiRoot.js`，已過時——以本檔為準。

## 包含什麼

- `UiRoot.js`（+`.test`）：**composer**。建立下列各 View、合併它們的 `elements`、`bind()` 轉發 handler、`syncFromState()` 把 snapshot 同步到畫面。
- `domHelpers.js`：`queryRequired` / `queryRequiredAll`、listener registry、focusable 掃描、radio keydown、clamp、數值格式化等共用 DOM 工具。

各 View（各自擁有一塊 DOM 與其 `elements`）：
- `AppShellView.js`：`#app`、`.stage`、相機 video、`#threeCanvas`、`#debugCanvas`、live pill、mode 按鈕、panel tabs、control panels、AR sections。
- `GalleryView.js`（+`.test`）：`#galleryScreen` 款式牆、款式卡片（`onGallerySelect` 進入體驗）、返回 gallery 按鈕。
- `CameraToolbarView.js`（+`.test`）：開始/切換/停止相機、截圖、項鍊顯示 toggle、Debug toggle。
- `NecklacePanelView.js`：款式卡片與 select（`onNecklaceSelect`，含 radio 鍵盤導覽）。
- `ColorPanelView.js`（+`.test`）：色票群組、色票語意（meaning chip/keywords）、色票可用性提示。
- `CalibrationPanelView.js`（+`.test`）：垂直位移/縮放/旋轉 range、校準提示、儲存/重設按鈕。
- `ShareSheetView.js`（+`.test`）：分享 sheet、預覽圖、下載/分享按鈕、背景 inert 與 focus trap。
- `DeveloperPanelView.js`（+`.test`）：FPS、推論 ms、臉寬、yaw、scale、模型 URL、材質命中數、release 版本。
- `StatusPanelView.js`（+`.test`）：追蹤狀態點、狀態標籤與 metrics 文字。

樣式（`src/styles/*`，由 `index.css` 匯入）：
- 入口 `index.css` → `reset.css`、`tokens.css`、`layout.css`、`states.css`、`responsive.css`、`accessibility.css`。
- `styles/components/*`：`gallery`、`stage`、`buttons`、`controls`、`camera-controls`、`color-swatch`、`product-card`、`bottom-sheet`、`share-sheet`、`calibration`、`developer-panel`。

頁面骨架在根目錄 `index.html`（含 SEO/OG/Twitter/JSON-LD/manifest link 與三層疊放的 video/three/debug canvas）。

## 如何運作

`main.js` 建 `UiRoot` → `uiRoot.bind(handlers)` 把每個 View 的事件接到 controller method → `appState.subscribe` 時呼叫 `uiRoot.syncFromState(snapshot, meta)`。窄螢幕用底部面板與分頁式控制避免壓縮預覽區。Gallery↔Experience 兩個畫面由 `route` 切換，見 [concept-routing-deeplinks.md](concept-routing-deeplinks.md)。

## 如何部署

不直接部署；CSS/HTML 由 Vite build 進 `dist/`。視覺與無障礙驗收見下。

## 如何檢驗

- `npm run test:visual`：Playwright/Chromium 比對 gallery、showcase shell、share sheet 的桌面/平板/手機截圖（baseline 在 `tests/visual/*-snapshots/`，**於 Linux/CI 產生，勿在 macOS 重產**）。
- `npm run test:a11y`：Playwright + axe-core 掃不需相機權限的 UI 狀態。
- 各 View 的 `.test.js` 在 `npm test` 內。
- 詳見 [verify.md](verify.md)。

## 刪除與修改規範

- `UiRoot` 仍是高 DOM 噪音、**未完整** `// @ts-check`；要推進型別請先抽小 DOM helper 或窄 port，再分段加（見 [types-and-ts.md](types-and-ts.md)、[ADR-0002](../adr/0002-progressive-typescript.md)）。
- View 只負責 DOM 與呈現，**不要**在 View 內直接動 `AppState`、相機或 scene。
- 改 DOM id/class 時，連動 `index.html`、對應 component CSS、`*.test.js` 與可能的 visual baseline。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[app-layer.md](app-layer.md) · [concept-routing-deeplinks.md](concept-routing-deeplinks.md) · [concept-color-customization.md](concept-color-customization.md) · [types-and-ts.md](types-and-ts.md) · [verify.md](verify.md)

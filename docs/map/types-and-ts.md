# types 與漸進式 TypeScript（src/types/* + tsconfig）

> 共享型別與「哪些邊界已被型別保護、哪些刻意還沒」。
> 加型別、查 typecheck 範圍時讀這個檔。

## 負責什麼

用漸進式 strict boundary 保護「runtime 資料形狀容易錯接」的邊界，而**不是**一次性全專案 TypeScript，也**不**打開全域 `checkJs`。

## 包含什麼

- `tsconfig.json`：`allowJs: true`、`checkJs: false`、`strict: true`；只檢查局部 `// @ts-check` 的 `.js`、`.ts` 與 `vite.config.js`。
- `types/domain.ts`：跨檔案共享 domain types（AppState snapshot、MediaPipe/landmark、tracking/debug、config schema、render stats、capture/share、workflow status、release/error reporting）。
- `types/app-ports.ts`、`types/ui-ports.ts`、`types/scene-ports.ts`：App/UI/scene 邊界 port types，避免把大型實作 surface 外洩到全專案。

## 如何運作

- `npm run typecheck` 執行 `tsc --noEmit`。
- 跨檔案共享形狀放 `domain.ts`；只描述某 service 依賴的少量方法放對應 `*-ports.ts` 或檔案內 local port。
- 已納入型別保護的重點：AppState/session lifecycle、config schema（tuning/necklaces）、model/color/calibration/share、MediaPipe→FaceTracker→ArSessionService→TrackingUseCase→NecklaceController 的資料流、低噪音 service/render/capture boundary、scene boundary（NecklaceScene facade 與子服務 + `scene-ports.ts`）、telemetry boundary、pure logic（landmarks/Smoother/WearCalibration/FaceQualityAdvisor）。

## 如何部署

不直接部署；`npm run typecheck` 是 CI quality gate。見 [verify.md](verify.md)、[deploy.md](deploy.md)。

## 如何檢驗

`npm run typecheck` 必須通過。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- **刻意未型別化**：`ui/UiRoot.js`（DOM 噪音高）、`main.js`、`*.test.js`。要推進先抽小 helper/窄 port 再分段加 `// @ts-check`。
- **不要**把 `UiRoot` 或大型 Three.js 實作 surface 暴露成全專案共享型別；use-case 只宣告自己需要的方法。
- 新增型別優先放 `domain.ts` 或對應 `*-ports.ts`。
- 背景與取捨見 [ADR-0002](../adr/0002-progressive-typescript.md)；遷移細則見 [CONTRIBUTING.md](../CONTRIBUTING.md)。

## 相關模組

[app-layer.md](app-layer.md) · [core-layer.md](core-layer.md) · [ui-layer.md](ui-layer.md) · [ADR-0002](../adr/0002-progressive-typescript.md)

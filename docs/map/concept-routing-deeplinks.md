# 概念：Gallery↔Experience 路由與可分享深連結

> 兩個畫面（款式牆 / 試戴體驗）的切換，加上 `#n/#c/#c.<target>` 可分享 hash 與 URL 同步。
> 改路由、深連結、URL 寫回時讀這個檔。

## 負責什麼

維持純前端、Cloudflare Pages 根路徑相容的可分享 state：用 `route` 在 Gallery 與 Experience 間切換，並用 hash 保存款式與逐 target 換色，可複製連結重現相同畫面。

## 包含什麼

- `src/app/AppState.js`：`APP_ROUTES = { GALLERY, EXPERIENCE }`，初始 `route: GALLERY`。
- `src/app/use-cases/RouteUseCase.js`（+`.test`）：`enterExperience(necklaceId)`、`showGallery()`。
- `src/app/router.js`（+`.test`）：純函式 `parseUrlState` / `serializeUrlState` / `installRouter`。
- `src/app/AppRuntimeController.js`：`applyInitialUrlState`、`applyUrlState`、`applyPendingUrlColors`、`isApplyingUrlState`。
- `src/main.js`：`appState.subscribe` 內的 hash 寫回。
- UI：`GalleryView`（款式卡片 `onGallerySelect`、返回鍵 `onBackToGallery`）。

## 如何運作

**路由**：初始在 Gallery。點款式卡 → `enterExperience(id)` → `route=EXPERIENCE`；返回 → `showGallery()` → `route=GALLERY`。`main.js` 只在 `route===EXPERIENCE` 時序列化 hash，回到 gallery 時清空 hash。瀏覽器 Back 到空/未知 hash 會回 gallery。

**URL schema**：

```text
#n=<necklaceId>                       # 必填款式
#n=<necklaceId>&c=<fallbackColorId>   # fallback 換色
#n=<necklaceId>&c.<targetId>=<colorId># 逐 target，優先於 fallback
# 例：#n=crystal-cone-necklace&c.metal=citrine&c.gem=amethyst
```

**規則**：
- `parseUrlState` 支援有/無 `#`，忽略未知 key 與空值，用 `URLSearchParams` decode。
- `serializeUrlState` 回不含 `#` 的字串；不序列化 null/空字串/空物件；順序固定 `n` → `c` → 字母序 `c.<target>`。
- 初始 hydration **不**呼叫 `selectNecklace()`（避免預設款與目標款雙載）；改用 `url-hydrate` patch 更新 state，再由初始 `loadSelectedNecklace()` 載入。
- `getColorableTargets()` 在模型載入前通常為空，逐 target 顏色先存 `_pendingUrlState`，模型載完才依實際 target 套色。
- URL 寫回只針對 `selectedNecklace` / `selectedColorIdsByTarget` / `route`，用 `history.replaceState`（不用 `pushState`，換色不累積歷史）。
- `appState.subscribe` 一定先 `uiRoot.syncFromState(...)`；`isApplyingUrlState()` 為 true 時只跳過 URL 寫回，不跳過 UI sync。

## 如何部署

hash 不送到 CDN/server，Cloudflare Pages 只需回同一份 `index.html`，不需 rewrite 規則。見 [deploy.md](deploy.md)。

## 如何檢驗

`npm test` 的 `router.test.js`、`AppRuntimeController.test.js`、`RouteUseCase.test.js`。改 router/款式 id/palette id/target id 時，手動驗一組深連結（如上例）並確認不雙載、逐 target 優先於 fallback、無效值被忽略、換色不累積 history。`npm run smoke` 也會驗深連結。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- `router.js` 維持純函式 + `hashchange`，**不得** import `AppState`/controller/use-case，**不得**持有 suppression flag（回授抑制由 controller 的 `isApplyingUrlState()` 提供）。
- 改款式/palette/target id 時**必須**同步更新上述測試並手動驗深連結。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[app-layer.md](app-layer.md) · [ui-layer.md](ui-layer.md) · [concept-color-customization.md](concept-color-customization.md) · [concept-session-lifecycle.md](concept-session-lifecycle.md) · [deploy.md](deploy.md)

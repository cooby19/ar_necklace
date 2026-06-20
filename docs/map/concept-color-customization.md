# 概念：項鍊顏色自選

> `Colorable_*` 材質、palette/target 設定與 `applyColor` 規則。
> 改換色、加可換色款式時讀這個檔。

## 負責什麼

純前端換色：依 GLB material name 收集可換色材質，依 palette 改 `material.color`，**不破壞**原本貼圖與透明度。

## 包含什麼

- `src/config/necklaces.js`：每款 `colorCustomization`（`palette` / `defaultColor` / `defaultTarget` / `targets`）。
- `src/core/MaterialCustomizationEngine.js`（+`.test`）：收集可換色材質、套色、材質調校。
- `src/app/ModelCatalogService.js`（+`.test`）：預設色票/target 解析、matched target label、`NecklaceScene.applyColor()` 協調。
- UI：`ColorPanelView`（色票群組與語意提示）。

## 如何運作

設定語意：
- `palette`：色票清單（預設含粉晶/月光石/黃水晶/紫水晶等寶石語意色），每色可附 `meaning` 與 `material` 調校。
- `defaultColor`：切到該款式自動套用的色票 id。
- `defaultTarget`：預設套色目標，通常 `all`（套所有找到的可換色材質）。
- `targets`：可換色材質群組，每組用 `materialNameIncludes` 比對 GLB material name。

GLB material name 約定關鍵字：`Colorable_Metal`（金屬鍊身/扣件）、`Colorable_Pendant`（墜飾主體）、`Colorable_Gem`（寶石/水晶）。

載入後 `NecklaceScene` 收集符合名稱的材質，`applyColor(target, color)` 只改 `material.color`，**不覆蓋/移除** `normalMap`、`roughnessMap`、`metalnessMap`、`aoMap`、`opacity` 等。GLB 若沒有可換色材質，控制欄顯示溫和提示並停用色票，但相機/Face Mesh/追蹤/debug/試戴照常。

逐 target 換色可經深連結 `#c.<target>=<colorId>` 帶入，見 [concept-routing-deeplinks.md](concept-routing-deeplinks.md)。

## 如何部署

不適用（資料與 runtime 邏輯）。

## 如何檢驗

`npm test` 的 `ModelCatalogService.test.js`（預設色/ fallback target / matched label / 套色呼叫）、`MaterialCustomizationEngine.test.js`、`necklaces.test.js`。視覺確認用 `npm run dev`。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- 套色只改顏色，**不得**覆蓋既有貼圖/opacity。
- 新增可換色款式：先在 GLB material name 加 `Colorable_*` 關鍵字並重新匯出，再於 `colorCustomization.targets` 補設定。
- 改 palette id / target id 時，連動[深連結測試](concept-routing-deeplinks.md)。
- 刪檔遵守[全域刪除規範](conventions.md)。

## 相關模組

[config-layer.md](config-layer.md) · [core-layer.md](core-layer.md) · [concept-model-assets.md](concept-model-assets.md) · [concept-routing-deeplinks.md](concept-routing-deeplinks.md)

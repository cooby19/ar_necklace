# 概念：WebGL 資源生命週期與 GLB 快取

> 模型載入/切換/釋放、GLB LRU cache、depth occluder、scene dispose。
> 改模型載入流程或排查 GPU memory 成長時讀這個檔。

## 負責什麼

確保多次切換款式不會累積 GPU memory：切換時 abort 舊載入、釋放舊模型資源、清空 placement/material/cache state，再載入新 GLB。scene 細節集中在 core 層，`ModelCatalogService` 只做款式選擇/載入流程/套色協調。

## 包含什麼

- `src/core/NecklaceScene.js`（+`.test`）：facade，`loadNecklace()` / `applyColor()` / `dispose()`。
- `src/core/GlbAssetLoader.ts`（+`.test`）：GLB ArrayBuffer LRU cache。
- `src/core/ModelResourceDisposer.js`（+`.test`）：遞迴釋放資源。
- `src/core/OccluderProcessor.js`（+`.test`）：depth occluder 材質替換。
- `src/core/NecklacePlacementAdapter.js`、`MaterialCustomizationEngine.js`、`ThreeRendererHost.js`。

## 如何運作

- `loadNecklace(config)` 切換模型時：abort 舊載入 → 釋放舊模型資源 → 清空 placement/model state → 重設材質自訂與 showcase timing → 載入新 GLB。
- `ModelResourceDisposer` 遞迴 traverse Object3D，用 `Set` 對共享 geometry/material/texture 去重；texture 清理涵蓋 normal/roughness/metalness/ao/emissive/alpha/bump/displacement/env/light/specular/transmission 等欄位。
- **不要**在模型切換時釋放 scene-level `environmentMap`；它由 `ThreeRendererHost.dispose()` teardown 時釋放。
- depth occluder 用新 `MeshBasicMaterial` 替換原材質（只寫 depth）；替換前原材質存 `mesh.userData.originalOccluderMaterials`，dispose 時連同原材質、其 texture 與新 occluder material 一起釋放。
- `GlbAssetLoader.glbBufferCache`：CPU 端 ArrayBuffer LRU，最多 5 個最近使用；cache hit 刷新 LRU 順序，超量移除最久未用；解析前 `slice(0)` 避免 GLTFLoader 改到共用 buffer。
- `NecklaceScene.dispose()` 可安全重複呼叫：abort active load → 釋放目前模型 → 清 placement/material/cache → 交 `ThreeRendererHost` 停 resize observer、解除 scene environment、釋放 environmentMap/PMREMGenerator/WebGLRenderer。

occluder 命名與建模見 [concept-model-assets.md](concept-model-assets.md)。

## 如何部署

不適用（runtime WebGL 邏輯）。GLB/Draco 資產見 [public-assets.md](public-assets.md)。

## 如何檢驗

`npm test` 覆蓋 GLB buffer cache LRU、`dispose()` teardown、共享資源去重釋放、occluder 替換前原材質釋放（皆不啟動真實 WebGL）。GPU memory 行為建議 `npm run dev` 多次切款式觀察。詳見 [verify.md](verify.md)。

## 刪除與修改規範

- scene/disposal 細節**只**留在 core 層，不要外洩到 `ModelCatalogService` 或 app 層。
- texture 清理新增欄位時，維持安全泛用掃描，避免漏釋放。
- 刪檔遵守[全域刪除規範](conventions.md)；移除 scene 子服務前先處理 `NecklaceScene.js` facade 引用。

## 相關模組

[core-layer.md](core-layer.md) · [concept-model-assets.md](concept-model-assets.md) · [concept-color-customization.md](concept-color-customization.md) · [public-assets.md](public-assets.md)

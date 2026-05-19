# 項鍊模型資產

預設 GLB 放在：

```text
public/models/necklace.glb
```

瀏覽器執行時，請從 `src/config/necklaces.js` 透過 `versionedPublicAssetUrl('models/necklace.glb')` 組合 URL。本機 dev 通常會解析成：

```text
/models/necklace.glb?v=<version>-<commit>
```

不要在新增款式時硬編碼 `/models/...`，否則部署到 GitHub Pages 子路徑時容易 404。

## 對位建議

- 項鍊 pivot 建議放在項鍊上緣中心或實際佩戴 anchor 附近。
- 模型正面應面向相機，左右以 X 軸置中。
- 模型寬度盡量接近 1 個 Three.js 單位。
- 新模型建議在 `src/config/necklaces.js` 設定 `preserveAuthorOrigin: true`，讓 GLB 作者原點成為 AR anchor。
- 若模型顯示反向、上下顛倒、太大或太小，優先調整 `src/config/necklaces.js` 的 `transform`。

## 脖子遮擋模型

若 GLB 包含用來遮擋項鍊後半段的脖子模型，請保持它是獨立 Blender object 或獨立 mesh，並把 object、geometry 或 material 名稱加入可被 `occluderParts.nameIncludes` 命中的關鍵字，例如：

```text
neck
neck_helper
脖子
頸部
圓柱體
```

程式會把命中的 mesh 標記為 depth occluder：不寫入顏色，但會寫入 Depth Buffer，因此能遮住位於脖子後方的項鍊段。

## 換色材質命名

若希望款式支援色票，請在建模工具中替可換色材質命名加入下列關鍵字，再於 `src/config/necklaces.js` 的 `colorCustomization.targets` 對應設定：

- `Colorable_Metal`：金屬鍊身、扣件或主要金屬部分。
- `Colorable_Pendant`：墜飾主體。
- `Colorable_Gem`：寶石、水晶或可換色裝飾件。

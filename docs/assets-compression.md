# 資產壓縮流程

本專案的 runtime 項鍊模型使用 Draco 幾何壓縮版 GLB。原始 `.glb` 保留在 `public/models/` 作為 fallback 與重新壓縮來源，前端 catalog 應優先指向同名 `.draco.glb`。

## 壓縮命令

```bash
npm run compress:glb
```

流程會掃描 `public/models/**/*.glb`，略過既有 `.draco.glb`，並輸出：

```text
public/models/<name>.draco.glb
```

目前壓縮設定：

- 工具：`gltf-pipeline` + `sharp`
- Draco：`compressionLevel: 10`
- Position quantization：`14`
- Normal quantization：`10`
- Texcoord quantization：`12`
- Unified quantization：啟用，降低多 primitive 接縫風險
- 內嵌 PNG 最長邊：預設壓到 `512px`，保留 PNG 與 alpha

如需調整貼圖上限，可用環境變數：

```bash
GLB_TEXTURE_MAX_SIZE=768 npm run compress:glb
```

## 目前壓縮結果

| 模型 | 原始大小 | 壓縮後大小 | 縮減 |
| --- | ---: | ---: | ---: |
| `public/models/necklace.glb` | 1,583,272 bytes | 261,280 bytes | 83.5% |
| `public/models/necklace_2.glb` | 991,648 bytes | 149,048 bytes | 85.0% |

## 新增或替換模型

1. 將原始 GLB 放入 `public/models/`。
2. 執行 `npm run compress:glb` 產生 `.draco.glb`。
3. 在 `src/config/necklaces.js` 使用 `versionedPublicAssetUrl('models/<name>.draco.glb')`。
4. 確認 `public/draco/` 仍包含 `draco_decoder.wasm` 與 `draco_wasm_wrapper.js`。
5. 執行 `npm run build`、`npm run smoke`，並在瀏覽器檢查模型外觀、UV、法線與水晶反射。

## 部署注意事項

Cloudflare Pages 需讓 `models/*` 與 `draco/*` 使用長效 immutable cache。`public/_headers` 已設定：

- `/models/*`：`Cache-Control: public, max-age=31536000, immutable`
- `/draco/*`：`Cache-Control: public, max-age=31536000, immutable`
- `/draco/draco_decoder.wasm`：`Content-Type: application/wasm`

部署後可用 `npm run smoke:release` 檢查 `.draco.glb`、Draco decoder 與 `.wasm` MIME。

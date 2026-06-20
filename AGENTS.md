# AGENTS — AI 入口

> 這是給 AI / agent 的**入口與路由**頁，刻意保持精簡。
> **細節不在這裡**：請讀架構地圖 [`docs/map/INDEX.md`](docs/map/INDEX.md)，再依任務只打開相關模組檔，不要一次讀完整個 repo。

## 專案定位

純前端 Web AR 項鍊試戴 MVP（Vite + Three.js + MediaPipe Face Mesh）。相機畫面為背景，Face Mesh 偵測單人臉部 landmarks，Three.js 疊 `.glb` 項鍊。位置為下巴/臉寬/臉高/傾斜的 **2D 估算**，非 3D 脖子重建。UI 語言繁體中文（`zh-Hant`）。

## 怎麼用文件（重要）

1. 先讀 [`docs/map/INDEX.md`](docs/map/INDEX.md) 的模組路由表與全域護欄。
2. 依任務只開**最相關的 1～2 個模組檔**（每檔都有 `負責什麼 / 包含什麼 / 如何運作 / 如何部署 / 如何檢驗 / 刪除與修改規範 / 相關模組`）。
3. 需要跨層脈絡時，追模組檔底部的「相關模組」連結。
4. 維護文件的**單一事實來源是 `docs/map/`**；本檔與 `README.md` 只導覽，**不要**在這裡擴寫細節。

## 全域護欄（動手前必讀，細節見 [docs/map/conventions.md](docs/map/conventions.md)）

- **刪除規範**：禁止批量刪除；不得用 `rm -rf` / `del /s` / `rd /s` / `rmdir /s` / `Remove-Item -Recurse`。一次只刪一個明確路徑；需批量刪除時**停手並請使用者手動處理**。
- **隱私**：不得上傳相機畫面、截圖 Blob/data URL、Face Mesh landmarks 或 debugData。
- **純前端**：不引入後端或新依賴，除非需求明確要求。
- **controller 輕量**：`AppRuntimeController` 只做 routing；新副作用放對應 use-case / service / workflow。
- **文件語言**：優先繁體中文，技術名詞可保留英文。

## 常用指令（用途與覆蓋見 [docs/map/verify.md](docs/map/verify.md)）

```bash
npm install
npm run dev          # vite --host 0.0.0.0，port 5173
npm run lint
npm run typecheck
npm test
npm run build
npm run test:visual  # baseline 於 Linux/CI 產生，勿在 macOS 重產
npm run test:a11y
npm run budget       # 先 build
npm run smoke        # 先 build；或設 SMOKE_BASE_URL 檢查遠端
npm run lighthouse   # 先 build
npm run compress:glb
```

## 地圖入口

[`docs/map/INDEX.md`](docs/map/INDEX.md) — 分層相依圖、模組路由表、深入參考（ARCHITECTURE / CONTRIBUTING / deployment / ADR）。

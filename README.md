# 🎙️ WEIAI Studio - Gemini 3.8 台灣在地化 AI 聲優與文字轉語音平台

> 專為台灣在地情境設計的高擬真文字轉語音（TTS）工作台，支援台灣腔調、26+ 位各行各業專業聲優、自訂情緒風格、語氣停頓呼吸標籤與雙人 Podcast 對談合成。

---

## 💡 為什麼之前放上 GitHub 無法正常呈現？

若您之前直接將專案放到 GitHub 或開啟 GitHub Pages 時遇到白畫面或功能無法使用，原因在於：

1. **GitHub Pages 僅為純靜態託管（Static Hosting）**：
   - 原先程式依賴 Node.js Express 後端伺服器（`server.ts`）來中轉 Gemini API。在 GitHub Pages 上**沒有 Node.js 後端環境**，原本向 `/api/tts/*` 發出的請求會全部回傳 `404 Not Found`。
2. **靜態資源路徑解析錯誤（404 白畫面）**：
   - 在 Vite 預設設定下，資源路徑為絕對路徑 `/`，當部署至 GitHub Pages 的子目錄（如 `https://<帳號>.github.io/<專案名>/`）時，瀏覽器會找不到 JS 與 CSS 檔案導致畫面空白。
3. **缺乏前端直接呼叫 Gemini 與安全金鑰儲存機制**：
   - 純前端靜態環境下無法讀取伺服器的環境變數，導致模型無法被呼叫。

---

## 🚀 這次修改為您解決了什麼？

我們已完成全方位的相容性架構升級：

- ✅ **新增 `base: './'` 相對路徑設定**：保證在 GitHub Pages 的任何子路徑、個人網域下皆能正確載入資源，徹底告別白畫面！
- ✅ **全端 / 純前端雙模智慧切換（Dual-Mode Architecture）**：
  - **靜態 GitHub Pages 模式**：前端自動改用客戶端 `@google/genai` 直連 Google 官方 API，不需要任何後端伺服器！
  - **全端伺服器模式**：若在 Node.js / Docker / Cloud Run 等環境執行，則自動切回伺服器安全代理模式。
- ✅ **前端 API Key 獨立設定與本機安全防護**：
  - 頂端導航列新增「**設定 API Key**」彈窗。
  - 金鑰**僅儲存於使用者本人的瀏覽器 LocalStorage**，絕不上傳至 GitHub 或任何伺服器，安全無虞。
- ✅ **未設定金鑰時的免 Key 離線示範（Web Speech Fallback）**：
  - 即使使用者剛進入 GitHub Pages 尚未填寫 API Key，也能立刻體驗語音朗讀，不會跳出白屏或嚴重崩潰。
- ✅ **一鍵自動化 GitHub Actions 部署工作流**：
  - 內建 `.github/workflows/deploy.yml`，每次 Push 到 GitHub 自動打包並發布至 GitHub Pages！

---

## 🛠️ 如何在 GitHub Pages 上啟用這個專案？

請按照以下簡易步驟操作：

### 步驟 1：將程式碼推送至 GitHub
如果您尚未在本地連結此遠端倉庫，可使用下列指令：
```bash
git add .
git commit -m "feat: 支援 GitHub Pages 靜態部署與客戶端 Gemini TTS"
git branch -M main
# 若尚未設定遠端庫，請設定：
# git remote add origin https://github.com/liyachun99-lang/weistudio.git
git push -u origin main
```

### 步驟 2：在 GitHub 啟用 Pages 設定
1. 打開您的 GitHub 儲存庫頁面：`https://github.com/liyachun99-lang/weistudio`。
2. 點擊頂部的 **Settings**（設定）標籤頁。
3. 在左側選單中點選 **Pages**。
4. 在 **Build and deployment** 區塊中的 **Source** 下拉選單：
   - 將原本的 **Deploy from a branch** 改選為 👉 **`GitHub Actions`**。
5. 設定完成後，GitHub 就會自動觸發 Action 工作流並開始建置！

### 步驟 3：取得並訪問網頁
1. 點擊儲存庫頂部的 **Actions** 標籤，等待「Deploy WEIAI Studio to GitHub Pages」顯示綠色勾勾（約 1~2 分鐘）。
2. 工作流完成後，回到 **Settings -> Pages**，上方即會顯示您的專屬網址：
   👉 **`https://liyachun99-lang.github.io/weistudio/`**
3. 點擊開啟即可正常瀏覽！

---

## 🔑 在 GitHub 網頁上開始使用

1. 打開 GitHub Pages 網址後，點擊右上角亮起的 **「設定 API Key」** 按鈕。
2. 貼上您的 **Google Gemini API Key**（若尚未擁有，可點擊彈窗內的連結免費向 [Google AI Studio](https://aistudio.google.com/app/apikey) 申請）。
3. 點擊「**測試連線**」確認金鑰正常，然後按下「**儲存設定**」。
4. 大功告成！您現在可以在 GitHub 靜態網頁上暢快體驗：
   - 26+ 位台灣在地職業聲優（醫師、護理師、營養師、教師、心理師等）。
   - 插入台式語氣標籤（換氣 `<breath>`、停頓 `[停頓 0.5s]`、笑聲 `<laugh>` 等）。
   - 一鍵 AI 潤飾為道地生活口吻。
   - 雙人 Podcast 對談語音即時合成。

---

## 💻 本地端開發與自架伺服器模式

若您想在本地開發或部署到支援 Node.js 的全端平台（如 Docker、Render、Cloud Run、Railway 等）：

```bash
# 1. 安裝依賴套件
npm install

# 2. 複製環境變數範例
cp .env.example .env
# 請編輯 .env 填入您的 GEMINI_API_KEY

# 3. 啟動開發伺服器 (包含 Express 後端 API 與 Vite)
npm run dev

# 4. 生產環境打包與啟動
npm run build
npm start
```

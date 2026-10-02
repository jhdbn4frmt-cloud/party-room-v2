# Party Room · 一個房間，玩一整晚

給 4–16 位朋友的繁體中文聚會網站。每人用手機加入一次；主持人選遊戲、分隊、控制回合，電腦或電視顯示公開大螢幕。換遊戲時，身份、隊伍和整晚分數都會保留。

## 先在自己的電腦開玩

需要 Node.js 22 或 24。安裝後，在專案資料夾執行：

```bash
npm install
npm run dev
```

打開終端機顯示的網站位置。要用朋友的手機加入，讓電腦與手機連到同一 Wi-Fi，手機輸入「電腦的區域網路 IP，加上 :3000」。**先用區網 IP 開主持人頁面**，再分享 QR Code；localhost QR 只能由同一台電腦開啟。防火牆須允許 3000 port。關閉電腦上的省電休眠。

正式運行可以改用：

```bash
npm run build
npm start
```

不需 Supabase、Maps、Google Sheet、音樂 API Key 就能玩。房間存在 `.party-data/`，重啟服務仍保留；不要刪除此資料夾或把它公開。房間有效期限為 24 小時。正式跨網路、手機背景切換體驗建議 HTTPS 網站。

## 玩一整晚

1. 建房、輸入主持人暱稱，取得隨機或自訂 4 位數房號（保留前導零）。
2. 用 QR、複製連結、LINE 或系統分享邀請朋友，朋友只需輸入暱稱。
3. 「隊伍」頁隨機／智慧分隊，也能拖曳、下拉移動、鎖定、改隊名。
4. 在遊戲大廳選玩法、個人／團體、回合數、時間與計分方式，開始遊戲。
5. 手機作答，主持人公布、確認計分、下一回合。文字題可人工覆判；同義答案可合併與復原。
6. 結算後回大廳換遊戲，或直接再玩／下一款清單遊戲。
7. 主持人管理可調分、復原、關閉加入、轉移房主；結束 Party 顯示可截圖的戰績卡。

大螢幕路徑為 `/tv/房號`，不含秘密角色、未公布答案或情報短文。請投影此頁，別直接投影主持人的手機畫面。

## 可玩內容

| 遊戲       | 第一版玩法                                             |
| ---------- | ------------------------------------------------------ |
| 同答案挑戰 | 默契、獨特、答案炸彈、答案爆量                         |
| 指揮官     | 秘密排序、兩次猜規則、主持判定                         |
| 星際情報站 | 每隊輪替情報員、短文限時閱讀、口頭轉述、三題問答       |
| 知識問答   | 單選、是非、估數字、排序；三種難度                     |
| 猜音樂     | 前奏、主歌、副歌、間奏、混音、變形；主持人播放合法音源 |
| 詞曲不同調 | 歌名配對、現場唱、主持人判定                           |
| 街景尋寶   | 開外部 Google Maps、限時找目標、提交後主持驗證         |
| 狼人殺     | 五種基礎角色、夜／日／投票、存活、查驗、藥水、主持覆寫 |
| 誰最可能   | 匿名投票、票數比例，預設不計分                         |
| 朋友默契王 | 輪替主角秘密作答，其他人猜答案                         |
| 匿名爆料   | 匿名收集、抽故事猜作者、移除與檢舉隱藏                 |
| 你畫我猜   | 手機畫布、畫筆／橡皮擦／清除、筆畫同步、猜詞           |

題庫以台灣生活、1990–2020 年代的遊戲、音樂、影視、共同回憶為主，也含 1970–1980 年代及跨年代知識。不提供未授權音訊、歌詞或角色圖片。音樂、街景與狼人殺的現場互動需主持人配合。

## 環境變數

可複製 `.env.example` 為 `.env.local`，但不要上傳實際秘密值。

| 名稱                              | 何時使用                                                 |
| --------------------------------- | -------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`        | 部署 Supabase 模式必填                                   |
| `SUPABASE_SERVICE_ROLE_KEY`       | 只供 Next server 存取資料；部署 Supabase 模式必填        |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`   | 保留給未來 Supabase Auth/client adapter；目前 SSE 不需要 |
| `GOOGLE_SHEET_CSV_URL`            | 可選，Google Sheet 發布的 CSV URL                        |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | 可選，預留 Maps embed adapter；本版街景使用外部模式      |
| `PARTY_DATA_DIR`                  | 可選，本機資料夾，預設專案下 `.party-data`               |
| `APP_ORIGIN`                      | 可選，反向代理的正式網站 origin（含 https）              |

Google 平台帳號憑證不等於 Supabase／Vercel 部署權限，網站也不會讀取與本服務無關的憑證。

## Supabase 與資料庫

1. 在你的 Supabase 專案 SQL Editor 執行 `supabase/migrations/202610020001_party_room.sql`。也可用 Supabase CLI 連到指定專案後 `supabase db push`。
2. 設定 URL 與 service role key。**service role key 絕對不能取名 `NEXT_PUBLIC_...`**。
3. 執行 `npm run import:questions -- --seed` 匯入完整題庫。腳本會讀 `.env.local`；不匯入也有內建 seed fallback。
4. 啟動／重啟網站，建房驗證。Supabase 模式讀寫錯誤會直接顯示，不會偷偷改成本機模式。

Migration 建立房間、會員、Session、隊伍、清單、遊戲、回合、答案、題庫秘密、score ledger、能力與房主選舉等資料表。RLS 阻擋 anon/authenticated 直接讀取私密資料、改分或改房主；房間授權由 API 的 Cookie 完成。所有分數修正以追加事件記錄，SQL trigger 禁止改寫／刪除歷史 score_events。

本次交付沒有遠端 Supabase 憑證，因此**未套用到你的雲端資料庫**；migration 會以 PGlite 的真實 PostgreSQL 引擎執行測試，這不等於已部署到遠端 Supabase。

## Google Sheet 題庫

先將 `docs/questions-template.csv` 匯入 Google Sheet，保留欄位名稱。陣列與 metadata 欄位填 JSON，例如 `["是","否"]`。`question_id` 是穩定唯一值，改題時增加 `version`。`enabled=false` 可停用，`review_status=reviewed` 才抽題。年齡與 spice 限制不會因題目不足而自動放寬。

發布：Google Sheet「檔案 → 共用 → 發布到網路」，選 CSV，將 URL 設進 `GOOGLE_SHEET_CSV_URL`。

```bash
npm run import:questions
# 或先測試本機 CSV：
npm run import:questions -- --file=docs/questions-template.csv
# 重新產生範例：
npm run questions:template
```

匯入前會驗證格式與重複 ID；可重複匯入，依 ID 更新。本機與 Supabase 皆支援。網站最多快取題庫 30 秒，更新只影響下一場遊戲，不中斷進行中的回合。此版採 CLI 同步，可用受信任的排程執行，沒有對外開放的匿名同步 API。

## Vercel 部署到原專案

在 Vercel **既有 `party-room` 專案**接上這個 repository；Framework 選 Next.js，Build Command 是 `npm run build`。將上述 Supabase URL 與 service role key 放在 Vercel Environment Variables，先套用 migration，再 Redeploy。

Vercel 的暫存檔案不適合保存多人房間，所以沒有 Supabase 時 API 會明確拒絕建立房間，不會假裝持久化成功。SSE route 的執行上限設定為 60 秒，每條連線 45 秒輪換；請確保所用方案支援這個時長。

此環境目前没有 `.vercel` 綁定或 Vercel token，沒有替你建立新 Vercel 專案，也沒有已部署網址。具備既有專案授權後才可執行正式部署。

## 開發與驗證

```bash
npm run lint
npm run typecheck
npm run test
npm run build
# 先在另一個終端啟動 npm run dev 或 npm start，再執行：
npm run test:simulation
npm run test:browser
```

`test` 涵蓋計分、正規化、隊伍平衡、狀態、權限、所有遊戲、PostgreSQL CAS／RLS、CSV。`test:simulation` 用 15 個獨立 Cookie 與 SSE 真實連線，跑三款遊戲、斷線 21 秒後重連、三房隔離。Playwright 操作真實 UI，包含手機 360/390px、桌面、1920px TV、三款完整流程與排行；保留失敗 trace。

瀏覽器測試預設使用本環境的 `/usr/bin/chromium`。其他電腦設定 `CHROMIUM_PATH` 指向 Chrome／Chromium，或依需求修改 Playwright config 使用已安裝的瀏覽器。`PARTY_TEST_URL` 可指定測試中的伺服器 origin。測試會建立本機測試房間，請勿對正式聚會執行。

目錄與規則細節見 [ARCHITECTURE.md](docs/ARCHITECTURE.md)。`games/` 每款遊戲一個資料邏輯模組與畫面，`features/room` 是共同引擎，`lib/storage` 是本機／Supabase adapter。

## 常見問題與第一版邊界

- **手機掃 QR 無法連線**：主持人頁請用區網 IP 或正式 HTTPS 網址開啟；不能分享電腦自己的 localhost。
- **重整變成新玩家**：相同瀏覽器會恢復原身份；LINE 內建瀏覽器切換 Safari 是另一個 Cookie 空間，請在原瀏覽器重開連結。
- **房主離線**：90 秒內回來保留主持權，超過後由在線玩家選舉。
- **啟動後資料消失**：本機需保留 `.party-data`；多主機與 Vercel 請用 Supabase。
- **多人環境的公平性**：網路延遲不相同，搶答以伺服器收到順序為準。Smart teams 是本場紀錄的啟發式平衡，不是能力評價。
- **狼人殺角色**：基礎角色與主持流程已實作；尚未加入邪惡集會官方特殊角色。主持人不應同時作為需要保密資訊的參賽者。
- **媒體題**：資料結構保留 media adapter，這版 Quiz 主流程是文字／選項／數字／排序；尚未提供內嵌影音題或自動音訊處理。
- **街景**：外部 Maps 尋寶可玩；沒有自動判定或內嵌街景操控。主持人核對提交內容。
- **PWA**：已有 manifest、SVG icon 與 standalone 設定；多人遊戲需要連線，沒有離線遊玩或推播。
- **實機**：自動化手機 viewport 不等於真實 iPhone／Android 硬體測試；正式聚會前仍應用你們的手機及 Wi-Fi 做一次試玩。

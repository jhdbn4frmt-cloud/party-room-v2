# Party Room v2 接續交付（2026-10-02 UTC）

本次已恢復新 v2、完成本機驗證；尚未公開上線，不能將 localhost 或原 Vercel URL 當作本次交付網址。

## 來源與範圍

- 唯一程式起點：歷史新 v2 任務所產出的 `/workspace/artifacts/party-room-v1.zip`（zip 名雖為 v1，內容為 10/1–10/2 新 v2）。
- 原檔 SHA-256：`2bf29c8b34f178b6a098020b12ebf2ff1d29630c2879bc8792c01061eb97ed6d`。
- 已解回 `/workspace/party-room-v2`。9 月原版不在本次交付中；原始 zip 未改動。
- 保留全部 12 款新 v2 遊戲、主持管理、個人/團隊計分、自動/手動分組、LINE/QR 分享、匿名房間 session、TV 公開投影。
- 題數上限由 20 改為 40；主持 UI 增加 20、30、40 回合。修正答案爆量測試隨機抽到同義詞後誤判為失敗的測試資料選取。

## 本次重新執行的驗證

- `npm ci` 成功；lint、TypeScript、production build 通過。
- 單元與資料庫：51 tests / 5 files 通過，含真實 PostgreSQL PGlite 與新 Sites adapter 的真實 SQLite 測試。
- Playwright：4 tests 通過（1.1 分鐘）；4 個独立瀏覽器 session，360/390px 手機、1920px TV，完整三款主流程及其餘控制器互動。已檢視手機結算與首頁截圖。
- 15 人 HTTP + SSE：三款遊戲、三房隔離、21 秒離線後同 Cookie 重連通過；本環境一次同步觀察為 798 ms，非正式網路保證。
- 新增 `scripts/simulate-long.ts`：4 位獨立 Cookie 真實 HTTP 跑完同答案 40 回合，於第 8、9、40 回合核对身份恢復，最後每人 400 分，房间已結束。
- Sites adapter：15 個同時更新的 CAS 重試無丟分；40 回合 SQLite 持久化與 session 恢復通過。此為 adapter 本機測試，**不是已部署 D1**。

沒有真實 iPhone/Android、正式網域、LINE App 跳轉與跨行動網路驗證。猜音樂及詞曲不同調需主持提供合法音源/現場表演；街景是外部 Maps 與人工判定；狼人殺是流程輔助，不是假裝自動辨識。

## 上線阻礙

- 既有 Vercel `6m2cyvjm6v-9736/party-room`：現有 connector 回傳 403，scope 為 `team_iKWpyiquG9j7WwCQ621wHGS8`，需重新授權該 scope。沒有繞過或變更該專案。
- 沒有 Supabase 管理連線/既有可用 server key。`pxkldiautpdjmmjnekqz` 與本案關聯未證實；health 請求遭環境網路 proxy 403，不能據此判斷專案已暫停。新 v2 本機模式不依賴它。
- Sites connector 可用，但本環境沒有 Sites 的 `project-setup.mjs`、`site-workflow.mjs`、`build/sites-vite-plugin.ts`；技能文字可讀，這些可執行支援檔無法讀取。尚未建立 Site，也沒有 hosting project_id。
- Sites 標準 create_site 會返回短效 repo 寫入憑證；在「不生成憑證」限制未釐清前沒有呼叫 create_site / credential creation。沒有付款或新增持久存取。

## 給主線的 Sites 交接（代理執行，非要求使用者設定）

1. 使用具備 Sites plugin 執行檔的環境，從本次 source zip 或 v2 repository 接續，禁止帶入 9 月舊版。新建獨立 Site；`creation_intent=user_requested`，不啟用 workspace connectors。先釐清短效發布憑證是否在既有「不生成憑證」限制外。
2. 使用保留模板流程，移植到 Vinext/Cloudflare Worker；保留所有 app/components/features/games、CSS 與私密 view projection。Next.js `.next/` 不是 Sites 可部署 Worker，不能直接上傳冒充。
3. 需要一個內建 D1 binding `DB`，不需要 R2、外部 Supabase、Maps key 或音樂 key。`deployment/sites/d1-storage.ts` 是已驗證 CAS adapter；將其接到 `lib/storage/index.ts` 的 `transact` / `questionBank`。在 server-only helper 從 `cloudflare:workers` 取得 DB，移除 Worker 使用本機 fs 的路徑。
4. 依 `deployment/sites/schema.sql` 在 starter `db/schema.ts` 定義 party_documents / party_questions，再產生 Drizzle schema-only migration 和 metadata。參考 SQL 沒有被套用到雲端。
5. 保留 server HttpOnly room cookies、權限與答案投影。SSE 目前 900ms 輪詢、45 秒重連；在 Worker/D1 實際重跑現有 browser、simulation、long 測試，確認計時、斷線、cookie secure 及 CAS。不要用 localStorage 當多人資料庫。
6. 使用 Sites workflow helper 產生 Cloudflare-compatible `dist/server/index.js` default fetch Worker、migrations、client assets；source push/save/deploy 必須依技能走完。需要公開訪客 audience 才符合「參加者不需 ChatGPT 登入」。未得到 succeeded 與實測匿名訪問前不要交付可用網址。

此任務沒有建立 Site，因此沒有兩處同時寫同一 Site 的衝突；可由主線在另一環境單獨接管。

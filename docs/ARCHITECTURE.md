# 架構與遊戲規則

## 請求路徑與資料權威

瀏覽器 → Next.js API（Origin、Zod、房間 Cookie 授權）→ Room Engine → Game Module → Store transaction。

- 每個玩家由 256-bit 隨機 token 識別，放在 HttpOnly、SameSite=Lax Cookie。伺服器只保存 SHA-256 雜湊。每個房號有獨立 Cookie；重新整理、短暫斷線不會新增玩家。更換瀏覽器／清除 Cookie 是新的裝置，不能憑暱稱接管別人的身份。
- 房主身分來自資料庫 `hostId`，API 不接受瀏覽器聲稱的 playerId 或 isHost。
- `project()` 對每個連線建立公開、個人、主持人視角。TV 永遠沒有 private、mine、host。題目答案只在揭曉後提供；情報短文在閱讀時間結束後不再提供。已看見的資料無法從使用者記憶或另行截圖抹除。
- Realtime 使用 SSE（Server-Sent Events）。每 900ms 檢查狀態、僅在改變時傳送快照；45 秒輪換連線。瀏覽器自動重新連線，異常時 2.5 秒讀取一次，回到前景立即同步。桌面、iOS Safari、Android 瀏覽器均有原生 EventSource 支援；此版本採用 SSE，未使用 Supabase Realtime channel。
- 在線心跳約 6 秒一次，20 秒無心跳顯示離線。房主所有裝置都離線 90 秒後進入 20 秒選舉；平票再一輪，仍平票由伺服器隨機選出一人。選舉與操作在相同交易中完成。
- Timer 保存伺服器 `startedAt`、`endsAt`，client 以 performance.now 計算相對顯示。伺服器拒絕逾時答案、舊 roundId。暫停保存剩餘毫秒。

## 儲存模式

無 Supabase 變數時使用 `.party-data` 的 JSON 檔案。鎖目錄以原子 mkdir 排他，寫入 temp 後 rename；只有資料有改變才寫檔。適合一台 Node 主機／同一檔案系統，**不能在互不共享磁碟的多個主機部署**。

Supabase 模式使用 PostgreSQL CAS：`read_party_room` 回傳 revision；`save_party_room` 在 row lock 中比對 expected revision，競爭者重新讀取後重做命令。房間 documents 是狀態權威，同交易更新 members、sessions、teams、game_sessions、rounds、submissions 與 ledger 查詢表。Room code 可在已結束／過期後重用，舊 UUID 與歷史仍保留。失敗的交易不會部分計分。

所有 public tables 都啟用 RLS，anon/authenticated 無直接讀寫權限、無 RPC EXECUTE 權限。service role 只留在伺服器。因登入模型是房間 Cookie，而非 Supabase Auth，所以房間授權在 Next API；不要額外開放 client 直接讀 room documents。

## 狀態與計分

`lobby → collecting → revealing → round_result → game_result → lobby`。`paused` 只從 collecting 進入，resume 回 collecting。遊戲內有各自的 reading、describe、arrange、night、day 等階段。

- 相同 requestId 的重送不會重複執行。每位玩家每題只可提交一次；炸彈、爆量、猜畫、指揮官等模式按規則允許多次。提交需帶 roundId。
- 揭曉階段可修正判定／合併答案；按「確認並計分」才寫入 raw ledger。已確認回合不可重寫；後續改分以 adjustment + inverse events 完成。
- 個人賽各自計分；團體賽每題採隊內最高分，分數只進團隊。隊伍 ID 保留歷史，換隊不搬動舊分。已計分隊伍不能刪除。
- 每款結束時 `round(100 × clamp(raw / maximum, 0, 1))` 轉換 Party Score。也可原始累積或不加入整晚分數。難度只乘一次。
- 同答案：默契 `(k−1)/(N−1)`、獨特 `1/k`。爆量最多 10 個基本分、每個稀有答案 +0.5、稀有上限 5。炸彈以存活順序排名，重複／不在題目有效清單／超時出局。
- 炸彈／爆量採題目「常見答案清單」，不是語意 AI；清單可能未涵蓋所有合理答案，UI 有明示。一般文字主持人可判定。
- Quiz：單選、是非、排序精確比對；估數字依題目 tolerance 線性遞減，差距達 5 倍 tolerance 得 0。
- 指揮官每人／每隊最多兩次，規則由主持人判定；排序人員每回合輪替。
- 情報員由各隊輪替指定，30 秒看短文、45 秒說明、隊友回答三題。文字可主持人覆判。
- 猜歌採收到搶答順序中的第一個正確答案得分；不宣稱毫秒級公平。混音可填三首，每首部分分、全對 bonus。
- 狼人殺是現場主持輔助：角色、階段、投票、出局、預言家查驗、藥水紀錄與勝方檢查。主持人能看到角色，因此應擔任公正主持，不把此模式當無主持人的純線上推理遊戲。自訂可調五種基礎角色數量；新增角色能力需修改 role data + module，尚未包含官方邪惡集會規則。
- 匿名爆料每回合收集故事後抽一則猜作者；揭曉前可移除，任何人可立即檢舉隱藏。不是匿名公開社群服務。
- 智慧分隊以中性 0.5 起算，使用本場能力觀測與隊友次數，先平均分配，再 swap optimization。前端不顯示能力分數。

## 新增遊戲

1. `games/catalog.ts` 加 metadata、模式、人數與賽制。
2. 建立 `games/<id>/engine.ts` 實作 GameModule（createRound、submit、advance、resolve、publicData、privateData）。Engine 在 Node 執行，不可 import client UI。
3. 建立 `PlayerView.tsx`，可依 `display` 呈現 TV 公開視角。共用 GameStage 提供 Timer、Host 控制與計分。
4. 將 engine 與 view 分別加入 registry、views，擴充 GameId 與 API Zod enum。
5. 在 Question Bank 放題目、在 tests/games.test.ts 增加規則、秘密資訊與流程測試。
6. 新遊戲不應建立新房間、不應自行修改 Party Score。

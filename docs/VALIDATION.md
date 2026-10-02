# 第一版驗收紀錄

驗收版本：Party Room 1.0.0。日期：2026-10-02（台北）。本文件只記錄本次已執行的結果。

| 檢查 | 實際結果 |
| --- | --- |
| `npm ci` | 依 lockfile 重新安裝成功，400 packages |
| `npm run lint` | 通過，0 error、0 warning |
| `npm run typecheck` | 通過 |
| `npm run test` | 4 test files、48 tests 全數通過，無 skipped |
| `npm run build` | Next.js 16.3.8 production build 成功 |
| `npm start` | 正式伺服器成功啟動，首頁 HTTP 200 |
| `npm run test:browser`（正式伺服器） | 4 tests 全數通過，約 1.1 分鐘 |
| `npm run test:simulation`（正式伺服器） | 15 玩家、3 隊、3 房隔離、3 款遊戲、離線重連、計分一致，全數通過 |
| CSV 匯入 | 範例 4 題連續匯入兩次成功，依 ID 更新 |
| `git diff --check` | 通過 |

## 真正走過的瀏覽器流程

- 首頁 → 建立房間 → 其他獨立 Cookie 的手機玩家加入 → Ready → 隨機分隊。
- 同答案 → 所有人提交 → Reveal → 確認計分 → 遊戲結算 → 回大廳。
- 星際情報站 → 私人閱讀 → 公開 TV 無短文 → 口頭轉述 → 三題作答 → 結算。
- Quiz → 正確選項 → 結算 → 刷新恢復同一身份 → 結束 Party → 最終個人／團隊榜。
- 指揮官排序／猜規則、猜歌搶答、混音多答案、詞曲不同調演唱登記、街景外部連結與提交。
- 狼人殺秘密角色／夜日階段／投票、誰最可能匿名投票、好友默契、匿名故事／檢舉隱藏。
- 畫布實際滑鼠筆畫 → 另一個瀏覽器收到筆畫 → 清除同步 → 猜詞。
- Quiz 排序、估數字、爆量連續輸入、炸彈換人作答。
- 錯誤回饋：不存在房號、未授權調分、重複提交、跨房隔離、無效答案保留輸入。

測試包含 Chromium 桌面、360px／390px 手機 viewport 與 1920×1080 TV。主要完整流程有檢查 pageerror、console error 與水平 overflow；逐款控制器流程沒有 pageerror。支援 prefers-reduced-motion，截圖曾實際檢視首頁、手機、隊伍與 TV。

## 15 人真實連線模擬

每人獨立 session cookie 與 SSE 連線，不是直接呼叫純函式。先隨機分為三隊，完成同答案和情報站團隊賽，再玩 Quiz 個人賽。預期且實際觀察到個人各 100、三隊各 200，原隊伍 ID 不變。

正式版本下，15 人提交到所有連線收到結果約 **833ms**。此為同一雲端機器的測試觀察，不代表手機行動網路或正式服務的延遲保證。

一名玩家斷線 21 秒，其他人看見離線；使用原 Cookie 回來恢復相同 ID、隊伍與分數。另兩個同時存在的房間獨立加分，原房間分數不變。主 UI 流程也實際重新整理，未出現第二名重複玩家。

## PostgreSQL 與權限驗證

使用 PGlite 執行 migration SQL（真實 PostgreSQL 引擎），測試 CAS revision、UUID／暱稱約束、跨房隔離、RPC EXECUTE 權限、anon/authenticated 無法讀秘密／改 ledger／改房主、service role 可用、ledger UPDATE／DELETE 被 trigger 拒絕、過期／結束房號重用保留歷史，以及 stale revision 不會部分加分。

房主失聯 90 秒、兩輪平票選舉與單一房主權限，以可控制伺服器時鐘的整合測試驗證；未用瀏覽器等待完整選舉時間。

## 驗收時修掉的問題

- 首頁 hydration 完成前的點擊可能失效：主要按鈕等互動就緒才啟用。
- Next.js 內部 origin 與瀏覽器 Host 不同造成開房被誤拒：以 HTTP Host／受信任 APP_ORIGIN 驗證。
- 加入後舊的匿名 SSE 視角可能覆蓋登入畫面：取得 Cookie 後重開串流。
- 答案未帶回合 ID、文字 key 使用普通物件、爆量別名重複：增加伺服器驗證與安全分組。
- 換遊戲時畫面留在頁底：狀態／回合切換回目前操作區。
- 送出失敗時輸入被清除：只在提交成功後清除。
- 玩家需捲過遊戲列表才找到 Ready：準備按鈕移到玩家大廳最前面。
- 同分只有一人被標成 MVP：修正為並列與相同名次。

## 尚未驗證／外部阻礙

- 未提供 Supabase／Vercel 專案憑證；**沒有遠端 migration、Vercel 部署或公開網站 URL**。這不是已發布的線上服務。
- 未在真實 iPhone Safari、Android 硬體及朋友聚會 Wi-Fi 測試。額外 Playwright 瀏覽器的下載受此環境網路政策阻擋，未執行 WebKit 測試。
- 未接 Google Sheet 的實際使用者文件；CSV 本機匯入與解析已驗證，線上匯入需提供公開 CSV URL。
- 音樂需要主持人合法音源，Street View 需要使用者自行在 Google Maps 操作。此版沒有自動辨識、真實混音生成、內嵌街景或邪惡集會官方特殊角色。
- 題庫有 352 筆題目／任務／歌名 metadata（含 130 Quiz、60 同答案、20 指揮官、12 篇情報短文各 3 小題）。音樂各玩法共用部分歌曲，不等於 352 個完全不同的知識問題。

## 下一輪最值得做的五件事

1. 在實際 iPhone／Android 與 LINE 內建瀏覽器走一次 15 人聚會，改善進房、鍵盤與回前景提示。
2. 連上既有 Supabase／Vercel，補正式網路、跨實例 SSE、背景喚醒與長時間聚會的測試。
3. 用試玩回饋調整遊戲節奏、炸彈有效清單、情報文章多樣性和 Quiz 難度分級。
4. 加入更多台灣不同年齡層的題組與題目品質管理，降低相似題帶來的重複感。
5. 實測低階手機上的畫布、長玩家名與大螢幕長榜單，再做效能和可讀性優化。

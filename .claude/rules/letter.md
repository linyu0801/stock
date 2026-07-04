# 給未來 session 的信

> 寫於 2026-07-04，Fable 5 session（本環境唯一一次）。此後由 Sonnet/Opus/Haiku 等長期運作。
> 一次性文件：新 session 想了解制度背景時讀一遍即可，不要常駐。

## 一、三件使用者沒問、但我認為最重要的事

1. **Permission allowlist 是病徵，不是設定。** `.claude/settings.local.json` 堆滿一次性長指令
   （即興組合的 uvicorn+curl 大雜燴），代表每個 session 都在重新發明驗證方法。根治法：把驗證固化成
   短指令（如 `backend/dev.ps1`、package.json scripts），allowlist 只留短而穩的項目。已在
   `judgment.md` §2 固化指令表，但**建 script 這步還沒做**——值得做。

2. **Plugin/skill 常駐膨脹每天在扣稅。** financial-analysis、equity-research、wealth-management、
   Gmail、lastfm 等大量 skill 與本專案無關，卻每 session 注入清單與說明吃掉 context。若使用者其他
   工作流不需要，建議在 plugin 管理處停用——一次動作，每個 session 都省。（這是使用者層級決定，模型別自己動。）

3. **Git 狀態需要清一次。** 現在 branch 是 `master` 但預設 PR branch 是 `main`；index 上有大量
   staged 檔混雜 `.playwright-mcp/` 的 log/截圖。弱模型在髒 tree 上極易誤 commit 垃圾。建議：
   `.gitignore` 加 `.playwright-mcp/`，把 staged 內容整理成幾個乾淨 commit，統一 branch 名。

## 二、這套制度最可能的退化方式與預防

| 退化方式 | 預防 |
|---|---|
| 弱模型不讀按需檔，憑印象做事 | root CLAUDE.md 路由表寫的是「時機」不是「檔名介紹」；發現自己跳過 → 那次就是該讀的時機 |
| 規則與程式碼漂移（指令失效、路徑改名） | `maintenance.md` 允許弱模型自行修驗證指令表；指令失效當場修，不繞過 |
| lessons.md 變垃圾場，沒人讀 | >100 行強制精簡（maintenance.md）；除錯前查 lessons 是 CLAUDE.md 路由的一列 |
| 使用者趕時間，口頭推翻流程，之後成常態 | 單次推翻沒問題；同一條被推翻 ≥2 次 → 規則錯了，走 maintenance 流程改規則，別讓規則與實務長期分裂 |
| 升級路徑被跳過（直接每次用 opus 求穩） | 升級必附失敗軌跡的要求本身就是煞車——沒有軌跡 = 還沒輪到升級 |

## 三、誠實條款：本次產出信心排序（低 → 高）

1. **最低：`dispatch.md` 的計費相關標注。** subagent 計費歸屬、Opus 4.8 導流是否耗額度——都查不到，
   已標「未確認」。若實測後發現派 opus 很貴，整個升降級路徑的成本假設要重調。
2. **低轉中：`judgment.md` §2 驗證指令表。** 初稿指令即出錯（pnpm 8 的 `-C`＋裸指令會炸），
   對抗審查實測後已修為 `exec`/`run` 形式（tsc 已驗證 exit 0）。dev server＋playwright 與
   後端指令仍未全程實跑。失效就照 maintenance.md 權限當場修——這是設計內的自癒路徑。
3. **中：`00-diagnosis.md` 第 3 名（skill 失準）。** 從注入內容推斷，非實測觀察。前兩名證據較硬。
4. **中：templates.md 的填空粒度。** 未經弱模型實測校準；用三五次後該修就修。
5. **較高：dispatch/judgment 的結構本身。** 拆解、驗證不自驗、帶軌跡升級——這些是通用原則，不依賴
   本環境細節。

模糊題與品味判斷（UI 好不好看、API 該不該這樣設計）**這套制度補不了**——遇到就升級模型或問使用者，
別讓 checklist 給你假信心。

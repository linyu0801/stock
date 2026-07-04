# 制度維護協議 — 本專案

> 通用協議（踩雷教訓的格式、備份規則、精簡門檻、全域與專案的分流判準）見全域 `~/.claude/rules/maintenance.md`。
> 本檔只列本專案制度檔的修改權限與專案特有的預算。

## 修改權限（本專案的制度檔）

| 檔案 | 弱模型可以自行修改嗎？ | 條件 |
|---|---|---|
| `rules/lessons.md` | ✅ 只准 append | 照全域格式；不修改、不刪除既有條目 |
| `rules/verification.md` | ✅ | 僅限指令實測失效時，換成實測可跑的版本 |
| `rules/code-review.md` | ❌ 先問使用者 | 它定義審查政策；例外：對應的 CLAUDE.md 規則已改時，可同步 checklist 措辭 |
| `CLAUDE.md`（root／apps/web／backend） | ❌ 先問使用者 | 提案格式照全域：現行條文／建議條文／觸發此提案的具體事件 |
| `rules/letter.md` | ❌ 歷史文件 | 不修改；內容過時就在 lessons.md 記一條指出過時之處 |
| 刪除任何制度檔 | ❌ 永遠先問 | |

修改前先備份到同目錄，命名照全域規則：`_backup-{原始檔名}.{yyyy-MM-dd}.md`。

## 常駐載入預算（專案特有）

- root `CLAUDE.md` 維持在 150 行以內且只作為索引
- root＋`apps/web/CLAUDE.md`＋`backend/CLAUDE.md` 合計 500 行以內；超標就把長內容抽到 `.claude/rules/` 按需讀取
- `.claude/settings.local.json` 的 allowlist 若堆積一次性長指令，提醒使用者清理，改用固定短指令

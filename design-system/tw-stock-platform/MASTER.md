# Design System Master File — 台股分析平台

> **LOGIC:** When building a specific page, first check `design-system/pages/[page-name].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow the rules below.
>
> 本檔為 2026-07-04 UI 改版時鎖定的實際 tokens（已取代 ui-ux-pro-max 的初始生成值）。
> 真正的 source of truth 是 `apps/web/src/app/index.css` 的 CSS variables——改 tokens 先改那裡，再同步本檔。
> 設計脈絡（受眾、品牌性格、反面參照）見專案根目錄 `.impeccable.md`。

---

**Project:** TW Stock Platform
**Locked:** 2026-07-04（RWD 改版 + 雙主題）
**Design Dials:** Variance 6/10 | Motion 4/10（150–250ms ease-out，只做狀態轉場）| Density 6/10（盤後復盤，舒適密度）

---

## 硬規則（不可違反）

- **台股慣例：漲 = 紅（`--gain`）、跌 = 綠（`--loss`）。永遠不可互換。**
- 主題：深色為預設；淺色為切換選項（`.dark` class on `<html>`，localStorage key `theme`）。
- 顏色一律走 semantic tokens（`text-gain`、`bg-card`…），元件內禁止 raw hex。
- 數據對齊處一律 tabular figures（body 已全域 `font-feature-settings: "tnum"`）。
- 漲跌資訊除顏色外必附符號（▲▼ 或 +−），不可只靠顏色。

## Color Tokens（與 index.css 同步）

| Token | Dark（預設） | Light |
|-------|-------------|-------|
| `--background` | `#0D0D14` | `#F6F5FA` |
| `--foreground` | `#E8E8F0` | `#211E36` |
| `--card` | `#13131E` | `#FFFFFF` |
| `--popover` | `#1A1A2A` | `#FFFFFF` |
| `--primary` | `#7B6EF6` | `#6250E8` |
| `--secondary` | `#1A1A2E` | `#EDEBF7` |
| `--muted` | `#1E1E30` | `#EDEBF7` |
| `--muted-foreground` | `#6B6B85` | `#6A6688` |
| `--accent` | `#2D2A52` | `#E9E5FB` |
| `--accent-foreground` | `#A89EFF` | `#4F3ED6` |
| `--destructive` | `#FF4560` | `#D92645` |
| `--border` | `#1E1E30` | `#E3E0EF` |
| `--gain`（漲・紅） | `#FF4560` | `#DB2745` |
| `--loss`（跌・綠） | `#00C896` | `#008A6C` |

中性色皆向紫色 hue 微調（品牌凝聚），非純灰。圖表配色在 `shared/ui/organisms/candlestick-chart.tsx` 的 `CHART_PALETTE`。

## Typography

- **Display（標題、大數字）：** `Bricolage Grotesque Variable`（`font-display` utility）
- **Body/UI：** `Geist Variable`，fallback `Noto Sans TC Variable`（`font-sans`）
- 皆以 @fontsource-variable 套件載入（index.css @import）。
- 不要換成 Inter／Fira／Space Grotesk 等 AI 預設臉字型。

## Layout / RWD

- 斷點策略：mobile-first；`md`(768) 起 SideNav 直欄，`<md` 頂欄導航（TopNav）。
- 自選股 master-detail：`≥xl`(1280) 三欄（群組 208px｜列表 520px｜detail flex-1），點股票寫 `?symbol=`；`<xl` 點擊導向 `/stock/$id`。
- 股票列表欄位用 **container query**（GroupPanel 是 `@container`，`@lg`(32rem) 以上顯示完整七欄，以下精簡三欄）。
- 間距節奏 4pt 系；卡片 `rounded-xl`；不做 card-in-card。

## 禁止（AI slop 檢查）

- 卡片左側色條（border-left > 1px 當裝飾）
- 漸層文字（background-clip: text）
- cyan-on-dark 發光、裝飾性 glassmorphism、裝飾性 sparkline
- emoji 當 icon（一律 Lucide SVG）

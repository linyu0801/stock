# ETF 折溢價＋處置/注意標示 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 自選清單與個股詳情頁顯示 ETF 日頻折溢價，以及處置股/注意股標示（等級、原因、措施、起訖日期）。

**Architecture:** 兩個獨立後端 domain（`disposition`、`etf`），沿用 `services/fundamentals.py` 的模式：urllib＋`ssl.CERT_NONE` 打外部 API、`tuple[float, data]`＋TTL 記憶體快取、router 只做解析參數→呼叫 service→回傳。前端經 `packages/api-client` 批次查詢，map 傳入既有元件。

**Tech Stack:** FastAPI＋urllib（後端）、zod＋TanStack Query＋Tailwind（前端）。

**Spec:** `docs/superpowers/specs/2026-07-09-etf-premium-disposition-design.md`（資料源實測：`.claude/tmp/premium-disposition-sources.md`）

## Global Constraints

- **不 commit**：專案規則「未經使用者指示不 commit」。每個 task 結尾以驗證取代 commit；全部完成後由使用者決定 commit。
- 後端不引入 yfinance；外部 API 一律 urllib＋`_SSL_CTX`（`ssl.CERT_NONE`）
- 前端 API 呼叫一律走 `packages/api-client`；元件不直接 `fetch`
- Styling 一律 `className`；漲跌色 `text-gain`（紅=漲）／`text-loss`（綠=跌）；處置=violet、注意=amber（避開漲跌紅綠）
- 元件：`const`＋`React.FC<Props>`，`type Props` 在上方；organisms 用 named export
- 註解只寫不明顯的 WHY；無 unused imports
- 驗證指令表：`.claude/rules/verification.md`（前端 `pnpm -C apps/web exec tsc --noEmit`；後端 uvicorn＋curl）
- 回應 shape 與 spec 的唯一差異：`/api/etf/premium` **不含 `close` 欄位**——前端不顯示它（詳情頁已有收盤價），含入即 fat response，違反專案規則

---

### Task 1: disposition 後端（service＋router）

**Files:**
- Create: `backend/services/disposition.py`
- Create: `backend/api/disposition.py`
- Modify: `backend/main.py`（import＋`include_router`，比照第 9 行與第 30 行的 fundamentals 寫法）

**Interfaces:**
- Consumes: 無（純新增）
- Produces: `get_flags(symbols: list[str]) -> dict`；HTTP `GET /api/disposition/flags?symbols=2330,0050` → `{"<code>": {"level": "disposal"|"warning", "reason": str, "measures": str|null, "start": "YYYY-MM-DD"|null, "end": "YYYY-MM-DD"|null}}`，沒中的 symbol 不出現

- [ ] **Step 1: 寫 `backend/services/disposition.py`**

```python
import json
import ssl
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import date

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

_TWSE_PUNISH_URL = "https://openapi.twse.com.tw/v1/announcement/punish"
_TWSE_NOTICE_URL = "https://openapi.twse.com.tw/v1/announcement/notice"
_TPEX_DISPOSAL_URL = "https://www.tpex.org.tw/openapi/v1/tpex_disposal_information"
_TPEX_WARNING_URL = "https://www.tpex.org.tw/openapi/v1/tpex_trading_warning_information"

_flags_cache: tuple[float, dict] | None = None
_FLAGS_TTL = 3600


def _get_json(url: str) -> list:
    req = urllib.request.Request(url, headers=_HEADERS)
    with urllib.request.urlopen(req, timeout=30, context=_SSL_CTX) as r:
        return json.loads(r.read())


def _parse_date(raw: str) -> str | None:
    """民國（'115/07/03'、'1150703'）或西元（'20260709'）→ ISO；解不出回 None。"""
    digits = raw.replace("/", "").strip()
    if not digits.isdigit():
        return None
    if len(digits) == 7:
        return f"{int(digits[:3]) + 1911}-{digits[3:5]}-{digits[5:7]}"
    if len(digits) == 8:
        return f"{digits[:4]}-{digits[4:6]}-{digits[6:8]}"
    return None


def _parse_period(raw: str, sep: str) -> tuple[str | None, str | None]:
    parts = raw.split(sep)
    if len(parts) != 2:
        return None, None
    return _parse_date(parts[0]), _parse_date(parts[1])


def _fetch_all() -> tuple[dict, bool]:
    """回 (全市場 flags map, 是否至少一個來源成功)。"""
    with ThreadPoolExecutor(max_workers=4) as ex:
        futures = {
            "twse_punish": ex.submit(_get_json, _TWSE_PUNISH_URL),
            "twse_notice": ex.submit(_get_json, _TWSE_NOTICE_URL),
            "tpex_disposal": ex.submit(_get_json, _TPEX_DISPOSAL_URL),
            "tpex_warning": ex.submit(_get_json, _TPEX_WARNING_URL),
        }
        results = {}
        ok = False
        for name, f in futures.items():
            try:
                results[name] = f.result()
                ok = True
            except Exception as e:
                print(f"[disposition] {name} failed: {e}")
                results[name] = []

    flags: dict[str, dict] = {}
    today = date.today().isoformat()

    # 注意股先寫入，處置股後寫入覆蓋——同檔並存時取較嚴重的處置
    for row in results["twse_notice"]:
        code = (row.get("Code") or "").strip()
        if not code:  # TWSE 無資料時回一筆全空白 placeholder
            continue
        flags[code] = {
            "level": "warning",
            "reason": row.get("TradingInfoForAttention", ""),
            "measures": None,
            "start": _parse_date(row.get("Date", "")),
            "end": None,
        }
    for row in results["tpex_warning"]:
        code = (row.get("SecuritiesCompanyCode") or "").strip()
        if not code:
            continue
        flags[code] = {
            "level": "warning",
            "reason": row.get("TradingInformation", ""),
            "measures": None,
            "start": _parse_date(row.get("Date", "")),
            "end": None,
        }
    for row in results["twse_punish"]:
        code = (row.get("Code") or "").strip()
        start, end = _parse_period(row.get("DispositionPeriod", ""), "至")
        if not code or (end and end < today):
            continue
        flags[code] = {
            "level": "disposal",
            "reason": row.get("ReasonsOfDisposition", ""),
            "measures": row.get("Detail", ""),
            "start": start,
            "end": end,
        }
    for row in results["tpex_disposal"]:
        code = (row.get("SecuritiesCompanyCode") or "").strip()
        start, end = _parse_period(row.get("DispositionPeriod", ""), "~")
        if not code or (end and end < today):
            continue
        flags[code] = {
            "level": "disposal",
            "reason": row.get("DispositionReasons", ""),
            "measures": row.get("DisposalCondition", ""),
            "start": start,
            "end": end,
        }
    return flags, ok


def get_flags(symbols: list[str]) -> dict:
    global _flags_cache
    now = time.time()
    if _flags_cache is None or now - _flags_cache[0] >= _FLAGS_TTL:
        flags, ok = _fetch_all()
        if ok or _flags_cache is None:
            _flags_cache = (now, flags)
        else:
            _flags_cache = (now, _flags_cache[1])  # 全來源失敗 → 沿用舊資料，TTL 後再試
    all_flags = _flags_cache[1]
    return {s: all_flags[s] for s in symbols if s in all_flags}
```

已知陷阱（出自實測紀錄）：TWSE `DispositionPeriod` 用「至」分隔且是 `115/07/03` 斜線民國格式；TPEX 用「~」分隔且是 `1150710` 無斜線民國格式；TPEX warning 的 `Date` 是西元 `20260709`——`_parse_date` 以位數區分統一處理。

- [ ] **Step 2: 寫 `backend/api/disposition.py`**

```python
from fastapi import APIRouter, Query
from services.disposition import get_flags

router = APIRouter(prefix="/api/disposition")


@router.get("/flags")
def flags(symbols: str = Query(...)):
    return get_flags([s.strip() for s in symbols.split(",") if s.strip()])
```

- [ ] **Step 3: 註冊 router 到 `backend/main.py`**

import 區加：

```python
from api.disposition import router as disposition_router
```

`include_router` 區（`app.include_router(fundamentals_router)` 之後）加：

```python
app.include_router(disposition_router)
```

- [ ] **Step 4: 啟動後端並驗證**

於 `backend/` 背景啟動：`uvicorn main:app --port 8000`
先挑一檔當日真實處置股代號（取回傳第一筆的 `Code`）：

```
curl -s https://openapi.twse.com.tw/v1/announcement/punish
```

再打本機 endpoint（`<code>` 換成上一步挑到的代號）：

```
curl -s "http://localhost:8000/api/disposition/flags?symbols=<code>,2330"
```

Expected：回應含 `<code>` 一筆，`level` 為 `"disposal"`、`start`/`end` 為 ISO 格式（`2026-XX-XX`）、`reason` 與 `measures` 非空；`2330` 不在回應中（除非它當天真的被處置）。再打一次確認第二次快取生效（回應時間應近乎即時）。

---

### Task 2: etf 後端（service＋router）

**Files:**
- Create: `backend/services/etf.py`
- Create: `backend/api/etf.py`
- Modify: `backend/main.py`

**Interfaces:**
- Consumes: 無
- Produces: `get_premiums(symbols: list[str]) -> dict`；HTTP `GET /api/etf/premium?symbols=0050,00940` → `{"0050": {"nav": float, "premium_pct": float, "date": "YYYY-MM-DD"}}`，非 ETF／查無資料的 symbol 不出現

- [ ] **Step 1: 寫 `backend/services/etf.py`**

```python
import json
import ssl
import time
import urllib.request
from urllib.parse import urlencode
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta

_SSL_CTX = ssl.create_default_context()
_SSL_CTX.check_hostname = False
_SSL_CTX.verify_mode = ssl.CERT_NONE

_HEADERS = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}

_ETFORTUNE_URL = "https://www.twse.com.tw/zh/ETFortune/ajaxEtfInfoChart"

_premium_cache: dict[str, tuple[float, dict | None]] = {}
_PREMIUM_TTL = 3600


def _fetch_premium(symbol: str) -> dict | None:
    end = date.today()
    start = end - timedelta(days=14)
    body = urlencode({
        "id": symbol,
        "startDate": start.strftime("%Y/%m/%d"),
        "endDate": end.strftime("%Y/%m/%d"),
        "type": "fundPric",
    }).encode()
    req = urllib.request.Request(_ETFORTUNE_URL, data=body, headers={
        **_HEADERS,
        "Referer": f"https://www.twse.com.tw/zh/ETFortune/etfInfo/{symbol}",
        "Content-Type": "application/x-www-form-urlencoded",
    })
    with urllib.request.urlopen(req, timeout=15, context=_SSL_CTX) as r:
        data = json.loads(r.read())

    def valid_rows(rows: list) -> dict[str, float]:
        out = {}
        for row in rows:
            try:
                d = datetime.strptime(row["date"], "%Y/%m/%d").date()
            except (KeyError, ValueError):
                continue
            # 該站有 "2036/01/04" 這類髒日期，只收查詢窗內的
            if not (start <= d <= end) or row.get("count") is None:
                continue
            out[d.isoformat()] = float(row["count"])
        return out

    navs = valid_rows(data.get("netPrice") or [])
    premiums = valid_rows(data.get("atmps") or [])
    common = sorted(set(navs) & set(premiums))
    if not common:
        return None
    latest = common[-1]
    return {"nav": navs[latest], "premium_pct": premiums[latest], "date": latest}


def get_premiums(symbols: list[str]) -> dict:
    targets = [s for s in symbols if s.startswith("00")]
    now = time.time()
    stale = [s for s in targets if s not in _premium_cache or now - _premium_cache[s][0] >= _PREMIUM_TTL]
    if stale:
        with ThreadPoolExecutor(max_workers=4) as ex:
            futures = {s: ex.submit(_fetch_premium, s) for s in stale}
            for s, f in futures.items():
                try:
                    _premium_cache[s] = (now, f.result())
                except Exception as e:
                    print(f"[etf] {s} premium failed: {e}")
                    _premium_cache[s] = (now, None)
    return {s: _premium_cache[s][1] for s in targets if _premium_cache.get(s) and _premium_cache[s][1]}
```

失敗的 symbol 快取 `None`（帶 TTL）——避免每個 request 重打壞掉的外部 API。

- [ ] **Step 2: 寫 `backend/api/etf.py`**

```python
from fastapi import APIRouter, Query
from services.etf import get_premiums

router = APIRouter(prefix="/api/etf")


@router.get("/premium")
def premium(symbols: str = Query(...)):
    return get_premiums([s.strip() for s in symbols.split(",") if s.strip()])
```

- [ ] **Step 3: 註冊 router 到 `backend/main.py`**

```python
from api.etf import router as etf_router
```

```python
app.include_router(etf_router)
```

- [ ] **Step 4: 驗證**

（uvicorn 沿用 Task 1 的背景程序，`--reload` 沒開就重啟）

```
curl -s "http://localhost:8000/api/etf/premium?symbols=0050,00940,2330"
```

Expected：回應含 `0050` 與 `00940`（各有 `nav`／`premium_pct`／`date`，`date` 為最近交易日 ISO 格式、不是未來日期）；`2330` 不在回應中。

```
curl -s http://localhost:8000/api/health
```

Expected：`{"status":"ok"}`。

---

### Task 3: api-client 型別與函式

**Files:**
- Modify: `packages/api-client/src/client.ts`（在 `getValuations` 區塊之後、`RevenuePointSchema` 之前插入）

**Interfaces:**
- Consumes: Task 1、2 的 HTTP endpoint
- Produces: `getDispositionFlags(symbols: string[]): Promise<Record<string, DispositionFlag>>`、`getEtfPremium(symbols: string[]): Promise<Record<string, EtfPremium>>`、type `DispositionFlag`＝`{ level: "disposal"|"warning"; reason: string; measures: string|null; start: string|null; end: string|null }`、type `EtfPremium`＝`{ nav: number; premium_pct: number; date: string }`

- [ ] **Step 1: 加 schema 與函式**

```ts
const DispositionFlagSchema = z.object({
  level: z.enum(["disposal", "warning"]),
  reason: z.string(),
  measures: z.string().nullable(),
  start: z.string().nullable(),
  end: z.string().nullable(),
});
export type DispositionFlag = z.infer<typeof DispositionFlagSchema>;
export const getDispositionFlags = (symbols: string[]): Promise<Record<string, DispositionFlag>> =>
  apiFetch(z.record(z.string(), DispositionFlagSchema), `${BASE}/disposition/flags?symbols=${encodeURIComponent(symbols.join(","))}`);

const EtfPremiumSchema = z.object({ nav: z.number(), premium_pct: z.number(), date: z.string() });
export type EtfPremium = z.infer<typeof EtfPremiumSchema>;
export const getEtfPremium = (symbols: string[]): Promise<Record<string, EtfPremium>> =>
  apiFetch(z.record(z.string(), EtfPremiumSchema), `${BASE}/etf/premium?symbols=${encodeURIComponent(symbols.join(","))}`);
```

- [ ] **Step 2: 驗證**

Run: `pnpm -C apps/web exec tsc --noEmit`
Expected: exit 0。

---

### Task 4: 首頁列表（chip＋折溢價欄）

**Files:**
- Modify: `apps/web/src/pages/home/index.tsx`
- Modify: `apps/web/src/pages/home/organisms/GroupPanel.tsx`
- Modify: `apps/web/src/pages/home/molecules/StockRow.tsx`

**Interfaces:**
- Consumes: Task 3 的 `getDispositionFlags`／`getEtfPremium`／`DispositionFlag`／`EtfPremium`
- Produces: `GroupPanel` 新 props `flags: Record<string, DispositionFlag>`、`premiums: Record<string, EtfPremium>`；`StockRow` 新 props `flag?: DispositionFlag`、`premium?: EtfPremium`

- [ ] **Step 1: `index.tsx` 加兩個 query 並下傳**

import 加 `getDispositionFlags, getEtfPremium` 與 `type DispositionFlag, type EtfPremium`（併入既有 `@taiwan-stock/api-client` import）。

`valuations` query 之後加：

```tsx
  const etfSymbols = symbols.filter((s) => s.startsWith('00'));

  const { data: flagsData } = useQuery<Record<string, DispositionFlag>>({
    queryKey: ['disposition-flags', symbolsKey],
    queryFn: () => getDispositionFlags(symbols),
    enabled: symbols.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const flags = flagsData ?? {};

  const { data: premiumsData } = useQuery<Record<string, EtfPremium>>({
    queryKey: ['etf-premiums', etfSymbols.join(',')],
    queryFn: () => getEtfPremium(etfSymbols),
    enabled: etfSymbols.length > 0,
    staleTime: 1000 * 60 * 60,
  });
  const premiums = premiumsData ?? {};
```

`<GroupPanel>` 的 props 加（`valuations={valuations}` 之後）：

```tsx
              flags={flags}
              premiums={premiums}
```

- [ ] **Step 2: `GroupPanel.tsx` 傳遞 props**

type import 加 `DispositionFlag, EtfPremium`。`type Props` 的 `valuations` 下一行加：

```tsx
  flags: Record<string, DispositionFlag>;
  premiums: Record<string, EtfPremium>;
```

解構參數 `valuations,` 後加 `flags, premiums,`。`<StockRow>` 的 `valuation={valuations[s.symbol]}` 下一行加：

```tsx
              flag={flags[s.symbol]}
              premium={premiums[s.symbol]}
```

- [ ] **Step 3: `StockRow.tsx` 顯示 chip 與折溢價**

type import 改為 `import type { StockPrice, Valuation, DispositionFlag, EtfPremium } from "@taiwan-stock/api-client";`

`type Props` 的 `valuation?: Valuation;` 下一行加：

```tsx
  flag?: DispositionFlag;
  premium?: EtfPremium;
```

解構參數 `valuation,` 後加 `flag, premium,`。

chip：symbol 的 `<span>`（`{s.symbol}` 那行）之後、`{s.note && ...}` 之前插入：

```tsx
            {flag && (
              <span className={`text-[10px] font-medium px-1 py-0.5 rounded shrink-0 ${
                flag.level === "disposal" ? "bg-violet-500/15 text-violet-400" : "bg-amber-500/15 text-amber-400"
              }`}>
                {flag.level === "disposal" ? "處" : "注"}
              </span>
            )}
```

本益比欄（`{valuation?.pe != null ? valuation.pe.toFixed(1) : "—"}` 那個 `<span>` 的內容）改為——ETF 該欄本為空白，改放折溢價：

```tsx
          {premium ? (
            <span title="折溢價" className={premium.premium_pct >= 0 ? "text-gain" : "text-loss"}>
              {premium.premium_pct >= 0 ? "+" : ""}{premium.premium_pct.toFixed(2)}%
            </span>
          ) : valuation?.pe != null ? valuation.pe.toFixed(1) : "—"}
```

- [ ] **Step 4: 驗證**

Run: `pnpm -C apps/web exec tsc --noEmit` → Expected: exit 0。
背景啟動 `pnpm -C apps/web run dev`（後端 uvicorn 也要在跑），playwright 開 `http://localhost:5173`：
1. 自選清單含 ETF（如 0050；沒有就用搜尋框加入）→ 截圖確認寬版（@3xl）下本益比欄顯示 `±X.XX%` 折溢價、紅漲綠跌配色。
2. 用搜尋框加入一檔當日處置股（Task 1 驗證時挑到的代號）→ 截圖確認名稱旁出現紫色「處」chip。驗完移除該股。

---

### Task 5: 個股詳情頁（DispositionNotice＋淨值/折溢價 StatBox）

**Files:**
- Create: `apps/web/src/widgets/stock-detail/organisms/DispositionNotice.tsx`
- Modify: `apps/web/src/widgets/stock-detail/index.tsx`

**Interfaces:**
- Consumes: Task 3 的函式與型別；既有 `StatBox`（props：`label`、`value`、`valueClassName?`、`sub?`）、`formatPrice`
- Produces: `DispositionNotice`（named export，`type Props = { flag: DispositionFlag }`）

- [ ] **Step 1: 寫 `DispositionNotice.tsx`**

```tsx
import type { DispositionFlag } from "@taiwan-stock/api-client";

type Props = { flag: DispositionFlag };

const daysLeft = (end: string): number =>
  Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);

export const DispositionNotice: React.FC<Props> = ({ flag }) => {
  const disposal = flag.level === "disposal";
  return (
    <div className={`mb-4 rounded-lg border px-4 py-3 ${
      disposal ? "border-violet-500/40 bg-violet-500/10" : "border-amber-500/40 bg-amber-500/10"
    }`}>
      <div className="flex items-center gap-2 mb-1">
        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${
          disposal ? "bg-violet-500/20 text-violet-400" : "bg-amber-500/20 text-amber-400"
        }`}>
          {disposal ? "處置股" : "注意股"}
        </span>
        {flag.start && (
          <span className="text-xs text-muted-foreground tabular-nums">
            {flag.start}
            {flag.end && ` ~ ${flag.end}`}
            {flag.end && daysLeft(flag.end) >= 0 && `（剩 ${daysLeft(flag.end)} 天）`}
          </span>
        )}
      </div>
      {flag.reason && <p className="text-xs text-muted-foreground mb-1">{flag.reason}</p>}
      {flag.measures && <p className="text-xs whitespace-pre-wrap">{flag.measures}</p>}
    </div>
  );
};
```

- [ ] **Step 2: `index.tsx` 加 query 與渲染**

import 加：`getDispositionFlags, getEtfPremium, type DispositionFlag, type EtfPremium`（併入既有 `@taiwan-stock/api-client` import）與 `import { DispositionNotice } from "./organisms/DispositionNotice";`

`priceInfo` query 之後加：

```tsx
  const { data: flagsData } = useQuery<Record<string, DispositionFlag>>({
    queryKey: ["disposition-flags", symbol],
    queryFn: () => getDispositionFlags([symbol]),
    staleTime: 1000 * 60 * 60,
  });
  const flag = flagsData?.[symbol];

  const isEtf = symbol.startsWith("00");
  const { data: premiumsData } = useQuery<Record<string, EtfPremium>>({
    queryKey: ["etf-premiums", symbol],
    queryFn: () => getEtfPremium([symbol]),
    enabled: isEtf,
    staleTime: 1000 * 60 * 60,
  });
  const premium = premiumsData?.[symbol];
```

Header 區塊（`</div>` 結束 Header 之後）、Stat bar（`{/* Stat bar */}`）之前插入：

```tsx
      {flag && <DispositionNotice flag={flag} />}
```

Stat bar grid 內最後一個 `<StatBox label="最低" .../>` 之後加：

```tsx
        {premium && (
          <>
            <StatBox label="淨值" value={formatPrice(premium.nav)} sub={premium.date} />
            <StatBox
              label="折溢價"
              value={`${premium.premium_pct >= 0 ? "+" : ""}${premium.premium_pct.toFixed(2)}%`}
              valueClassName={premium.premium_pct >= 0 ? "text-gain" : "text-loss"}
            />
          </>
        )}
```

（grid 是 `grid-cols-2 @lg:grid-cols-4`，6 格自動折行，不需改 grid。）

- [ ] **Step 3: 驗證**

Run: `pnpm -C apps/web exec tsc --noEmit` → Expected: exit 0。
playwright（dev server 沿用 Task 4）：
1. 開 `http://localhost:5173/stock/0050` → 截圖確認 Stat 區有「淨值」「折溢價」兩格，折溢價有正負號與紅綠配色，淨值下方有資料日期。
2. 開 `http://localhost:5173/stock/<當日處置股代號>` → 截圖確認 header 下方出現紫框處置區塊：起訖日、剩餘天數、原因、措施全文。
3. 開 `http://localhost:5173/stock/2330` → 截圖確認無處置框、無淨值格（版面同改動前）。

---

## 完成後

全部 task 驗證通過後：向使用者回報驗證結果（curl 輸出＋截圖），由使用者決定是否 commit。

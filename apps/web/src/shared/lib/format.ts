export function formatPrice(n: number): string {
  return n.toLocaleString("zh-TW", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatPercent(n: number): string {
  const sign = n >= 0 ? "+" : "";
  return `${sign}${n.toFixed(2)}%`;
}

/** 股數 → 張數顯示（1 張 = 1000 股） */
export function formatVolume(shares: number): string {
  if (shares === 0) return "—";
  const lots = Math.round(shares / 1000);
  if (lots >= 10000) return `${(lots / 10000).toFixed(1)}萬`;
  if (lots >= 1000) return `${(lots / 1000).toFixed(1)}K`;
  return String(lots);
}

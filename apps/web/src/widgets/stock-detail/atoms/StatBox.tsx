type Props = { label: string; value: string; valueClassName?: string; sub?: string };

export const StatBox: React.FC<Props> = ({ label, value, valueClassName, sub }) => (
  <div className="bg-card border border-border rounded-xl px-4 py-3">
    <div className="text-[11px] text-muted-foreground mb-1">{label}</div>
    <div className={`text-lg font-bold tabular-nums ${valueClassName ?? ""}`}>{value}</div>
    {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
  </div>
);

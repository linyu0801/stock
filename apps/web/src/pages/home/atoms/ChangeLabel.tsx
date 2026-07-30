import { LimitBadge } from "@/shared/ui/atoms/limit-badge";

type Props = { value: number; limit?: "up" | "down" | null };

export const ChangeLabel: React.FC<Props> = ({ value, limit }) => {
  const isGain = value >= 0;
  return (
    <span className="inline-flex items-center gap-1">
      <span className={`text-sm font-semibold tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
        {isGain ? "+" : ""}{value.toFixed(2)}%
      </span>
      <LimitBadge limit={limit} />
    </span>
  );
};

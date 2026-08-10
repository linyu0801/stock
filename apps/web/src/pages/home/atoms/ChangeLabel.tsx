type Props = { value: number; limit?: "up" | "down" | null };

// 漲/跌停：數字本身亮燈（填色），不另外寫「漲停」字，比照券商看盤
const LIT = {
  up: "bg-gain",
  down: "bg-loss",
} as const;

export const ChangeLabel: React.FC<Props> = ({ value, limit }) => {
  const isGain = value >= 0;
  const text = `${isGain ? "+" : ""}${value.toFixed(2)}%`;
  if (limit) {
    return (
      <span className={`inline-block text-sm font-bold tabular-nums text-white px-1.5 py-0.5 rounded ${LIT[limit]}`}>
        {text}
      </span>
    );
  }
  return (
    <span className={`text-sm font-semibold tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
      {text}
    </span>
  );
};

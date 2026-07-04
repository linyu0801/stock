type Props = { value: number };

export const ChangeLabel: React.FC<Props> = ({ value }) => {
  const isGain = value >= 0;
  return (
    <span className={`text-sm font-semibold tabular-nums ${isGain ? "text-gain" : "text-loss"}`}>
      {isGain ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
};

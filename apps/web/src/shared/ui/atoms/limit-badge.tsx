type Props = { limit: "up" | "down" | null | undefined };

export const LimitBadge: React.FC<Props> = ({ limit }) => {
  if (!limit) return null;
  const isUp = limit === "up";
  return (
    <span
      className={`text-[10px] font-bold px-1 py-px rounded-sm text-white shrink-0 ${
        isUp ? "bg-gain shadow-[0_0_6px_var(--gain)]" : "bg-loss shadow-[0_0_6px_var(--loss)]"
      }`}
    >
      {isUp ? "漲停" : "跌停"}
    </span>
  );
};

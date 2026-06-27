import { formatPrice, formatPercent } from "@/shared/lib/format";

interface Props {
  price: number;
  changePct: number;
}

export function PriceTag({ price, changePct }: Props) {
  const isUp = changePct >= 0;
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-lg font-semibold">{formatPrice(price)}</span>
      <span className={isUp ? "text-red-500 text-sm" : "text-green-500 text-sm"}>
        {formatPercent(changePct)}
      </span>
    </div>
  );
}

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getPortfolioRebalance, setPortfolioRebalance, type RebalanceBucket } from "@taiwan-stock/api-client";
import { formatPrice } from "@/shared/lib/format";
import { Button } from "@/shared/ui/atoms/button";
import { Input } from "@/shared/ui/atoms/input";
import { Skeleton } from "@/shared/ui/atoms/skeleton";

const pct = (n: number | null, digits = 1): string => (n == null ? "—" : `${n.toFixed(digits)}%`);

type ActionProps = { delta: number };

const Action: React.FC<ActionProps> = ({ delta }) => {
  if (Math.abs(delta) < 1) return <span className="text-muted-foreground">已在目標上</span>;
  return (
    <span className={delta < 0 ? "text-gain" : "text-loss"}>
      {delta < 0 ? "買進" : "賣出"} {formatPrice(Math.abs(delta))}
    </span>
  );
};

type BucketProps = {
  label: string; hint: string; bucket: RebalanceBucket;
  target: number; exposureNow: number | null; muted?: boolean;
};

const BucketRow: React.FC<BucketProps> = ({ label, hint, bucket, target, exposureNow, muted }) => (
  <div className={`flex flex-col gap-1.5 rounded-lg border border-border p-3 ${muted ? "opacity-70" : "bg-background/40"}`}>
    <div className="flex flex-wrap items-baseline justify-between gap-x-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xs text-muted-foreground">{hint}</p>
    </div>
    <p className="text-2xl font-semibold tabular-nums [font-feature-settings:normal]">
      {pct(bucket.ratio == null ? null : bucket.ratio * 100)}
      <span className="ml-2 text-sm font-normal text-muted-foreground">目標 {pct(target, 0)}</span>
    </p>
    <p className="text-xs text-muted-foreground tabular-nums">
      {formatPrice(bucket.value)} : {formatPrice(bucket.cash)}
    </p>
    <p className="text-sm tabular-nums">
      <Action delta={bucket.delta} />
    </p>
    <p
      className="text-xs text-muted-foreground tabular-nums"
      title={`買賣金額 × ${bucket.factor.toFixed(2)} 倍計入曝險；現金與股票等額對調，淨值不變`}
    >
      曝險 {pct(exposureNow == null ? null : exposureNow * 100, 0)}
      {" → "}
      <span className="text-foreground">
        {pct(bucket.exposure_ratio_after == null ? null : bucket.exposure_ratio_after * 100, 0)}
      </span>
      <span className="ml-1.5">（{formatPrice(bucket.exposure_after)}）</span>
    </p>
  </div>
);

export const RebalancePanel: React.FC = () => {
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["portfolio", "rebalance"], queryFn: getPortfolioRebalance });
  const [target, setTarget] = useState("");
  const [trigger, setTrigger] = useState("");
  const [editing, setEditing] = useState(false);

  const mutation = useMutation({
    mutationFn: setPortfolioRebalance,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["portfolio", "rebalance"] });
      setEditing(false);
    },
  });

  if (isLoading) {
    return <div className="bg-card border border-border rounded-2xl p-5"><Skeleton className="h-32" /></div>;
  }

  const open = (): void => {
    setTarget(String(data?.target_pct ?? 60));
    setTrigger(String(data?.trigger_pct ?? 50));
    setEditing(true);
  };

  const targetNum = Number(target);
  const triggerNum = Number(trigger);
  const valid = targetNum > 0 && targetNum < 100 && triggerNum > 0;

  return (
    <section className="bg-card border border-border rounded-2xl p-5 sm:p-6 flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="font-display text-base font-bold">正2 再平衡</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            以「正2 ÷（正2 ＋ 現金）」控制比例，個股不列入計算。正2 自上次再平衡漲跌達門檻才調整，避免頻繁進出。
          </p>
        </div>
        {!editing && (
          <Button variant="ghost" size="sm" onClick={open}>{data ? "設定" : "開始設定"}</Button>
        )}
      </div>

      {editing && (
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border p-3">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            目標比例 %
            <Input value={target} onChange={e => setTarget(e.target.value)} inputMode="decimal" className="w-24" autoFocus />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            觸發門檻 %（正2 漲跌）
            <Input value={trigger} onChange={e => setTrigger(e.target.value)} inputMode="decimal" className="w-24" />
          </label>
          <Button
            size="sm"
            disabled={!valid || mutation.isPending}
            onClick={() => mutation.mutate({ target_pct: targetNum, trigger_pct: triggerNum })}
          >
            儲存
          </Button>
          <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>取消</Button>
        </div>
      )}

      {!data ? (
        !editing && <p className="text-xs text-muted-foreground">還沒設定目標比例與觸發門檻。</p>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 rounded-lg border border-border px-3 py-2">
            <p
              className="text-xs text-muted-foreground tabular-nums"
              title="等價漲跌＝由目前比例反推的正2 漲跌幅，前提是上次再平衡時比例正好在目標上"
            >
              正2 等價漲跌 {pct(data.leveraged.implied_move_pct)}
              <span className="mx-1.5">·</span>
              門檻 ±{pct(data.trigger_pct, 0)}
              <span className="mx-1.5">·</span>
              觸發區間 {pct(data.lower_pct)}–{pct(data.upper_pct)}
            </p>
            <p className={`text-xs font-medium ${data.leveraged.triggered ? "text-foreground" : "text-muted-foreground"}`}>
              {data.leveraged.triggered ? "已觸發，建議調整" : "未觸發，不用動"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <BucketRow
              label="正2 : 現金"
              hint="策略口徑"
              bucket={data.leveraged}
              target={data.target_pct}
              exposureNow={data.exposure_ratio}
            />
            <BucketRow
              label="全部持股 : 現金"
              hint="參考，含個股"
              bucket={data.all_stocks}
              target={data.target_pct}
              exposureNow={data.exposure_ratio}
              muted
            />
          </div>
        </>
      )}
    </section>
  );
};

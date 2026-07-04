import { useQuery } from "@tanstack/react-query";
import { getMarketMovers, type MoversResponse } from "@taiwan-stock/api-client";
import { Skeleton } from "@/shared/ui/atoms/skeleton";
import { MoverTable } from "./organisms/MoverTable";

const fetchMarketMovers = (): Promise<MoversResponse> => {
  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error("請求逾時（>30s），TWSE 資料可能暫時無法取得")), 30000)
  );
  return Promise.race([getMarketMovers(), timeout]);
};

const MarketPage: React.FC = () => {
  const { data, isLoading: loading, error } = useQuery<MoversResponse>({
    queryKey: ["market-movers"],
    queryFn: fetchMarketMovers,
    staleTime: 1000 * 60 * 30,
  });

  return (
    <div className="p-8 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">今日市場</h1>
        <p className="text-sm text-muted-foreground mt-1">
        台股上市收盤後資料
        {data?.date && <span className="ml-2 text-xs bg-muted px-2 py-0.5 rounded-full">資料日期：{data.date}</span>}
      </p>
      </div>

      {loading && (
        <div className="grid grid-cols-2 gap-5">
          <Skeleton className="h-96 rounded-xl" />
          <Skeleton className="h-96 rounded-xl" />
        </div>
      )}

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/30 rounded-lg px-4 py-3">
          無法取得資料：{error?.message}。若在盤中時間，TWSE 資料可能尚未更新。
        </div>
      )}

      {data && data.gainers.length === 0 && data.losers.length === 0 && (
        <div className="text-sm text-muted-foreground bg-card border border-border rounded-lg px-4 py-6 text-center">
          目前無資料。TWSE 收盤後資料約於台灣時間 16:30 更新，盤中或假日無法取得。
        </div>
      )}

      {data && (data.gainers.length > 0 || data.losers.length > 0) && (
        <div className="grid grid-cols-2 gap-5">
          <MoverTable title="漲幅前段" items={data.gainers} accentClass="bg-gain" />
          <MoverTable title="跌幅前段" items={data.losers} accentClass="bg-loss" />
        </div>
      )}
    </div>
  );
};

export default MarketPage;

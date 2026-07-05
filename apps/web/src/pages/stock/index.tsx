import { useParams, useRouter } from "@tanstack/react-router";
import StockDetailPanel from "@/widgets/stock-detail";

const StockPage: React.FC = () => {
  const { id } = useParams({ from: "/stock/$id" });
  const router = useRouter();

  return (
    <div className="px-4 sm:px-8 py-6 max-w-5xl">
      <button
        onClick={() => window.history.length > 1 ? router.history.back() : router.navigate({ to: "/", search: { concept: undefined } })}
        className="mb-4 text-sm text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
      >
        ← 返回
      </button>
      <StockDetailPanel symbol={id} variant="page" />
    </div>
  );
};

export default StockPage;

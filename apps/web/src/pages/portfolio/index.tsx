import { useSession } from "@/shared/lib/use-session";
import { SummaryCards } from "./organisms/SummaryCards";
import { PositionsTable } from "./organisms/PositionsTable";
import { AccountsPanel } from "./organisms/AccountsPanel";
import { TransactionsPanel } from "./organisms/TransactionsPanel";
import { RecurringPlansPanel } from "./organisms/RecurringPlansPanel";

const PortfolioPage: React.FC = () => {
  const { session, loading } = useSession();
  if (loading) return null;
  if (!session) return <div className="p-8 text-sm text-muted-foreground">登入後即可使用投資組合（點側欄頭像登入）</div>;
  return (
    <div className="px-4 sm:px-8 py-6 max-w-6xl flex flex-col gap-6">
      <h1 className="font-display text-xl font-bold">投資組合</h1>
      <SummaryCards />
      <PositionsTable />
      <div className="grid lg:grid-cols-2 gap-6">
        <AccountsPanel />
        <TransactionsPanel />
      </div>
      <RecurringPlansPanel />
    </div>
  );
};

export default PortfolioPage;

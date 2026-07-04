import { BacktestPanel } from "@/widgets/backtest-panel";

const BacktestPage: React.FC = () => {
  return (
    <div className="px-8 py-6 max-w-5xl">
      <div className="mb-6">
        <h1 className="text-xl font-bold">回測</h1>
      </div>
      <BacktestPanel />
    </div>
  );
};

export default BacktestPage;

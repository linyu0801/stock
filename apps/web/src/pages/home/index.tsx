import { WatchlistSection } from "@/widgets/watchlist-section";

export default function HomePage() {
  return (
    <div className="mx-auto max-w-3xl p-8">
      <h1 className="mb-6 text-2xl font-bold">自選股</h1>
      <WatchlistSection />
    </div>
  );
}

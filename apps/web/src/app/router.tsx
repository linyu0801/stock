import { createRouter, createRoute, createRootRoute, Outlet, Link, useRouterState } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const MarketPage    = lazy(() => import("@/pages/market"));
const WatchlistPage = lazy(() => import("@/pages/home"));
const StockPage     = lazy(() => import("@/pages/stock"));
const BacktestPage  = lazy(() => import("@/pages/backtest"));

const NAV_ITEMS = [
  { to: "/",          label: "市場",  icon: "home" },
  { to: "/watchlist", label: "自選股", icon: "list" },
  { to: "/backtest",  label: "回測",  icon: "chart" },
] as const;

function NavIcon({ type, active }: { type: string; active: boolean }) {
  const cls = `transition-colors ${active ? "text-accent-foreground" : "text-muted-foreground"}`;
  if (type === "home") return (
    <svg className={cls} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M3 12l9-9 9 9M5 10v9a1 1 0 001 1h4v-5h4v5h4a1 1 0 001-1v-9" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  if (type === "list") return (
    <svg className={cls} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
  return (
    <svg className={cls} width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.6" viewBox="0 0 24 24">
      <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function SideNav() {
  const { location: { pathname: path } } = useRouterState();

  return (
    <aside className="w-[72px] shrink-0 bg-background border-r border-border flex flex-col items-center py-5 gap-2">
      {/* Logo */}
      <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center mb-4 shrink-0">
        <span className="text-primary-foreground font-bold text-sm">台</span>
      </div>
      {NAV_ITEMS.map(({ to, label, icon }) => {
        const active = to === "/" ? path === "/" : path.startsWith(to);
        return (
          <Link
            key={to}
            to={to}
            className={`w-[52px] h-[52px] flex flex-col items-center justify-center rounded-xl gap-1 text-[11px] no-underline transition-colors ${
              active
                ? "bg-accent text-accent-foreground font-semibold"
                : "text-muted-foreground hover:bg-muted/50"
            }`}
          >
            <NavIcon type={icon} active={active} />
            {label}
          </Link>
        );
      })}
    </aside>
  );
}

const rootRoute = createRootRoute({
  component: () => (
    <div className="flex h-screen overflow-hidden bg-background">
      <SideNav />
      <main className="flex-1 overflow-auto">
        <Suspense fallback={<div className="p-8 text-sm text-muted-foreground">載入中…</div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  ),
});

const marketRoute    = createRoute({ getParentRoute: () => rootRoute, path: "/",          component: MarketPage });
const watchlistRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: "/watchlist",
  component: WatchlistPage,
  validateSearch: (s: Record<string, unknown>) => ({ group: s.group ? Number(s.group) : undefined }),
});
const stockRoute     = createRoute({ getParentRoute: () => rootRoute, path: "/stock/$id", component: StockPage });
const backtestRoute  = createRoute({ getParentRoute: () => rootRoute, path: "/backtest",  component: BacktestPage });

const routeTree = rootRoute.addChildren([marketRoute, watchlistRoute, stockRoute, backtestRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

import { createRouter, createRoute, createRootRoute, Outlet, Link } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

const HomePage = lazy(() => import("@/pages/home"));
const StockPage = lazy(() => import("@/pages/stock"));
const BacktestPage = lazy(() => import("@/pages/backtest"));

const rootRoute = createRootRoute({
  component: () => (
    <div className="min-h-screen bg-background text-foreground">
      <nav className="border-b px-8 py-3 flex gap-6 text-sm">
        <Link to="/" className="[&.active]:font-semibold">自選股</Link>
        <Link to="/backtest" className="[&.active]:font-semibold">回測</Link>
      </nav>
      <Suspense fallback={<div className="p-8 text-center">載入中…</div>}>
        <Outlet />
      </Suspense>
    </div>
  ),
});

const homeRoute = createRoute({ getParentRoute: () => rootRoute, path: "/", component: HomePage });
const stockRoute = createRoute({ getParentRoute: () => rootRoute, path: "/stock/$id", component: StockPage });
const backtestRoute = createRoute({ getParentRoute: () => rootRoute, path: "/backtest", component: BacktestPage });

const routeTree = rootRoute.addChildren([homeRoute, stockRoute, backtestRoute]);

export const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register { router: typeof router }
}

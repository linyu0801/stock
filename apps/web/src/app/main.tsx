import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "@tanstack/react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { setAuthTokenProvider } from "@taiwan-stock/api-client";
import { supabase } from "@/shared/lib/supabase";
import { queryClient } from "@/shared/lib/query-client";
import { router } from "./router";
import "./index.css";

setAuthTokenProvider(async () => (await supabase.auth.getSession()).data.session?.access_token ?? null);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>
);

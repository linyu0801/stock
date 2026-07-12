import { supabase } from "@/shared/lib/supabase";

export const LoginCard: React.FC = () => {
  const signIn = () =>
    supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: window.location.origin + "/watchlist" },
    });
  return (
    <div className="flex-1 h-full flex items-center justify-center">
      <div className="bg-card border border-border rounded-xl px-8 py-10 text-center max-w-sm">
        <h2 className="font-display font-bold text-lg mb-2">自選股</h2>
        <p className="text-sm text-muted-foreground mb-6">登入後即可建立與同步你的自選股清單</p>
        <button
          onClick={signIn}
          className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
        >
          使用 Google 登入
        </button>
      </div>
    </div>
  );
};

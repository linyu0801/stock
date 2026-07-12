import { useState } from "react";
import { LogOut } from "lucide-react";
import { useSession } from "@/shared/lib/use-session";
import { supabase } from "@/shared/lib/supabase";

type Props = {
  /** side = 桌機左欄（選單向右上展開）；top = 手機頂欄（選單向下展開） */
  placement?: "side" | "top";
};

const UserMenu: React.FC<Props> = ({ placement = "side" }) => {
  const { session } = useSession();
  const [open, setOpen] = useState(false);
  if (!session) return null;

  const email = session.user.email;
  const avatar = session.user.user_metadata?.avatar_url as string | undefined;
  const menuPos = placement === "side" ? "left-full bottom-0 ml-2" : "right-0 top-full mt-2";

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="使用者選單"
        className="w-8 h-8 rounded-full overflow-hidden flex items-center justify-center bg-muted hover:ring-2 hover:ring-ring/40 transition-shadow cursor-pointer"
      >
        {avatar ? (
          <img src={avatar} alt="" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs font-semibold text-muted-foreground uppercase">{email?.[0] ?? "?"}</span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className={`absolute z-50 w-56 rounded-lg border border-border bg-card shadow-lg py-1 ${menuPos}`}>
            <div className="px-3 py-2 border-b border-border">
              <p className="text-xs text-muted-foreground truncate">{email}</p>
            </div>
            <button
              onClick={() => {
                setOpen(false);
                supabase.auth.signOut();
              }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-left cursor-pointer hover:bg-muted/50 transition-colors"
            >
              <LogOut size={14} className="text-muted-foreground" />
              登出
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export { UserMenu };

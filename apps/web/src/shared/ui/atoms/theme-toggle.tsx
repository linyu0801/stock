import { Moon, Sun } from "lucide-react";
import { setTheme, useTheme } from "@/shared/lib/theme";

const ThemeToggle: React.FC = () => {
  const theme = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "切換為淺色主題" : "切換為深色主題"}
      className="w-11 h-11 flex items-center justify-center rounded-xl cursor-pointer text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
    >
      {isDark ? <Sun size={17} /> : <Moon size={17} />}
    </button>
  );
};

export { ThemeToggle };

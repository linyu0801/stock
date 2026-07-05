import { useSyncExternalStore } from "react";

export type Theme = "dark" | "light";

const listeners = new Set<() => void>();

const currentTheme = (): Theme =>
  document.documentElement.classList.contains("dark") ? "dark" : "light";

export const setTheme = (theme: Theme) => {
  document.documentElement.classList.toggle("dark", theme === "dark");
  localStorage.setItem("theme", theme);
  document.querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0D0D14" : "#F6F5FA");
  listeners.forEach((l) => l());
};

export const useTheme = (): Theme =>
  useSyncExternalStore((cb) => {
    listeners.add(cb);
    return () => listeners.delete(cb);
  }, currentTheme);

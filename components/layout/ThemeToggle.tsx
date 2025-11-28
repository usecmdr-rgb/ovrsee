"use client";

import { Moon, Sun } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";

const ThemeToggle = () => {
  const { theme, toggleTheme, isMounted } = useAppState();

  if (!isMounted) return null;

  return (
    <button
      onClick={toggleTheme}
      className="inline-flex items-center justify-center rounded-full w-8 h-8 text-slate-600 transition hover:text-slate-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:text-slate-300 dark:hover:text-slate-100 dark:focus-visible:outline-white"
      aria-label={`Switch to ${theme === "light" ? "dark" : "light"} theme`}
    >
      {theme === "light" ? <Moon size={16} aria-hidden="true" /> : <Sun size={16} aria-hidden="true" />}
    </button>
  );
};

export default ThemeToggle;

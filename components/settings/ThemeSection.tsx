"use client";

import { Check } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";

interface ThemeSectionProps {
  theme: "light" | "dark" | "system";
  onUpdate: (theme: "light" | "dark" | "system") => void;
  saveStatus: "saved" | "saving" | null;
}

export default function ThemeSection({ theme, onUpdate, saveStatus }: ThemeSectionProps) {
  const { setTheme } = useAppState();
  
  const options: Array<{ value: "light" | "dark" | "system"; label: string; description: string }> = [
    { value: "light", label: "Light", description: "Always use light mode" },
    { value: "dark", label: "Dark", description: "Always use dark mode" },
    { value: "system", label: "System", description: "Match your device settings" },
  ];

  const handleThemeChange = (newTheme: "light" | "dark" | "system") => {
    setTheme(newTheme);
    onUpdate(newTheme);
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-slate-900 dark:text-white">Theme</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Choose how OVRSEE looks to you
        </p>
      </div>

      <div className="space-y-3">
        {options.map((option) => (
          <button
            key={option.value}
            onClick={() => handleThemeChange(option.value)}
            className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition ${
              theme === option.value
                ? "border-slate-900 bg-slate-50 dark:border-white dark:bg-slate-800"
                : "border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600"
            }`}
          >
            <div className="flex-1 text-left">
              <div className="font-medium text-slate-900 dark:text-white">{option.label}</div>
              <div className="text-sm text-slate-600 dark:text-slate-400 mt-0.5">
                {option.description}
              </div>
            </div>
            {theme === option.value && (
              <Check className="h-5 w-5 text-slate-900 dark:text-white flex-shrink-0" />
            )}
          </button>
        ))}
      </div>

      {saveStatus === "saved" && (
        <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400">
          <Check size={16} />
          <span>Theme saved</span>
        </div>
      )}
    </div>
  );
}


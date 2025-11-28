"use client";

import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";
import AppSidebar from "./AppSidebar";

interface DashboardLayoutProps {
  children: React.ReactNode;
  activeAgent?: string | null;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { isAuthenticated, openAuthModal } = useAppState();
  const t = useTranslation();

  return (
    <div className="flex flex-col gap-4 sm:gap-6">
      {!isAuthenticated && (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white/70 p-4 sm:p-5 text-center text-slate-700 shadow-sm dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200">
          <h2 className="text-base sm:text-lg font-semibold">{t("previewModeHeading")}</h2>
          <p className="mt-1 text-xs sm:text-sm text-slate-500 dark:text-slate-400">
            {t("previewModeDescription")}
          </p>
          <button
            onClick={() => openAuthModal("login")}
            className="mt-3 inline-flex items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-xs font-semibold text-white shadow hover:bg-slate-800 dark:bg-white dark:text-slate-900"
          >
            {t("signInToUnlockFullAccess")}
          </button>
        </div>
      )}
      <AppSidebar />
      <div className="flex-1 space-y-4 sm:space-y-6">{children}</div>
    </div>
  );
};

export default DashboardLayout;





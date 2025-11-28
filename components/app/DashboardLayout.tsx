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
      <AppSidebar />
      <div className="flex-1 space-y-4 sm:space-y-6">{children}</div>
    </div>
  );
};

export default DashboardLayout;





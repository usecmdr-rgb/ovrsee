"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import { AGENTS } from "@/lib/config/agents";
import { useMemo, memo } from "react";

// Memoized LinkItem component to prevent unnecessary re-renders
const LinkItem = memo(({ 
  href, 
  label, 
  icon: Icon, 
  isLarge = false, 
  agentKey,
  pathname 
}: { 
  href: string; 
  label: string; 
  icon: any; 
  isLarge?: boolean; 
  agentKey: string | null;
  pathname: string;
}) => {
  // Check if pathname matches the href exactly, or starts with the agent route
  // Handles sub-pages like /studio/edit
  const isActive = useMemo(() => {
    if (agentKey) {
      // For agents, check if pathname starts with /agentKey
      return pathname === href || pathname.startsWith(`${href}/`);
    } else {
      // For dashboard, check exact match or /dashboard or /app
      return pathname === href || pathname === "/dashboard" || pathname === "/app" || pathname.startsWith("/app/");
    }
  }, [pathname, href, agentKey]);
  
  const isAgent = agentKey !== null;
  
  return (
    <Link
      href={href as any}
      className={`flex items-center justify-center space-x-1 sm:space-x-3 rounded-2xl font-semibold transition whitespace-nowrap flex-shrink-0 ${
        isLarge ? "px-3 sm:px-8 py-2.5 sm:py-5 text-sm sm:text-lg" : "px-2.5 sm:px-6 py-2 sm:py-4 text-xs sm:text-base"
      } ${
        isActive && isAgent
          ? "border-2 bg-transparent border-slate-900 dark:border-white text-slate-900 dark:text-white"
          : isActive
          ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
          : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
      }`}
    >
      <Icon size={isLarge ? 20 : 18} className="sm:w-[26px] sm:h-[26px] w-5 h-5 flex-shrink-0" />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
});

LinkItem.displayName = "LinkItem";

const AppSidebar = () => {
  const pathname = usePathname();
  const t = useTranslation();

  // Memoize agentLinks to avoid recreating on every render
  // Use translation keys for agent labels so they update when language changes
  const agentLinks = useMemo(() => 
    AGENTS.map((agent) => {
      // Map agent IDs to translation keys
      const labelKey = {
        aloha: "alohaLabel",
        sync: "syncLabel",
        studio: "studioLabel",
        insight: "insightLabel",
      }[agent.id] as "alohaLabel" | "syncLabel" | "studioLabel" | "insightLabel";
      
      return {
        href: agent.route,
        label: t(labelKey),
        icon: agent.icon,
        isLarge: false,
        agentKey: agent.id,
      };
    }), 
    [t]
  );

  // Memoize allLinks array construction
  const allLinks = useMemo(() => {
    // Always include all agents and dashboard - ensure all links are visible
    // Layout: [Sync, Aloha, Dashboard (large), Studio, Insight]
    const syncLink = agentLinks.find(link => link.agentKey === "sync");
    const alohaLink = agentLinks.find(link => link.agentKey === "aloha");
    const studioLink = agentLinks.find(link => link.agentKey === "studio");
    const insightLink = agentLinks.find(link => link.agentKey === "insight");

    const summaryLabel = t("summary");
    
    return [
      syncLink!,
      alohaLink!,
      { href: "/dashboard", label: summaryLabel, icon: LayoutDashboard, isLarge: true, agentKey: null },
      studioLink!,
      insightLink!,
    ];
  }, [agentLinks, t]);

  // Debug: Log to ensure all links are present (remove in production if needed)
  if (process.env.NODE_ENV === "development" && allLinks.length !== 5) {
    console.warn("AppSidebar: Expected 5 links (4 agents + dashboard), got", allLinks.length);
  }

  return (
    <aside className="w-full rounded-3xl border border-slate-200 bg-white/80 p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <nav className="flex items-center justify-start sm:justify-evenly gap-4 flex-wrap" role="navigation" aria-label="Agent navigation">
        {allLinks.map(({ href, label, icon, isLarge, agentKey }) => (
          <LinkItem 
            key={`${href}-${agentKey || 'dashboard'}`} 
            href={href} 
            label={label} 
            icon={icon} 
            isLarge={isLarge} 
            agentKey={agentKey}
            pathname={pathname}
          />
        ))}
      </nav>
    </aside>
  );
};

export default AppSidebar;

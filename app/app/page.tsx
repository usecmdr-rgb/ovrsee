"use client";

import { useMemo, useState, useEffect, useCallback, memo } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Clock, DollarSign } from "lucide-react";
import { useAppState } from "@/context/AppStateContext";
import { agents } from "@/lib/data";
import { useTranslation } from "@/hooks/useTranslation";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";
import { useAgentAccess } from "@/hooks/useAgentAccess";
import { useAccountMode } from "@/hooks/useAccountMode";
import PreviewBanner from "@/components/agent/PreviewBanner";
import TrialExpiredBanner from "@/components/agent/TrialExpiredBanner";
import type { AgentKey } from "@/types";
import { formatMoney as formatCurrency } from "@/lib/currency";

import { AGENT_BY_ID } from "@/lib/config/agents";

const agentRouteMap: Record<AgentKey, string> = {
  aloha: "/aloha",
  sync: "/sync",
  studio: "/studio",
  insight: "/insight",
};

const dataByTimeframe = {
  today: {
    aloha: { calls: 32, missed: 2, appointments: 5 },
    sync: { important: 6, unread: 4, payments: 3, alerts: 2 },
    studio: { media: 4, last: "Spring promo" },
    insight: { summary: "You had 32 calls, 6 important emails, and 5 appointments." },
  },
  week: {
    aloha: { calls: 180, missed: 11, appointments: 22 },
    sync: { important: 28, unread: 12, payments: 7, alerts: 5 },
    studio: { media: 17, last: "Testimonials reel" },
    insight: { summary: "This week OVRSEE saved ~14 hours through agent coverage." },
  },
  month: {
    aloha: { calls: 680, missed: 40, appointments: 88 },
    sync: { important: 90, unread: 32, payments: 23, alerts: 18 },
    studio: { media: 52, last: "FY25 media kit" },
    insight: { summary: "Monthly trend: calls +18%, important emails -11%." },
  },
} as const;

// Memoized Agent Card Component
const AgentCard = memo(({ 
  card, 
  agentRouteMap 
}: { 
  card: {
    title: string;
    key: AgentKey;
    subtitle: string;
    content: string;
    footer: string;
  };
  agentRouteMap: Record<AgentKey, string>;
}) => {
  // Memoize agent and icon lookups to avoid repeating on every render
  const { agent, Icon } = useMemo(() => {
    const foundAgent = agents.find((a) => a.key === card.key);
    const config = AGENT_BY_ID[card.key];
    return {
      agent: foundAgent,
      Icon: config?.icon
    };
  }, [card.key]);
  
  return (
    <article className="rounded-3xl border border-slate-200 bg-white/80 p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40 text-center" role="listitem">
      <div className="flex flex-col items-center gap-3 sm:gap-4">
        {agent && Icon && (
          <Link
            href={agentRouteMap[card.key] as any}
            className={`inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-2xl ${agent.accent} text-white transition-opacity hover:opacity-80 cursor-pointer`}
          >
            <Icon size={20} className="sm:w-[22px] sm:h-[22px] text-white" />
          </Link>
        )}
        <div>
          <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-500">{card.subtitle}</p>
          <h3 className="mt-1 text-xl sm:text-2xl font-semibold">{card.title}</h3>
        </div>
      </div>
      <p className="mt-3 sm:mt-4 text-base sm:text-lg text-slate-600 dark:text-slate-200">{card.content}</p>
      <p className="mt-2 text-xs sm:text-sm text-slate-500">{card.footer}</p>
    </article>
  );
});

AgentCard.displayName = "AgentCard";

// Memoized Stats Display Component
const StatsDisplay = memo(({ 
  timeSaved, 
  moneySaved, 
  selectedTimeframeLabel,
  statsLoading,
  formatTime,
  formatMoney
}: {
  timeSaved: number;
  moneySaved: number;
  selectedTimeframeLabel: string;
  statsLoading: boolean;
  formatTime: (minutes: number) => string;
  formatMoney: (usdAmount: number) => string;
}) => {
  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 sm:p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-500">Time Saved</p>
              <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                {statsLoading ? "..." : formatTime(timeSaved)}
              </p>
            </div>
          </div>
          <div className="h-6 sm:h-8 w-px bg-slate-200 dark:bg-slate-800" />
          <div className="flex items-center gap-2 min-w-0">
            <DollarSign className="h-4 w-4 sm:h-5 sm:w-5 text-slate-600 dark:text-slate-400 flex-shrink-0" />
            <div className="min-w-0">
              <p className="text-[10px] sm:text-xs uppercase tracking-widest text-slate-500">Money Saved</p>
              <p className="text-base sm:text-lg font-semibold text-slate-900 dark:text-slate-100">
                {statsLoading ? "..." : formatMoney(moneySaved)}
              </p>
            </div>
          </div>
        </div>
        <div className="text-[10px] sm:text-xs text-slate-500 dark:text-slate-400 text-center sm:text-right">
          {selectedTimeframeLabel && (
            <p className="uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1">
              {selectedTimeframeLabel}
            </p>
          )}
          <p>Based on all agent activities</p>
        </div>
      </div>
    </div>
  );
});

StatsDisplay.displayName = "StatsDisplay";

// Memoized Dashboard Header Component
const DashboardHeader = memo(({ 
  dashboardLabel,
  resumeOfTheDayLabel,
  businessName,
  businessLocation,
  locationTbdLabel,
  forBusinessLabel
}: {
  dashboardLabel: string;
  resumeOfTheDayLabel: string;
  businessName?: string;
  businessLocation?: string;
  locationTbdLabel: string;
  forBusinessLabel: string;
}) => {
  const businessInfoDisplay = useMemo(() => {
    if (!businessName) return null;
    return `${forBusinessLabel} ${businessName} - ${businessLocation || locationTbdLabel}`;
  }, [businessName, businessLocation, forBusinessLabel, locationTbdLabel]);

  return (
    <div className="flex-1 min-w-0">
      <p className="text-xs sm:text-sm uppercase tracking-widest text-slate-500">{dashboardLabel}</p>
      <h1 className="text-2xl sm:text-3xl font-semibold">{resumeOfTheDayLabel}</h1>
      {businessInfoDisplay && (
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          {businessInfoDisplay}
        </p>
      )}
    </div>
  );
});

DashboardHeader.displayName = "DashboardHeader";

// Memoized Timeframe Selector Component
const TimeframeSelector = memo(({ 
  timeframes,
  selectedTimeframe,
  onTimeframeChange
}: {
  timeframes: Array<{ id: keyof typeof dataByTimeframe; label: string }>;
  selectedTimeframe: keyof typeof dataByTimeframe;
  onTimeframeChange: (id: keyof typeof dataByTimeframe) => void;
}) => {
  return (
    <div className="flex gap-1 sm:gap-2 rounded-full border border-slate-200 p-1 text-xs sm:text-sm font-semibold dark:border-slate-800 overflow-x-auto">
      {timeframes.map((item) => (
        <button
          key={item.id}
          onClick={() => onTimeframeChange(item.id)}
          className={`rounded-full px-3 sm:px-4 py-1.5 sm:py-2 whitespace-nowrap flex-shrink-0 ${
            selectedTimeframe === item.id
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "text-slate-500"
          }`}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
});

TimeframeSelector.displayName = "TimeframeSelector";

export default function DashboardPage() {
  const [timeframe, setTimeframe] = useState<keyof typeof dataByTimeframe>("today");
  const pathname = usePathname();
  const { businessInfo, language, isAuthenticated } = useAppState();
  const t = useTranslation();
  const { accessibleAgents, isLoading: accessLoading } = useAgentAccess();
  const { stats: agentStats, loading: statsLoading } = useAgentStats();
  const { mode: accountMode, loading: accountModeLoading } = useAccountMode();
  
  // Reset timeframe to "today" when navigating to dashboard to ensure consistent UI
  useEffect(() => {
    if (pathname === "/app" || pathname === "/dashboard") {
      setTimeframe("today");
    }
  }, [pathname]);
  
  // Wait for access and account mode to be determined before showing stats to prevent flashing
  const isAccessReady = useMemo(() => !accessLoading && !accountModeLoading, [accessLoading, accountModeLoading]);
  
  // Determine if user is in preview mode based on account mode
  // Preview mode = accountMode === 'preview'
  const isPreview = useMemo(() => {
    return isAccessReady && accountMode === 'preview';
  }, [isAccessReady, accountMode]);
  
  // Check if trial is expired
  const isTrialExpired = useMemo(() => {
    return isAccessReady && accountMode === 'trial-expired';
  }, [isAccessReady, accountMode]);
  
  // Memoize preview stats lookup
  const previewStats = useMemo(() => dataByTimeframe[timeframe], [timeframe]);
  
  // Determine which stats to use based on account mode
  // Preview mode: use mock data
  // Trial-active, trial-expired, subscribed: use real stats (starting from 0 at activation)
  const latestStats = useMemo(() => {
    if (!isAccessReady) {
      // Return empty stats while loading to prevent flash
      return emptyAgentStats;
    }
    // In preview mode, return null to use preview stats
    // In all other modes (trial-active, trial-expired, subscribed), use real stats
    return isPreview ? null : (agentStats ?? emptyAgentStats);
  }, [isAccessReady, isPreview, agentStats]);
  
  // Calculate time saved (in minutes) from all agent activities combined
  const timeSaved = useMemo(() => {
    // Use preview stats if in preview mode
    if (isPreview) {
      const preview = previewStats;
      // Aloha agent: Calls answered + appointments booked
      const answeredCalls = Math.max(preview.aloha.calls - preview.aloha.missed, 0);
      const callsTime = answeredCalls * 2; // 2 minutes per answered call
      const appointmentsTime = preview.aloha.appointments * 5; // 5 minutes per appointment (scheduling coordination)
      
      // Sync agent: Emails + payments/bills (approximate invoices from payments count)
      const emailsTime = preview.sync.important * 1; // 1 minute per email (reading, triaging, drafting)
      // Estimate invoices as ~40% of payments count for preview
      const estimatedInvoices = Math.floor(preview.sync.payments * 0.4);
      const invoicesTime = estimatedInvoices * 5; // 5 minutes per invoice (review, categorization)
      const paymentsTime = preview.sync.payments * 3; // 3 minutes per payment/bill (review, record keeping)
      
      // Studio agent: Media edits
      const mediaTime = preview.studio.media * 3; // 3 minutes per media edit (adjustments, filters, text overlays)
      
      // Insight agent: Insights generated (not available in preview data)
      const insightsTime = 0;
      
      return callsTime + appointmentsTime + emailsTime + invoicesTime + paymentsTime + mediaTime + insightsTime;
    }
    
    // Use real stats when not in preview mode
    if (!latestStats) return 0;
    
    // Aloha agent: Calls answered + appointments booked
    const answeredCalls = Math.max(latestStats.alpha_calls_total - latestStats.alpha_calls_missed, 0);
    const callsTime = answeredCalls * 2; // 2 minutes per answered call
    const appointmentsTime = latestStats.alpha_appointments * 5; // 5 minutes per appointment
    
    // Sync agent: Emails + invoices + payments
    const emailsTime = latestStats.xi_important_emails * 1; // 1 minute per email processed
    const invoicesTime = latestStats.xi_invoices * 5; // 5 minutes per invoice
    const paymentsTime = latestStats.xi_payments_bills * 3; // 3 minutes per payment/bill
    
    // Studio agent: Media edits
    const mediaTime = latestStats.mu_media_edits * 3; // 3 minutes per media edit
    
    // Insight agent: Insights generated
    const insightsTime = latestStats.beta_insights_count * 10; // 10 minutes per insight (strategic value)
    
    return callsTime + appointmentsTime + emailsTime + invoicesTime + paymentsTime + mediaTime + insightsTime;
  }, [latestStats, isPreview, previewStats]);
  
  // Calculate money saved (assuming $50/hour rate in USD)
  const hourlyRate = 50; // $50 per hour in USD
  const moneySaved = useMemo(() => {
    const hoursSaved = timeSaved / 60;
    return hoursSaved * hourlyRate;
  }, [timeSaved]);
  
  // Memoize formatTime to avoid recreating on every render
  const formatTime = useCallback((minutes: number) => {
    if (minutes < 60) {
      return `${Math.round(minutes)} min`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  }, []);
  
  // Memoize formatMoney to avoid recreating on every render
  const formatMoney = useCallback((usdAmount: number) => {
    return formatCurrency(usdAmount, language);
  }, [language]);
  
  // Memoize timeframe change handler
  const handleTimeframeChange = useCallback((id: keyof typeof dataByTimeframe) => {
    setTimeframe(id);
  }, []);

  const timeframes = useMemo(
    () => [
      { id: "today" as const, label: t("today") },
      { id: "week" as const, label: t("thisWeek") },
      { id: "month" as const, label: t("thisMonth") },
    ],
    [t]
  );

  const selectedTimeframeLabel = useMemo(() => {
    const active = timeframes.find((item) => item.id === timeframe);
    return active ? active.label : "";
  }, [timeframes, timeframe]);

  // Memoize statsToUse computation separately for clarity
  const statsToUse = useMemo(() => {
    if (isPreview) {
      return previewStats;
    }
    return {
      aloha: {
        calls: latestStats?.alpha_calls_total ?? 0,
        missed: latestStats?.alpha_calls_missed ?? 0,
        appointments: latestStats?.alpha_appointments ?? 0,
      },
      sync: {
        important: latestStats?.xi_important_emails ?? 0,
        unread: latestStats?.xi_missed_emails ?? 0,
        payments: latestStats?.xi_payments_bills ?? 0,
        alerts: 0, // No alerts field in stats
      },
      studio: {
        media: latestStats?.mu_media_edits ?? 0,
        last: "N/A",
      },
      insight: {
        summary: latestStats?.beta_insights_count 
          ? `Generated ${latestStats.beta_insights_count} insights.` 
          : "No insights generated yet.",
      },
    };
  }, [isPreview, previewStats, latestStats]);

  const resume = useMemo(
    () => {
      return [
        {
          title: AGENT_BY_ID.aloha.label,
          key: "aloha" as AgentKey,
          subtitle: t("callsAppointments"),
          content: `${statsToUse.aloha.calls} ${t("handled")} / ${statsToUse.aloha.missed} ${t("missed")}` as string,
          footer: `${statsToUse.aloha.appointments} ${t("newAppointments")}`,
        },
        {
          title: AGENT_BY_ID.sync.label,
          key: "sync" as AgentKey,
          subtitle: t("emailCalendar"),
          content: `${statsToUse.sync.important} ${t("important")} - ${statsToUse.sync.unread} ${t("needReply")}`,
          footer: `${statsToUse.sync.payments} ${t("paymentsBills")} - ${statsToUse.sync.alerts} ${t("alerts")}`,
        },
        {
          title: AGENT_BY_ID.studio.label,
          key: "studio" as AgentKey,
          subtitle: t("media"),
          content: `${statsToUse.studio.media} ${t("itemsTouched")}`,
          footer: `${t("last")}: ${statsToUse.studio.last}`,
        },
        {
          title: AGENT_BY_ID.insight.label,
          key: "insight" as AgentKey,
          subtitle: t("insights"),
          content: statsToUse.insight.summary,
          footer: t("timeframeSmartSummary"),
        },
      ];
    },
    [statsToUse, t]
  );
  
  // Memoize translation strings used in header
  const dashboardLabel = useMemo(() => t("dashboard"), [t]);
  const resumeOfTheDayLabel = useMemo(() => t("resumeOfTheDay"), [t]);
  const forBusinessLabel = useMemo(() => t("forBusiness"), [t]);
  const locationTbdLabel = useMemo(() => t("locationTbd"), [t]);

  return (
    <div className="space-y-4 sm:space-y-8">
      {isPreview && (
        <PreviewBanner 
          agentName={t("dashboardSummary")} 
        />
      )}
      {isTrialExpired && (
        <TrialExpiredBanner />
      )}
      <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center sm:justify-between gap-3 sm:gap-4">
        <DashboardHeader
          dashboardLabel={dashboardLabel}
          resumeOfTheDayLabel={resumeOfTheDayLabel}
          businessName={businessInfo.businessName}
          businessLocation={businessInfo.location}
          locationTbdLabel={locationTbdLabel}
          forBusinessLabel={forBusinessLabel}
        />
        <TimeframeSelector
          timeframes={timeframes}
          selectedTimeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
        />
      </div>
      <div className="grid gap-4 sm:gap-6 grid-cols-1 md:grid-cols-2" role="list">
        {resume.map((card) => (
          <AgentCard 
            key={card.title} 
            card={card}
            agentRouteMap={agentRouteMap}
          />
        ))}
      </div>
      
      {/* Time and money saved bubble - placed under all agents */}
      <StatsDisplay
        timeSaved={timeSaved}
        moneySaved={moneySaved}
        selectedTimeframeLabel={selectedTimeframeLabel}
        statsLoading={statsLoading}
        formatTime={formatTime}
        formatMoney={formatMoney}
      />
    </div>
  );
}

"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

interface TrialExpiredLockProps {
  className?: string;
}

/**
 * A subtle, elegant lock component displayed when trial expires.
 * Shows a lock icon with a friendly message encouraging upgrade.
 */
export default function TrialExpiredLock({ className = "" }: TrialExpiredLockProps) {
  const t = useTranslation();
  
  return (
    <div className={`flex flex-col items-center justify-center py-12 px-4 ${className}`}>
      <div className="relative mb-4">
        <div className="absolute inset-0 rounded-full bg-slate-200/50 dark:bg-slate-700/50 blur-xl"></div>
        <div className="relative rounded-full bg-slate-100/80 p-4 dark:bg-slate-800/60">
          <Lock className="h-8 w-8 text-slate-400 dark:text-slate-500" strokeWidth={1.5} />
        </div>
      </div>
      <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">
        Free trial expired
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-500 text-center max-w-xs">
        Upgrade your plan to continue accessing insights
      </p>
      <Link
        href="/pricing"
        className="mt-4 inline-flex items-center gap-1.5 rounded-full border border-slate-300 bg-white/50 px-4 py-1.5 text-xs font-semibold text-slate-700 transition-all hover:border-slate-400 hover:bg-white hover:shadow-sm dark:border-slate-600 dark:bg-slate-800/50 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:bg-slate-800"
      >
        View Pricing
      </Link>
    </div>
  );
}





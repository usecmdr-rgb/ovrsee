"use client";

import { Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

interface PreviewBannerProps {
  agentName: string;
  requiredTier?: "basic" | "advanced" | "elite";
}

export default function PreviewBanner({ agentName, requiredTier }: PreviewBannerProps) {
  const t = useTranslation();
  return (
    <div className="mb-6 rounded-2xl border-2 border-amber-300 bg-gradient-to-r from-amber-50 to-yellow-50 p-6 dark:border-amber-600 dark:from-amber-900/20 dark:to-yellow-900/20">
      <div className="flex items-start gap-4">
        <div className="rounded-full bg-amber-100 p-2 dark:bg-amber-900/40">
          <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400" />
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <Lock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-100">
              {t("previewModeTitle")}
            </h3>
          </div>
          <p className="text-sm text-amber-800 dark:text-amber-200">
            {t("previewModeDescription").replace("{agentName}", agentName)}
            {requiredTier && (
              <>
                {" "}
                {t("previewModeUpgradeToTier").replace("{tier}", t(requiredTier as "basic" | "advanced" | "elite"))}{" "}
              </>
            )}
            {!requiredTier && (
              <> {t("previewModeUpgradePlan")}{" "}</>
            )}
            <Link
              href="/pricing"
              className="inline-flex items-center gap-1 rounded-full bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-700 transition-colors align-baseline dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              {t("previewModeViewPricing")}
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}


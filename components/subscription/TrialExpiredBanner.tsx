"use client";

import { AlertCircle, CreditCard } from "lucide-react";
import Link from "next/link";

interface TrialExpiredBannerProps {
  daysRemaining?: number | null;
  isExpired: boolean;
}

export default function TrialExpiredBanner({ daysRemaining, isExpired }: TrialExpiredBannerProps) {
  if (!isExpired && daysRemaining !== null && daysRemaining !== undefined && daysRemaining > 0) {
    // Show trial countdown
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold text-amber-900 dark:text-amber-100">
              Free Trial Active
            </h3>
            <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
              {daysRemaining === 1 
                ? "Your trial ends tomorrow. Upgrade now to keep your access."
                : `Your free trial ends in ${daysRemaining} days. Upgrade to continue using all features.`}
            </p>
            <Link
              href="/pricing"
              className="mt-3 inline-flex items-center gap-2 rounded-full bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 dark:bg-amber-500 dark:hover:bg-amber-600"
            >
              <CreditCard className="h-4 w-4" />
              Upgrade Now
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (isExpired) {
    // Show expired message
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-6 w-6 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-red-900 dark:text-red-100">
              Your Free Trial Has Expired
            </h3>
            <p className="mt-2 text-sm text-red-800 dark:text-red-200">
              Your 3-day free trial has ended. To continue using CommanderX, please upgrade to a paid plan.
              Your data (agents, conversations, messages) has been preserved and will be available once you upgrade.
            </p>
            <div className="mt-4 flex flex-wrap gap-3">
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full bg-red-600 px-6 py-3 text-sm font-semibold text-white hover:bg-red-700 dark:bg-red-500 dark:hover:bg-red-600"
              >
                <CreditCard className="h-4 w-4" />
                Choose a Plan
              </Link>
              <Link
                href="/account/subscription"
                className="inline-flex items-center gap-2 rounded-full border border-red-300 bg-white px-6 py-3 text-sm font-semibold text-red-700 hover:bg-red-50 dark:border-red-700 dark:bg-slate-900 dark:text-red-300 dark:hover:bg-slate-800"
              >
                View Subscription
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}


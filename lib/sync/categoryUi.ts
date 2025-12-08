/**
 * Category UI Configuration
 * Defines labels, colors, and icons for email categories
 */

import {
  AlertCircle,
  Mail,
  DollarSign,
  Receipt,
  Megaphone,
  Bell,
  Circle,
  Calendar,
  CheckCircle,
  Clock,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type EmailCategory =
  | "important"
  | "missed_unread"
  | "followups"
  | "payment_bill"
  | "invoice"
  | "marketing"
  | "updates"
  | "other";

export interface CategoryConfig {
  label: string;
  icon: LucideIcon;
  bgColor: string; // Tailwind background color class
  textColor: string; // Tailwind text color class
  borderColor: string; // Tailwind border color class
  badgeBg: string; // Badge/pill background
  badgeText: string; // Badge/pill text
}

/**
 * UI configuration for each email category
 * Uses existing OVRSEE design system colors
 */
export const CATEGORY_CONFIG: Record<EmailCategory, CategoryConfig> = {
  important: {
    label: "Important",
    icon: AlertCircle,
    bgColor: "bg-amber-50 dark:bg-amber-900/20",
    textColor: "text-amber-700 dark:text-amber-300",
    borderColor: "border-amber-200 dark:border-amber-800",
    badgeBg: "bg-amber-100 dark:bg-amber-900/40",
    badgeText: "text-amber-700 dark:text-amber-300",
  },
  missed_unread: {
    label: "Missed",
    icon: Mail,
    bgColor: "bg-blue-50 dark:bg-blue-900/20",
    textColor: "text-blue-700 dark:text-blue-300",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeBg: "bg-blue-100 dark:bg-blue-900/40",
    badgeText: "text-blue-700 dark:text-blue-300",
  },
  followups: {
    label: "Follow-ups",
    icon: Clock,
    bgColor: "bg-orange-50 dark:bg-orange-900/20",
    textColor: "text-orange-700 dark:text-orange-300",
    borderColor: "border-orange-200 dark:border-orange-800",
    badgeBg: "bg-orange-100 dark:bg-orange-900/40",
    badgeText: "text-orange-700 dark:text-orange-300",
  },
  payment_bill: {
    label: "Payment",
    icon: DollarSign,
    bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
    textColor: "text-emerald-700 dark:text-emerald-300",
    borderColor: "border-emerald-200 dark:border-emerald-800",
    badgeBg: "bg-emerald-100 dark:bg-emerald-900/40",
    badgeText: "text-emerald-700 dark:text-emerald-300",
  },
  invoice: {
    label: "Invoice",
    icon: Receipt,
    bgColor: "bg-purple-50 dark:bg-purple-900/20",
    textColor: "text-purple-700 dark:text-purple-300",
    borderColor: "border-purple-200 dark:border-purple-800",
    badgeBg: "bg-purple-100 dark:bg-purple-900/40",
    badgeText: "text-purple-700 dark:text-purple-300",
  },
  marketing: {
    label: "Marketing",
    icon: Megaphone,
    bgColor: "bg-pink-50 dark:bg-pink-900/20",
    textColor: "text-pink-700 dark:text-pink-300",
    borderColor: "border-pink-200 dark:border-pink-800",
    badgeBg: "bg-pink-100 dark:bg-pink-900/40",
    badgeText: "text-pink-700 dark:text-pink-300",
  },
  updates: {
    label: "Updates",
    icon: Bell,
    bgColor: "bg-slate-50 dark:bg-slate-800/50",
    textColor: "text-slate-700 dark:text-slate-300",
    borderColor: "border-slate-200 dark:border-slate-700",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-700 dark:text-slate-300",
  },
  other: {
    label: "Other",
    icon: Circle,
    bgColor: "bg-slate-50 dark:bg-slate-800/50",
    textColor: "text-slate-600 dark:text-slate-400",
    borderColor: "border-slate-200 dark:border-slate-700",
    badgeBg: "bg-slate-100 dark:bg-slate-800",
    badgeText: "text-slate-600 dark:text-slate-400",
  },
};

/**
 * Get category config for a given category
 */
export function getCategoryConfig(category: EmailCategory | string | null | undefined): CategoryConfig {
  if (!category || !(category in CATEGORY_CONFIG)) {
    return CATEGORY_CONFIG.other;
  }
  return CATEGORY_CONFIG[category as EmailCategory];
}

/**
 * Get all categories for filter UI
 */
export function getAllCategories(): EmailCategory[] {
  return Object.keys(CATEGORY_CONFIG) as EmailCategory[];
}

/**
 * Check if a category is valid
 */
export function isValidCategory(category: string | null | undefined): category is EmailCategory {
  return category !== null && category !== undefined && category in CATEGORY_CONFIG;
}


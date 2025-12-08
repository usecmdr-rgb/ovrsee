"use client";

import { useState, useEffect } from "react";
import { Receipt, Info, Loader2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { formatPrice } from "@/lib/currency";
import { useAppState } from "@/context/AppStateContext";
import { useSupabase } from "@/components/SupabaseProvider";
import { getTaxDisclaimer } from "@/lib/tax";

interface BillingPreview {
  amountDue: number;
  currency: string;
  nextPaymentDate: string | null;
  lineItems: {
    description: string;
    amount: number;
    quantity?: number;
  }[];
}

export default function BillingPreview() {
  const { language, isAuthenticated } = useAppState();
  const { supabase } = useSupabase();
  const [preview, setPreview] = useState<BillingPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    fetchPreview();

    // Listen for refresh events
    const handleRefresh = () => {
      if (isAuthenticated) {
        fetchPreview();
      }
    };
    window.addEventListener("billing-preview-refresh", handleRefresh);
    return () => {
      window.removeEventListener("billing-preview-refresh", handleRefresh);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchPreview = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/billing/preview");
      
      if (response.status === 401) {
        // Not authenticated, don't retry
        setLoading(false);
        return;
      }
      
      const result = await response.json();

      if (result.ok) {
        setPreview(result.data);
      } else {
        setError(result.error || "Failed to fetch billing preview");
      }
    } catch (err: any) {
      // Don't show error for auth failures
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        setLoading(false);
        return;
      }
      setError(err.message || "Failed to fetch billing preview");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            Next Invoice Estimate
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return null; // Silently fail - don't show error for billing preview
  }

  if (!preview || preview.amountDue === 0 || preview.lineItems.length === 0) {
    return null; // Don't show if no billing data
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "N/A";
    return new Date(dateString).toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Receipt className="h-5 w-5" />
          Next Invoice Estimate
          <div className="group relative">
            <Info className="h-4 w-4 text-slate-400 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 text-xs bg-slate-900 text-white rounded-lg shadow-lg z-10">
              Stripe estimate (may differ slightly from UI discount view if discounts/coupons/taxes are applied at Stripe level). Your Stripe subscription is automatically updated to match your team seats and tiers.
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {preview.nextPaymentDate && (
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Due on {formatDate(preview.nextPaymentDate)}
          </p>
        )}

        <div className="space-y-2">
          {preview.lineItems.map((item, index) => (
            <div
              key={index}
              className="flex items-center justify-between text-sm"
            >
              <span className="text-slate-600 dark:text-slate-300">
                {item.description}
              </span>
              <span className="font-medium">
                {formatPrice(item.amount / 100, language)}
              </span>
            </div>
          ))}
        </div>

        <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
          <div className="flex items-center justify-between">
            <span className="font-semibold">Total</span>
            <span className="text-lg font-semibold">
              {formatPrice(preview.amountDue / 100, language)}
            </span>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
            {getTaxDisclaimer()}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}


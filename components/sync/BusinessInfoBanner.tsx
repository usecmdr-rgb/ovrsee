"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Info, X } from "lucide-react";

export default function BusinessInfoBanner() {
  const router = useRouter();
  const [showBanner, setShowBanner] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkBusinessInfo();
  }, []);

  const checkBusinessInfo = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setLoading(false);
        return;
      }

      const res = await fetch("/api/settings/business", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        const hasProfile = !!data.profile;
        const hasServices = (data.services || []).length > 0;
        const hasPricing = (data.pricingTiers || []).length > 0;

        // Show banner if business info is incomplete
        if (!hasProfile || !hasServices || !hasPricing) {
          setShowBanner(true);
        }
      }
    } catch (error) {
      console.error("Error checking business info:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading || !showBanner) {
    return null;
  }

  return (
    <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center justify-between">
      <div className="flex items-center gap-2 flex-1">
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 flex-shrink-0" />
        <p className="text-sm text-amber-700 dark:text-amber-300">
          Help Sync answer emails with accurate details. Set up your business info.
        </p>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push("/settings/business")}
          className="px-3 py-1.5 text-xs font-semibold bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          Set up business info
        </button>
        <button
          onClick={() => setShowBanner(false)}
          className="p-1 hover:bg-amber-100 dark:hover:bg-amber-900/40 rounded"
        >
          <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </button>
      </div>
    </div>
  );
}



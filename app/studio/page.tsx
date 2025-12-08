"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2 } from "lucide-react";

export default function StudioPage() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);
  
  useEffect(() => {
    checkOnboarding();
  }, []);

  const checkOnboarding = async () => {
    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      // Check if onboarding is required (only requires connected accounts)
      const res = await fetch("/api/studio/onboarding", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok && data.data.is_required) {
          router.replace("/studio/onboarding");
          return;
        }
      }

      // Default to overview
      router.replace("/studio/overview");
    } catch (error) {
      console.error("Error checking onboarding:", error);
      // On error, go to overview
      router.replace("/studio/overview");
    } finally {
      setChecking(false);
    }
  };

  if (checking) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return null;
}

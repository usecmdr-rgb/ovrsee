"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import {
  CheckCircle2,
  Circle,
  Link2,
  FileText,
  Sparkles,
  Eye,
  Loader2,
} from "lucide-react";

type OnboardingStep = "connect_accounts" | "brand_profile" | "first_plan" | "review";

const REQUIRED_STEPS: OnboardingStep[] = ["connect_accounts"];
const OPTIONAL_STEPS: OnboardingStep[] = ["brand_profile", "first_plan", "review"];

const STEPS: Array<{
  id: OnboardingStep;
  title: string;
  description: string;
  icon: any;
  isRequired: boolean;
  action?: () => void;
}> = [
  {
    id: "connect_accounts",
    title: "Connect Social Accounts",
    description: "Link your Instagram, TikTok, or Facebook accounts to start publishing",
    icon: Link2,
    isRequired: true,
  },
  {
    id: "brand_profile",
    title: "Fill Brand Profile",
    description: "Tell us about your brand voice and target audience (optional)",
    icon: FileText,
    isRequired: false,
  },
  {
    id: "first_plan",
    title: "Generate First Weekly Plan",
    description: "Create your first content plan with AI (optional)",
    icon: Sparkles,
    isRequired: false,
  },
  {
    id: "review",
    title: "Review Overview & Calendar",
    description: "Explore your content calendar and dashboard (optional)",
    icon: Eye,
    isRequired: false,
  },
];

export default function StudioOnboardingPage() {
  const router = useRouter();
  const [completedSteps, setCompletedSteps] = useState<OnboardingStep[]>([]);
  const [loading, setLoading] = useState(true);
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);

  useEffect(() => {
    loadOnboardingState();
  }, []);

  const loadOnboardingState = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      // Get workspace ID
      const { data: { user } } = await supabaseBrowserClient.auth.getUser();
      if (!user) return;

      const { data: workspace } = await supabaseBrowserClient
        .from("workspace_members")
        .select("workspace_id")
        .eq("user_id", user.id)
        .limit(1)
        .single();

      if (!workspace) return;

      const wsId = workspace.workspace_id;
      setWorkspaceId(wsId);

      // Check onboarding state
      const res = await fetch("/api/studio/onboarding", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setCompletedSteps(data.data?.completed_steps || []);
        }
      }

      // Check actual completion status
      await checkStepCompletion(wsId, session.access_token);
    } catch (error) {
      console.error("Error loading onboarding state:", error);
    } finally {
      setLoading(false);
    }
  };

  const checkStepCompletion = async (wsId: string, token: string) => {
    const steps: OnboardingStep[] = [];

    // Check connect_accounts
    const accountsRes = await fetch("/api/studio/social/accounts", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (accountsRes.ok) {
      const accountsData = await accountsRes.json();
      if (accountsData.ok && accountsData.data?.accounts?.length > 0) {
        // Check if at least one account is connected (status !== "disconnected")
        const connectedAccounts = accountsData.data.accounts.filter(
          (acc: any) => acc.status !== "disconnected"
        );
        if (connectedAccounts.length > 0) {
          steps.push("connect_accounts");
        }
      }
    }

    // Check brand_profile
    const brandRes = await fetch("/api/studio/brand-profile", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (brandRes.ok) {
      const brandData = await brandRes.json();
      if (brandData.ok && brandData.data) {
        steps.push("brand_profile");
      }
    }

    // Check first_plan (check if any posts exist)
    const postsRes = await fetch("/api/studio/posts?limit=1", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (postsRes.ok) {
      const postsData = await postsRes.json();
      if (postsData.ok && postsData.data?.posts?.length > 0) {
        steps.push("first_plan");
      }
    }

    setCompletedSteps(steps);

    // Mark steps as completed
    for (const step of steps) {
      await markStepComplete(step, token);
    }
  };

  const markStepComplete = async (step: OnboardingStep, token: string, skipped: boolean = false) => {
    try {
      await fetch("/api/studio/onboarding/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ step, skipped }),
      });
      // Reload state after marking complete
      await loadOnboardingState();
    } catch (error) {
      console.error("Error marking step complete:", error);
    }
  };

  const handleSkipStep = async (step: OnboardingStep) => {
    const { data: { session } } = await supabaseBrowserClient.auth.getSession();
    if (!session?.access_token) return;
    await markStepComplete(step, session.access_token, true);
  };

  const handleConnectAccounts = () => {
    router.push("/studio/settings/social-accounts");
  };

  const handleStepClick = (step: OnboardingStep) => {
    switch (step) {
      case "connect_accounts":
        router.push("/studio/settings/social-accounts");
        break;
      case "brand_profile":
        router.push("/studio/settings");
        break;
      case "first_plan":
        router.push("/studio/calendar?action=generate-plan");
        break;
      case "review":
        router.push("/studio/overview");
        break;
    }
  };

  const handleComplete = async () => {
    if (!workspaceId) return;

    const { data: { session } } = await supabaseBrowserClient.auth.getSession();
    if (!session?.access_token) return;

    await markStepComplete("review", session.access_token);
    router.push("/studio/overview");
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-center h-96">
          <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
        </div>
      </div>
    );
  }

  // Check if required step is complete
  const requiredComplete = REQUIRED_STEPS.every((step) => completedSteps.includes(step));
  const allComplete = STEPS.every((step) => completedSteps.includes(step.id));

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Welcome to Studio
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Connect at least one social account to get started. Other steps are optional.
        </p>
      </div>

      <div className="space-y-4">
        {STEPS.map((step, index) => {
          const Icon = step.icon;
          const isCompleted = completedSteps.includes(step.id);
          const isRequired = step.isRequired;
          // Required steps are always active; optional steps are active once required step is done
          const isActive = isRequired || requiredComplete;

          return (
            <div
              key={step.id}
              className={`p-6 rounded-lg border-2 transition-all ${
                isCompleted
                  ? "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-900/20"
                  : isActive
                  ? isRequired
                    ? "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-900/30"
                    : "border-violet-200 bg-violet-50 dark:border-violet-800 dark:bg-violet-900/20"
                  : "border-slate-200 bg-slate-50 dark:border-slate-700 dark:bg-slate-800/50 opacity-50"
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-6 h-6 text-green-600 dark:text-green-400" />
                  ) : (
                    <Circle className="w-6 h-6 text-slate-400" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3 mb-2">
                    <Icon className="w-5 h-5 text-violet-500" />
                    <h3 className="text-lg font-semibold">{step.title}</h3>
                    {isRequired && (
                      <span className="text-xs px-2 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300 font-medium">
                        Required
                      </span>
                    )}
                    {!isRequired && (
                      <span className="text-xs px-2 py-0.5 rounded bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400 font-medium">
                        Optional
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-600 dark:text-slate-400 mb-3">
                    {step.description}
                  </p>
                  {isActive && !isCompleted && (
                    <div className="flex items-center gap-3">
                      {isRequired ? (
                        <button
                          onClick={handleConnectAccounts}
                          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm"
                        >
                          Connect Accounts
                        </button>
                      ) : (
                        <>
                          <button
                            onClick={() => handleStepClick(step.id)}
                            className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors font-medium text-sm"
                          >
                            Get Started
                          </button>
                          <button
                            onClick={() => handleSkipStep(step.id)}
                            className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium text-sm text-slate-700 dark:text-slate-300"
                          >
                            Skip
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {requiredComplete && (
        <div className="mt-8 p-6 rounded-lg bg-violet-50 dark:bg-violet-900/20 border border-violet-200 dark:border-violet-800">
          <h3 className="text-lg font-semibold mb-2">🎉 You&apos;re ready to start!</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {allComplete
              ? "You've completed all onboarding steps. Start creating amazing content!"
              : "You've connected your accounts. You can skip the optional steps and start using Studio now, or complete them later."}
          </p>
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/studio/overview")}
              className="px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 transition-colors font-medium"
            >
              Go to Overview
            </button>
            {!allComplete && (
              <button
                onClick={async () => {
                  // Mark remaining optional steps as skipped
                  const { data: { session } } = await supabaseBrowserClient.auth.getSession();
                  if (session?.access_token) {
                    for (const step of OPTIONAL_STEPS) {
                      if (!completedSteps.includes(step)) {
                        await markStepComplete(step, session.access_token, true);
                      }
                    }
                  }
                  router.push("/studio/overview");
                }}
                className="px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors font-medium text-slate-700 dark:text-slate-300"
              >
                Skip Remaining Steps
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}


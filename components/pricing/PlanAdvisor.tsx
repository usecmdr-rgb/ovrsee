"use client";

import { useState } from "react";
import { Sparkles, Loader2, CheckCircle2, ArrowRight, Users, Phone, Mail, TrendingUp, DollarSign, Image, BarChart } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAppState } from "@/context/AppStateContext";
import { formatPrice } from "@/lib/currency";
import { TIERS } from "@/lib/pricing";
import type { TierId } from "@/lib/pricing";
import { useBillingInterval } from "@/components/pricing/BillingIntervalContext";
import { useStartCheckout } from "@/components/pricing/useStartCheckout";
import type { CorePlanCode } from "@/lib/pricingConfig";

interface PlanSeatSuggestion {
  tier: TierId;
  count: number;
}

interface RecommendationResponse {
  ok: boolean;
  suggestedSeats: PlanSeatSuggestion[];
  reasoning: string;
  altOptions: {
    label: string;
    suggestedSeats: PlanSeatSuggestion[];
    pros: string[];
    cons: string[];
  }[];
  pricing: {
    breakdown: any;
    explanation: string;
  };
  currentPricing?: {
    breakdown: any;
    explanation: string;
  };
}

interface PlanAdvisorProps {
  mode?: "anonymous" | "workspace";
  onRecommendationSelect?: (seats: PlanSeatSuggestion[]) => void;
}

export default function PlanAdvisor({ mode = "anonymous", onRecommendationSelect }: PlanAdvisorProps) {
  const router = useRouter();
  const { language, isAuthenticated } = useAppState();
  const [loading, setLoading] = useState(false);
  const [recommendation, setRecommendation] = useState<RecommendationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Anonymous mode state
  const [teamSize, setTeamSize] = useState(1);
  const [callVolume, setCallVolume] = useState<"low" | "medium" | "high">("low");
  const [emailVolume, setEmailVolume] = useState<"low" | "medium" | "high">("low");
  const [mediaVolume, setMediaVolume] = useState<"low" | "medium" | "high">("low");
  const [analyticsVolume, setAnalyticsVolume] = useState<"low" | "medium" | "high">("low");
  const [needsVoice, setNeedsVoice] = useState(false);
  const [needsInsights, setNeedsInsights] = useState(false);
  const [budgetSensitivity, setBudgetSensitivity] = useState<"low" | "medium" | "high">("medium");
  const { billingInterval } = useBillingInterval();
  const { startCheckout } = useStartCheckout();

  const handleGetRecommendation = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/pricing/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "anonymous"
            ? {
                mode: "anonymous",
                teamSize,
                callVolume,
                emailVolume,
                mediaVolume,
                analyticsVolume,
                needsVoice,
                needsInsights,
                budgetSensitivity,
              }
            : {
                mode: "workspace",
              }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to get recommendation");
      }

      setRecommendation(data);
    } catch (err: any) {
      setError(err.message || "Failed to get recommendation");
    } finally {
      setLoading(false);
    }
  };

  const handleStartWithConfiguration = (seats: PlanSeatSuggestion[]) => {
    if (onRecommendationSelect) {
      onRecommendationSelect(seats);
    } else {
      // Navigate to pricing page with query params containing recommendation
      const params = new URLSearchParams();
      seats.forEach((seat, idx) => {
        params.append(`tier_${idx}`, seat.tier);
        params.append(`count_${idx}`, seat.count.toString());
      });
      router.push(`/pricing/team?${params.toString()}`);
    }
  };

  const getRecommendedPlanCode = (seats: PlanSeatSuggestion[]): CorePlanCode => {
    // Choose the highest tier present in the recommendation and map to CorePlanCode
    if (seats.some((s) => s.tier === "elite" && s.count > 0)) {
      return "executive";
    }
    if (seats.some((s) => s.tier === "advanced" && s.count > 0)) {
      return "professional";
    }
    return "essentials";
  };

  const handleCheckoutRecommended = async (seats: PlanSeatSuggestion[]) => {
    const planCode = getRecommendedPlanCode(seats);
    try {
      await startCheckout(planCode, billingInterval);
    } catch (err) {
      console.error("Failed to start checkout from PlanAdvisor:", err);
    }
  };

  if (mode === "workspace" && !isAuthenticated) {
    return null;
  }

  if (recommendation) {
    return (
      <Card className="border-2 border-emerald-500/20 bg-emerald-50/50 dark:bg-emerald-950/20">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            Plan Recommendation
          </CardTitle>
          <CardDescription>{recommendation.reasoning}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Recommendation */}
          <div className="rounded-xl border border-emerald-200 bg-white p-4 dark:border-emerald-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold mb-3 text-emerald-700 dark:text-emerald-300">
              Recommended Configuration
            </h3>
            <div className="space-y-2 mb-4">
              {recommendation.suggestedSeats.map((seat, idx) => (
                <div key={idx} className="flex justify-between items-center text-sm">
                  <span className="text-slate-600 dark:text-slate-400">
                    {seat.count} × {TIERS[seat.tier].name}
                  </span>
                  <span className="font-semibold">
                    {formatPrice(seat.count * TIERS[seat.tier].priceMonthly, language)}
                    <span className="text-xs text-slate-500 dark:text-slate-400">/mo</span>
                  </span>
                </div>
              ))}
              <div className="pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(recommendation.pricing.breakdown.finalTotal, language)}/mo</span>
                </div>
              </div>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-4">
              {recommendation.pricing.explanation}
            </p>
            <div className="flex justify-center gap-3">
              <Button
                onClick={() => handleCheckoutRecommended(recommendation.suggestedSeats)}
                className="flex items-center"
              >
                Start subscription
                <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
              <Button
                onClick={() => handleStartWithConfiguration(recommendation.suggestedSeats)}
                variant="secondary"
                className="flex items-center"
              >
                Configure team seats
              </Button>
            </div>
          </div>

          {/* Alternative Options */}
          {recommendation.altOptions.length > 0 && (
            <div className="space-y-3">
              <h4 className="text-sm font-semibold">Alternative Options</h4>
              {recommendation.altOptions.map((option, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div className="flex justify-between items-start mb-2">
                    <h5 className="text-sm font-semibold">{option.label}</h5>
                    <span className="text-xs text-slate-500">
                      {formatPrice(
                        option.suggestedSeats.reduce(
                          (sum, s) => sum + s.count * TIERS[s.tier].priceMonthly,
                          0
                        ),
                        language
                      )}
                      /mo
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <p className="font-medium text-emerald-700 dark:text-emerald-300 mb-1">Pros</p>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                        {option.pros.map((pro, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <CheckCircle2 className="h-3 w-3 mt-0.5 text-emerald-600 flex-shrink-0" />
                            <span>{pro}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="font-medium text-amber-700 dark:text-amber-300 mb-1">Considerations</p>
                      <ul className="space-y-1 text-slate-600 dark:text-slate-400">
                        {option.cons.map((con, i) => (
                          <li key={i} className="flex items-start gap-1">
                            <span className="text-amber-600">•</span>
                            <span>{con}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  <div className="flex justify-center mt-3">
                    <Button
                      onClick={() => handleStartWithConfiguration(option.suggestedSeats)}
                      variant="secondary"
                      className="flex items-center"
                    >
                      Choose this option
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-center">
            <Button
              onClick={() => setRecommendation(null)}
              variant="secondary"
              className="flex items-center"
            >
              Start over
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Questionnaire (anonymous mode) or Analyze button (workspace mode)
  return (
    <Card className="w-full h-full flex flex-col">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-4 w-4" />
          Plan Advisor
        </CardTitle>
        <CardDescription className="text-xs">
          {mode === "anonymous"
            ? "Answer a few questions and we'll recommend the perfect plan for your team."
            : "Analyze your usage patterns and get personalized plan recommendations."}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0 flex-1 flex flex-col">
        {mode === "anonymous" ? (
          <div className="space-y-3 flex-1 flex flex-col justify-between">
            {/* Team Size */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">
                <Users className="h-3 w-3 inline mr-1" />
                Team Size
              </label>
              <input
                type="range"
                min="1"
                max="10"
                value={teamSize}
                onChange={(e) => setTeamSize(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-slate-500 mt-1">
                <span>1</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{teamSize} people</span>
                <span>10+</span>
              </div>
              <div className="mt-1.5 flex justify-center">
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={teamSize}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setTeamSize(Math.max(1, Math.min(100, value)));
                  }}
                  className="w-20 px-2 py-1.5 text-sm text-center border border-slate-300 rounded-lg dark:border-slate-700 dark:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
                  placeholder="Enter number"
                />
              </div>
            </div>

            {/* Call Volume */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">
                <Phone className="h-3 w-3 inline mr-1" />
                Call Volume
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((vol) => (
                  <button
                    key={vol}
                    onClick={() => setCallVolume(vol)}
                    className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                      callVolume === vol
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {vol}
                  </button>
                ))}
              </div>
            </div>

            {/* Email Volume */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">
                <Mail className="h-3 w-3 inline mr-1" />
                Email Volume
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((vol) => (
                  <button
                    key={vol}
                    onClick={() => setEmailVolume(vol)}
                    className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                      emailVolume === vol
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {vol}
                  </button>
                ))}
              </div>
            </div>

            {/* Media Generation Volume */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image className="h-3 w-3 inline mr-1" aria-hidden="true" />
                Media Generation Volume
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((vol) => (
                  <button
                    key={vol}
                    onClick={() => setMediaVolume(vol)}
                    className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                      mediaVolume === vol
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {vol}
                  </button>
                ))}
              </div>
            </div>

            {/* Data Analytics Volume */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">
                <BarChart className="h-3 w-3 inline mr-1" />
                Data Analytics Volume
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((vol) => (
                  <button
                    key={vol}
                    onClick={() => setAnalyticsVolume(vol)}
                    className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                      analyticsVolume === vol
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {vol}
                  </button>
                ))}
              </div>
            </div>

            {/* Feature Needs */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">Feature Needs</label>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsVoice}
                    onChange={(e) => setNeedsVoice(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-xs">I need AI voice answering (Aloha)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={needsInsights}
                    onChange={(e) => setNeedsInsights(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-xs">I care about deep analytics & insights</span>
                </label>
              </div>
            </div>

            {/* Budget Sensitivity */}
            <div className="flex-1">
              <label className="block text-xs font-medium mb-1.5">
                <DollarSign className="h-3 w-3 inline mr-1" />
                Budget Sensitivity
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(["low", "medium", "high"] as const).map((sens) => (
                  <button
                    key={sens}
                    onClick={() => setBudgetSensitivity(sens)}
                    className={`rounded-lg border px-2 py-1.5 text-xs capitalize ${
                      budgetSensitivity === sens
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    {sens}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}

            <div className="flex justify-center items-center gap-2 mt-auto pt-1">
              <Link href="/pricing/team">
                <Button
                  variant="secondary"
                  className="px-6 py-1.5 text-sm flex items-center h-8"
                >
                  Configure Team
                </Button>
              </Link>
              <Button
                onClick={handleGetRecommendation}
                disabled={loading}
                className="px-6 py-1.5 text-sm flex items-center h-8"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Analyzing...
                  </>
                ) : (
                  <>
                    <ArrowRight className="h-4 w-4 mr-2" />
                    Get Recommendation
                  </>
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              We&apos;ll analyze your current team configuration, usage patterns, and suggest optimizations.
            </p>
            {error && (
              <div className="rounded-lg border border-red-200 bg-red-50 p-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
                {error}
              </div>
            )}
            <Button
              onClick={handleGetRecommendation}
              disabled={loading}
              className="w-full py-1.5 text-sm h-8"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Analyzing usage...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Analyze my usage and recommend a plan
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


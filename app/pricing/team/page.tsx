"use client";

import { useState, useMemo, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Trash2, Plus, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/hooks/useTranslation";
import { formatPrice } from "@/lib/currency";
import { useAppState } from "@/context/AppStateContext";
import {
  TierId,
  TIERS,
  SeatSelection,
  calculateTeamPricing,
  getTeamDiscountPercent,
} from "@/lib/pricing";
import { getPlanAmount } from "@/lib/pricingConfig";
import { calculateTax, formatTaxRate, getTaxDisclaimer, DEFAULT_TAX_RATE } from "@/lib/tax";

/**
 * Seat configuration for team subscriptions
 * Each seat can have an optional name and email for invite creation
 * Email is optional - seats can be assigned later from Team settings
 */
interface SeatRow {
  id: string;
  tier: TierId;
  name?: string;
  email?: string; // Optional - if provided, will be used to send activation invites after checkout
}

function TeamPricingContent() {
  const { language } = useAppState();
  const t = useTranslation();
  const searchParams = useSearchParams();
  
  // Get billing interval from URL params or default to monthly
  const billingIntervalFromUrl = searchParams.get("billingInterval") as "monthly" | "yearly" | null;
  const [billingInterval, setBillingInterval] = useState<"monthly" | "yearly">(
    billingIntervalFromUrl === "yearly" ? "yearly" : "monthly"
  );
  
  // Initialize seats from URL params if available (from recommendation)
  const initialSeats = useMemo(() => {
    const seats: SeatRow[] = [];
    let idx = 0;
    
    while (true) {
      const tierParam = searchParams.get(`tier_${idx}`);
      const count = searchParams.get(`count_${idx}`);
      
      if (!tierParam || !count) break;
      
      const countNum = parseInt(count, 10);
      if (countNum > 0 && ["basic", "advanced", "elite"].includes(tierParam)) {
        const tier = tierParam as TierId;
        // Create individual seats for each count
        for (let i = 0; i < countNum; i++) {
          seats.push({
            id: `${idx}_${i}_${Date.now()}_${Math.random()}`,
            tier: tier,
          });
        }
      }
      idx++;
    }
    
    return seats.length > 0 ? seats : [{ id: "1", tier: "basic" as TierId }];
  }, [searchParams]);
  
  const [seats, setSeats] = useState<SeatRow[]>(initialSeats);
  
  // Update billing interval when URL param changes
  useEffect(() => {
    const urlInterval = searchParams.get("billingInterval") as "monthly" | "yearly" | null;
    if (urlInterval === "yearly" || urlInterval === "monthly") {
      setBillingInterval(urlInterval);
    }
  }, [searchParams]);

  // Convert seats to SeatSelection format for calculation
  const seatSelections = useMemo((): SeatSelection[] => {
    const grouped: Record<TierId, number> = {
      basic: 0,
      advanced: 0,
      elite: 0,
    };

    seats.forEach((seat) => {
      grouped[seat.tier]++;
    });

    return Object.entries(grouped)
      .filter(([_, count]) => count > 0)
      .map(([tier, count]) => ({
        tier: tier as TierId,
        count,
      }));
  }, [seats]);

  // Calculate pricing breakdown with billing interval
  const pricing = useMemo(() => {
    return calculateTeamPricing(seatSelections, billingInterval);
  }, [seatSelections, billingInterval]);
  
  // Calculate tax (for display purposes - actual tax calculated by Stripe)
  const taxAmount = useMemo(() => {
    return calculateTax(pricing.finalTotal, DEFAULT_TAX_RATE);
  }, [pricing.finalTotal]);
  
  const totalWithTax = useMemo(() => {
    return pricing.finalTotal + taxAmount;
  }, [pricing.finalTotal, taxAmount]);

  const addSeat = () => {
    const newId = `${Date.now()}`;
    setSeats([...seats, { id: newId, tier: "basic" }]);
  };

  const removeSeat = (id: string) => {
    setSeats(seats.filter((s) => s.id !== id));
  };

  const updateSeatTier = (id: string, tier: TierId) => {
    setSeats(seats.map((s) => (s.id === id ? { ...s, tier } : s)));
  };

  const updateSeatName = (id: string, name: string) => {
    setSeats(seats.map((s) => (s.id === id ? { ...s, name } : s)));
  };

  const updateSeatEmail = (id: string, email: string) => {
    setSeats(seats.map((s) => (s.id === id ? { ...s, email } : s)));
  };
  
  // Update seats when URL params change
  useEffect(() => {
    setSeats(initialSeats);
  }, [initialSeats]);

  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-10 space-y-3">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {t("teamPricingTitle")}
        </h1>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          {t("teamPricingDescription")}
        </p>
        {pricing.totalSeats > 0 && (
          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary">
            <span className="text-sm font-medium">
              {pricing.totalSeats} {pricing.totalSeats === 1 ? t("teamPricingUserConfigured") : t("teamPricingUsersConfigured")}
            </span>
          </div>
        )}
        
        {/* Billing Interval Toggle */}
        <div className="flex items-center gap-3 justify-center mt-4">
          <button
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              billingInterval === "monthly"
                ? "bg-black text-white border-black dark:bg-white dark:text-black"
                : "bg-white text-black border-gray-300 dark:bg-slate-800 dark:text-white dark:border-slate-700"
            }`}
            onClick={() => setBillingInterval("monthly")}
          >
            Monthly
          </button>
          <button
            className={`px-4 py-2 rounded-lg border text-sm font-medium transition-colors ${
              billingInterval === "yearly"
                ? "bg-black text-white border-black dark:bg-white dark:text-black"
                : "bg-white text-black border-gray-300 dark:bg-slate-800 dark:text-white dark:border-slate-700"
            }`}
            onClick={() => setBillingInterval("yearly")}
          >
            Yearly
          </button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Seat Configurator */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>{t("teamPricingConfigureSeats")}</CardTitle>
              <p className="text-sm text-muted-foreground mt-2">
                {t("teamPricingSeatsDescription")}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Seat Rows */}
              {seats.map((seat, index) => (
                <div
                  key={seat.id}
                  className="flex flex-col gap-3 p-4 border rounded-lg bg-background/40"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-medium text-muted-foreground">
                      {t("teamPricingUser")} {index + 1}
                    </span>
                    <span className="text-xs px-2 py-0.5 rounded bg-primary/10 text-primary">
                      {TIERS[seat.tier].name}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {t("teamPricingName")}
                      </label>
                      <input
                        type="text"
                        placeholder={t("teamPricingNamePlaceholder")}
                        value={seat.name || ""}
                        onChange={(e) => updateSeatName(seat.id, e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      />
                    </div>
                    <div>
                      <label className="text-xs text-muted-foreground mb-1 block flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {t("teamPricingEmail")}
                      </label>
                      <input
                        type="email"
                        placeholder={t("teamPricingEmailPlaceholder") || "user@example.com"}
                        value={seat.email || ""}
                        onChange={(e) => updateSeatEmail(seat.id, e.target.value)}
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Optional - leave blank to assign later
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <label className="text-xs text-muted-foreground mb-1 block">
                        {t("teamPricingTier")}
                      </label>
                      <select
                        value={seat.tier}
                        onChange={(e) =>
                          updateSeatTier(seat.id, e.target.value as TierId)
                        }
                        className="w-full px-3 py-2 text-sm border rounded-md bg-background"
                      >
                        <option value="basic">
                          {TIERS.basic.name} (
                          {(() => {
                            const tierToPlanCode: Record<TierId, "essentials" | "professional" | "executive"> = {
                              basic: "essentials",
                              advanced: "professional",
                              elite: "executive",
                            };
                            const amount = getPlanAmount(tierToPlanCode.basic, billingInterval);
                            const period = billingInterval === "yearly" ? "/yr" : "/mo";
                            return formatPrice(amount / 100, language) + period;
                          })()})
                        </option>
                        <option value="advanced">
                          {TIERS.advanced.name} (
                          {(() => {
                            const tierToPlanCode: Record<TierId, "essentials" | "professional" | "executive"> = {
                              basic: "essentials",
                              advanced: "professional",
                              elite: "executive",
                            };
                            const amount = getPlanAmount(tierToPlanCode.advanced, billingInterval);
                            const period = billingInterval === "yearly" ? "/yr" : "/mo";
                            return formatPrice(amount / 100, language) + period;
                          })()})
                        </option>
                        <option value="elite">
                          {TIERS.elite.name} (
                          {(() => {
                            const tierToPlanCode: Record<TierId, "essentials" | "professional" | "executive"> = {
                              basic: "essentials",
                              advanced: "professional",
                              elite: "executive",
                            };
                            const amount = getPlanAmount(tierToPlanCode.elite, billingInterval);
                            const period = billingInterval === "yearly" ? "/yr" : "/mo";
                            return formatPrice(amount / 100, language) + period;
                          })()})
                        </option>
                      </select>
                    </div>
                    <div className="flex items-end ml-3">
                      <button
                        onClick={() => removeSeat(seat.id)}
                        className="px-3 py-2 text-destructive hover:bg-destructive/10 rounded-md transition-colors"
                        aria-label="Remove seat"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}

              {/* Add Seat Button */}
              <Button
                onClick={addSeat}
                variant="secondary"
                className="w-full"
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("teamPricingAddUser")}
              </Button>
              
              {/* Email Invitations Section */}
              {seats.some(seat => seat.email) && (
                <div className="mt-6 p-4 border border-primary/20 rounded-lg bg-primary/5">
                  <div className="flex items-start gap-3">
                    <Mail className="h-5 w-5 text-primary mt-0.5" />
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold mb-1">
                        {t("teamPricingEmailInvitations")}
                      </h3>
                      <p className="text-xs text-muted-foreground mb-3">
                        {t("teamPricingEmailInvitationsDescription")}
                      </p>
                      <div className="text-xs text-muted-foreground mb-3">
                        <p className="font-medium mb-1">{t("teamPricingReadyToSend")}</p>
                        <ul className="list-disc list-inside space-y-1">
                          {seats.filter(seat => seat.email).map((seat, idx) => (
                            <li key={seat.id}>
                              {seat.name || `${t("teamPricingUser")} ${idx + 1}`} ({seat.email}) - {TIERS[seat.tier].name}
                            </li>
                          ))}
                        </ul>
                      </div>
                      <Button
                        onClick={() => {
                          // TODO: Implement email invitation API
                          // This will send invitations to all users with emails
                          // Support email system will handle the actual invitation sending
                          alert(`Email invitations will be sent to ${seats.filter(s => s.email).length} user(s). This feature will be handled by our support team.`);
                        }}
                        className="w-full"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        {t("teamPricingSendInvitations")} ({seats.filter(s => s.email).length})
                      </Button>
                      <p className="text-xs text-muted-foreground mt-2 text-center">
                        {t("teamPricingInvitationsNote")}
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Pricing Summary */}
        <div className="lg:col-span-1">
          <Card className="sticky top-4">
            <CardHeader>
              <CardTitle>{t("teamPricingTeamSummary")}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Total Seats */}
              <div>
                <div className="text-sm text-muted-foreground">
                  {t("teamPricingTotalSeats")}
                </div>
                <div className="text-2xl font-semibold">
                  {pricing.totalSeats}
                </div>
              </div>

              {/* Breakdown by Tier */}
              {pricing.totalSeats > 0 && (
                <div className="space-y-2 pt-2 border-t">
                  <div className="text-sm font-medium">
                    {t("teamPricingBreakdownByTier")}
                  </div>
                  {Object.entries(pricing.perTier).map(([tierId, tierData]) => {
                    if (tierData.count === 0) return null;
                    return (
                      <div
                        key={tierId}
                        className="flex justify-between text-sm"
                      >
                        <span>
                          {tierData.count} × {TIERS[tierId as TierId].name}
                        </span>
                        <span className="font-medium">
                          {formatPrice(tierData.subtotal, language)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Pricing Details */}
              {pricing.totalSeats > 0 && (
                <div className="space-y-3 pt-4 border-t">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("teamPricingListPrice")}
                    </span>
                    <span>
                      {formatPrice(pricing.listSubtotal, language)}
                      <span className="text-xs text-muted-foreground ml-1">
                        {billingInterval === "yearly" ? "/yr" : "/mo"}
                      </span>
                    </span>
                  </div>

                  {pricing.discountPercent > 0 && (
                    <>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("teamPricingTeamDiscount")}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          {getTeamDiscountPercent(pricing.totalSeats) * 100}%
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          {t("teamPricingDiscount")}
                        </span>
                        <span className="text-emerald-600 dark:text-emerald-400">
                          -{formatPrice(pricing.discountAmount, language)}
                          <span className="text-xs ml-1">
                            {billingInterval === "yearly" ? "/yr" : "/mo"}
                          </span>
                        </span>
                      </div>
                    </>
                  )}

                  {/* Tax Line - Show even if 0% for transparency */}
                  <div className="flex justify-between text-sm pt-2 border-t">
                    <span className="text-muted-foreground">
                      Sales Tax {DEFAULT_TAX_RATE > 0 ? `(${formatTaxRate(DEFAULT_TAX_RATE)})` : "(calculated at checkout)"}
                    </span>
                    <span className="text-muted-foreground">
                      {DEFAULT_TAX_RATE > 0 ? formatPrice(taxAmount, language) : "—"}
                    </span>
                  </div>
                  
                  <div className="flex justify-between pt-2 border-t font-semibold text-lg">
                    <span>{t("teamPricingTotal")}</span>
                    <span>
                      {formatPrice(DEFAULT_TAX_RATE > 0 ? totalWithTax : pricing.finalTotal, language)}
                      <span className="text-sm font-normal text-muted-foreground ml-1">
                        {billingInterval === "yearly" ? "/yr" : "/mo"}
                      </span>
                    </span>
                  </div>
                  
                  {DEFAULT_TAX_RATE === 0 && (
                    <p className="text-xs text-muted-foreground mt-2">
                      {getTaxDisclaimer()}
                    </p>
                  )}
                </div>
              )}

              {/* Discount Info */}
              {pricing.totalSeats > 0 && pricing.discountPercent === 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    {t("teamPricingDiscountInfo")}
                  </p>
                </div>
              )}

              {/* Empty State */}
              {pricing.totalSeats === 0 && (
                <div className="text-sm text-muted-foreground text-center py-4">
                  {t("teamPricingAddSeatsToSee")}
                </div>
              )}

              {/* Start Subscription Button */}
              {pricing.totalSeats > 0 && (
                <div className="pt-4 border-t">
                  <p className="text-xs text-muted-foreground mb-3">
                    You can leave emails blank and assign seats later from your Team settings.
                  </p>
                  <Button
                    onClick={async () => {
                      // Get the highest tier for planCode (for now, use the most common tier)
                      const tierCounts = seatSelections.reduce((acc, s) => {
                        acc[s.tier] = (acc[s.tier] || 0) + s.count;
                        return acc;
                      }, {} as Record<TierId, number>);
                      
                      const highestTier = (Object.entries(tierCounts).sort((a, b) => {
                        const tierOrder = { elite: 3, advanced: 2, basic: 1 };
                        return tierOrder[b[0] as TierId] - tierOrder[a[0] as TierId];
                      })[0]?.[0] || "basic") as TierId;
                      
                      const planCodeMap: Record<TierId, "essentials" | "professional" | "executive"> = {
                        basic: "essentials",
                        advanced: "professional",
                        elite: "executive",
                      };
                      
                      const planCode = planCodeMap[highestTier];
                      const totalSeatCount = pricing.totalSeats;
                      
                      // Prepare seat data with emails
                      const seatData = seats.map(seat => ({
                        tier: seat.tier,
                        email: seat.email || undefined,
                        name: seat.name || undefined,
                      }));
                      
                      try {
                        const response = await fetch("/api/stripe/checkout", {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({
                            planCode,
                            seatCount: totalSeatCount,
                            billingInterval, // Use selected billing interval
                            seats: seatData, // Include seat emails and names
                          }),
                        });
                        
                        const data = await response.json();
                        
                        if (!response.ok) {
                          throw new Error(data.error || "Failed to create checkout session");
                        }
                        
                        if (data.url) {
                          window.location.href = data.url;
                        }
                      } catch (err: any) {
                        alert(err.message || "Failed to start checkout");
                      }
                    }}
                    className="w-full"
                  >
                    Start Subscription
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function TeamPricingLoading() {
  const t = useTranslation();
  return (
    <div className="w-full max-w-6xl mx-auto px-4 py-16">
      <div className="text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-slate-300 border-t-slate-900"></div>
        <p className="mt-4 text-sm text-slate-500">{t("teamPricingLoading")}</p>
      </div>
    </div>
  );
}

export default function TeamPricingPage() {
  return (
    <Suspense fallback={<TeamPricingLoading />}>
      <TeamPricingContent />
    </Suspense>
  );
}


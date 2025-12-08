"use client";

import { useState, useEffect } from "react";
import { Users, Plus, Trash2, Mail, Link2, Copy, CheckCircle2, XCircle, Loader2, Info, AlertTriangle } from "lucide-react";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Modal from "@/components/ui/Modal";
import { formatPrice } from "@/lib/currency";
import { useAppState } from "@/context/AppStateContext";
import { useSupabase } from "@/components/SupabaseProvider";
import { TIERS, type TierId, type PricingBreakdown } from "@/lib/pricing";
import type { SeatSelection } from "@/lib/pricing";
import { runGuardrailChecks, deriveFeatureUsage, detectFeatureUsage, type GuardrailContext } from "@/lib/subscription/guardrails";

/**
 * Seat model for existing workspace seats
 * This represents seats that have already been created/activated
 * For configuring new seats before checkout, see app/pricing/team/page.tsx SeatRow interface
 */
interface Seat {
  id: string;
  email: string;
  tier: TierId;
  status: "active" | "pending" | "removed";
  userName?: string | null;
  isOwner: boolean;
  userId?: string | null;
}

interface Invite {
  id: string;
  email?: string | null;
  tier: TierId;
  inviteUrl: string;
  expiresIn: number;
}

export default function TeamSeatsSection() {
  const { language, isAuthenticated } = useAppState();
  const { supabase } = useSupabase();
  const [seats, setSeats] = useState<Seat[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [pricing, setPricing] = useState<PricingBreakdown | null>(null);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [adding, setAdding] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);

  // Add member form state
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberTier, setNewMemberTier] = useState<TierId>("basic");
  const [inviteMethod, setInviteMethod] = useState<"email" | "link">("link");

  // Guardrail modal state
  const [guardrailModal, setGuardrailModal] = useState<{
    open: boolean;
    blockingIssues: string[];
    warnings: string[];
    priceChange?: { current: number; proposed: number; difference: number; percentChange: number };
    featuresLost: string[];
    onConfirm: () => Promise<void>;
  } | null>(null);

  useEffect(() => {
    // Only fetch if authenticated
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    
    fetchSeats();
    fetchInvites();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  const fetchSeats = async () => {
    if (!isAuthenticated) return;
    
    try {
      setLoading(true);
      setError(null);

      const response = await fetch("/api/team/seats");
      
      if (response.status === 401) {
        // Not authenticated, don't retry
        setLoading(false);
        return;
      }
      
      const result = await response.json();

      if (result.ok) {
        setSeats(result.data.seats || []);
        setPricing(result.data.pricing || null);
      } else {
        setError(result.error || "Failed to fetch seats");
      }
    } catch (err: any) {
      // Don't show error for auth failures
      if (err.message?.includes("401") || err.message?.includes("Unauthorized")) {
        setLoading(false);
        return;
      }
      setError(err.message || "Failed to fetch seats");
    } finally {
      setLoading(false);
    }
  };

  const fetchInvites = async () => {
    if (!isAuthenticated) return;
    
    try {
      const response = await fetch("/api/team/invites");
      
      if (response.status === 401) {
        // Not authenticated, don't retry
        return;
      }
      
      const result = await response.json();

      if (result.ok) {
        setInvites(result.data || []);
      }
    } catch (err) {
      // Silently fail for invites - don't log 401 errors
      if (!(err as any)?.message?.includes("401") && !(err as any)?.message?.includes("Unauthorized")) {
        console.error("Failed to fetch invites:", err);
      }
    }
  };

  const handleAddMember = async () => {
    if (!newMemberTier) return;

    setAdding(true);
    setError(null);
    try {
      const response = await fetch("/api/team/seats", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: newMemberEmail || undefined,
          tier: newMemberTier,
          method: inviteMethod,
        }),
      });

      const result = await response.json();

      if (result.ok) {
        if (inviteMethod === "link" && result.data.invite?.inviteUrl) {
          setCopiedUrl(result.data.invite.inviteUrl);
        } else if (inviteMethod === "email" && newMemberEmail) {
          // Show success message
          setError(null);
          // You could add a toast here: toast.success(`Invite sent to ${newMemberEmail}`);
        }
        setNewMemberEmail("");
        setNewMemberTier("basic");
        setShowAddForm(false);
        await fetchSeats();
        await fetchInvites();
        // Refresh billing preview
        window.dispatchEvent(new Event("billing-preview-refresh"));
      } else {
        setError(result.error || "Failed to add member");
      }
    } catch (err: any) {
      setError(err.message || "Failed to add member");
    } finally {
      setAdding(false);
    }
  };

  const handleUpdateTier = async (seatId: string, newTier: TierId) => {
    setError(null);
    
    // Find the seat being updated
    const seatToUpdate = seats.find((s) => s.id === seatId);
    if (!seatToUpdate) return;

    // If tier is the same, no need to update
    if (seatToUpdate.tier === newTier) return;

    // Build current and proposed seat configurations
    const activeSeats = seats.filter((s) => s.status === "active" || s.status === "pending");
    
    const currentSeats: SeatSelection[] = activeSeats.reduce((acc: SeatSelection[], seat) => {
      const existing = acc.find((s) => s.tier === seat.tier);
      if (existing) {
        existing.count++;
      } else {
        acc.push({ tier: seat.tier, count: 1 });
      }
      return acc;
    }, []);

    const proposedSeats: SeatSelection[] = activeSeats
      .map((s) => (s.id === seatId ? { ...s, tier: newTier } : s))
      .reduce((acc: SeatSelection[], seat) => {
        const existing = acc.find((s) => s.tier === seat.tier);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ tier: seat.tier, count: 1 });
        }
        return acc;
      }, []);

    // Run guardrail checks
    const currentFeatures = deriveFeatureUsage(currentSeats);
    const usageFlags = detectFeatureUsage(currentSeats);
    const activeMemberCount = seats.filter((s) => s.status === "active").length;

    const guardrailContext: GuardrailContext = {
      currentSeats,
      proposedSeats,
      currentFeatures,
      usageFlags,
      activeMemberCount,
    };

    const guardrailResult = runGuardrailChecks(guardrailContext);

    // If there are blocking issues, show them and don't proceed
    if (guardrailResult.blockingIssues.length > 0) {
      setGuardrailModal({
        open: true,
        blockingIssues: guardrailResult.blockingIssues,
        warnings: guardrailResult.warnings,
        priceChange: guardrailResult.priceChange,
        featuresLost: guardrailResult.featuresLost,
        onConfirm: async () => {
          // This will never be called if there are blocking issues
          setGuardrailModal(null);
        },
      });
      return;
    }

    // If there are warnings, show confirmation modal
    if (guardrailResult.warnings.length > 0 || guardrailResult.featuresLost.length > 0) {
      setGuardrailModal({
        open: true,
        blockingIssues: [],
        warnings: guardrailResult.warnings,
        priceChange: guardrailResult.priceChange,
        featuresLost: guardrailResult.featuresLost,
        onConfirm: async () => {
          setGuardrailModal(null);
          await performTierUpdate(seatId, newTier);
        },
      });
      return;
    }

    // No issues, proceed directly
    await performTierUpdate(seatId, newTier);
  };

  const performTierUpdate = async (seatId: string, newTier: TierId) => {
    try {
      const response = await fetch(`/api/team/seats/${seatId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier: newTier }),
      });

      if (response.ok) {
        await fetchSeats();
        // Refresh billing preview
        window.dispatchEvent(new Event("billing-preview-refresh"));
      } else {
        const result = await response.json();
        setError(result.error || "Failed to update tier");
      }
    } catch (err: any) {
      setError(err.message || "Failed to update tier");
    }
  };

  const handleRemoveSeat = async (seatId: string) => {
    setError(null);

    // Find the seat being removed
    const seatToRemove = seats.find((s) => s.id === seatId);
    if (!seatToRemove) return;

    // Build current and proposed seat configurations
    const currentSeats: SeatSelection[] = seats
      .filter((s) => s.status === "active" || s.status === "pending")
      .reduce((acc: SeatSelection[], seat) => {
        const existing = acc.find((s) => s.tier === seat.tier);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ tier: seat.tier, count: 1 });
        }
        return acc;
      }, []);

    const proposedSeats: SeatSelection[] = seats
      .filter((s) => (s.status === "active" || s.status === "pending") && s.id !== seatId)
      .reduce((acc: SeatSelection[], seat) => {
        const existing = acc.find((s) => s.tier === seat.tier);
        if (existing) {
          existing.count++;
        } else {
          acc.push({ tier: seat.tier, count: 1 });
        }
        return acc;
      }, []);

    // Run guardrail checks
    const currentFeatures = deriveFeatureUsage(currentSeats);
    const usageFlags = detectFeatureUsage(currentSeats);
    const activeMemberCount = seats.filter((s) => s.status === "active").length;

    const guardrailContext: GuardrailContext = {
      currentSeats,
      proposedSeats,
      currentFeatures,
      usageFlags,
      activeMemberCount,
    };

    const guardrailResult = runGuardrailChecks(guardrailContext);

    // If there are blocking issues, show them and don't proceed
    if (guardrailResult.blockingIssues.length > 0) {
      setGuardrailModal({
        open: true,
        blockingIssues: guardrailResult.blockingIssues,
        warnings: guardrailResult.warnings,
        priceChange: guardrailResult.priceChange,
        featuresLost: guardrailResult.featuresLost,
        onConfirm: async () => {
          // This will never be called if there are blocking issues
          setGuardrailModal(null);
        },
      });
      return;
    }

    // If there are warnings, show confirmation modal
    if (guardrailResult.warnings.length > 0 || guardrailResult.featuresLost.length > 0) {
      setGuardrailModal({
        open: true,
        blockingIssues: [],
        warnings: guardrailResult.warnings,
        priceChange: guardrailResult.priceChange,
        featuresLost: guardrailResult.featuresLost,
        onConfirm: async () => {
          setGuardrailModal(null);
          await performSeatRemoval(seatId);
        },
      });
      return;
    }

    // No issues, proceed directly with confirmation
    if (confirm("Are you sure you want to remove this team member?")) {
      await performSeatRemoval(seatId);
    }
  };

  const performSeatRemoval = async (seatId: string) => {
    try {
      const response = await fetch(`/api/team/seats/${seatId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        await fetchSeats();
        // Refresh billing preview
        window.dispatchEvent(new Event("billing-preview-refresh"));
      } else {
        const result = await response.json();
        setError(result.error || "Failed to remove member");
      }
    } catch (err: any) {
      setError(err.message || "Failed to remove member");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedUrl(text);
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Team & Seats</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          Team & Seats
        </CardTitle>
        <CardDescription className="flex items-center gap-2">
          Manage who has access to OVRSEE and which tier each team member is on.
          <div className="group relative">
            <Info className="h-4 w-4 text-slate-400 cursor-help" />
            <div className="absolute left-0 bottom-full mb-2 hidden group-hover:block w-64 p-2 text-xs bg-slate-900 text-white rounded-lg shadow-lg z-10">
              Your Stripe subscription is automatically updated to match your team seats and tiers.
            </div>
          </div>
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Pricing Summary */}
        {pricing && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold mb-3">Current Team Pricing</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-400">Total Seats</span>
                <span className="font-semibold">{pricing.totalSeats}</span>
              </div>
              {Object.entries(pricing.perTier).map(([tier, data]) => {
                if (data.count === 0) return null;
                return (
                  <div key={tier} className="flex justify-between text-xs">
                    <span className="text-slate-500 dark:text-slate-500">
                      {data.count} × {TIERS[tier as TierId].name}
                    </span>
                    <span>{formatPrice(data.subtotal, language)}</span>
                  </div>
                );
              })}
              {/* Billing interval toggle (preview only, currently monthly pricing on backend) */}
              <div className="flex items-center justify-end mb-2 gap-2">
                <button
                  onClick={() => setBillingInterval('monthly')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    billingInterval === 'monthly'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Monthly
                </button>
                <button
                  onClick={() => setBillingInterval('yearly')}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    billingInterval === 'yearly'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted text-muted-foreground hover:bg-muted/80'
                  }`}
                >
                  Yearly – Save 1 Month
                </button>
              </div>
              <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                <div className="flex justify-between mb-1">
                  <span className="text-slate-600 dark:text-slate-400">List Price</span>
                  <span>{formatPrice(pricing.listSubtotal, language)}</span>
                </div>
                {pricing.discountPercent > 0 && (
                  <>
                    <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                      <span>Team Discount ({pricing.discountPercent * 100}%)</span>
                      <span>-{formatPrice(pricing.discountAmount, language)}</span>
                    </div>
                  </>
                )}
                <div className="flex justify-between font-semibold pt-2 border-t border-slate-200 dark:border-slate-700">
                  <span>Total</span>
                  <span>{formatPrice(pricing.finalTotal, language)}</span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  {billingInterval === 'yearly'
                    ? "per year (preview) • Each user is billed based on their tier • Backend pricing is still monthly until yearly team billing is enabled."
                    : "per month • Each user is billed based on their tier"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Add Member Form */}
        {showAddForm && (
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
            <h3 className="text-sm font-semibold mb-3">Add Team Member</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium mb-1">Email (optional)</label>
                <input
                  type="email"
                  value={newMemberEmail}
                  onChange={(e) => setNewMemberEmail(e.target.value)}
                  placeholder="user@example.com"
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                />
                <p className="text-xs text-slate-500 mt-1">
                  Leave blank to generate a link-only invite
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1">Tier</label>
                <select
                  value={newMemberTier}
                  onChange={(e) => setNewMemberTier(e.target.value as TierId)}
                  className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-800"
                >
                  {Object.values(TIERS).map((tier) => (
                    <option key={tier.id} value={tier.id}>
                      {tier.name} ({formatPrice(tier.priceMonthly, language)}/user/month)
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium mb-2">Invite Method</label>
                <div className="flex gap-2">
                  <button
                    onClick={() => setInviteMethod("link")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                      inviteMethod === "link"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Link2 className="h-4 w-4 inline mr-1" />
                    Generate Link
                  </button>
                  <button
                    onClick={() => setInviteMethod("email")}
                    className={`flex-1 rounded-lg border px-3 py-2 text-sm ${
                      inviteMethod === "email"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700 dark:border-emerald-500 dark:bg-emerald-900/20 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    <Mail className="h-4 w-4 inline mr-1" />
                    Send Email
                  </button>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  onClick={handleAddMember}
                  disabled={adding}
                  className="flex-1"
                >
                  {adding ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adding...
                    </>
                  ) : (
                    <>
                      <Plus className="h-4 w-4 mr-2" />
                      Add Member
                    </>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    setShowAddForm(false);
                    setNewMemberEmail("");
                  }}
                  variant="secondary"
                >
                  Cancel
                </Button>
              </div>
            </div>
          </div>
        )}

        {!showAddForm && (
          <Button
            onClick={() => setShowAddForm(true)}
            variant="secondary"
            className="w-full"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Team Member
          </Button>
        )}

        {/* Invite Link Display */}
        {copiedUrl && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-900/20">
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-300 mb-2">
              Invite link generated:
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={copiedUrl}
                readOnly
                className="flex-1 rounded-lg border border-emerald-200 bg-white px-3 py-2 text-xs dark:border-emerald-800 dark:bg-slate-900"
              />
              <button
                onClick={() => copyToClipboard(copiedUrl)}
                className="rounded-lg border border-emerald-200 bg-emerald-100 px-3 py-2 text-emerald-700 hover:bg-emerald-200 dark:border-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300"
              >
                {copiedUrl === copiedUrl ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>
        )}

        {/* Seats Table */}
        <div>
          <h3 className="text-sm font-semibold mb-3">Team Members</h3>
          {seats.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">
              No team members yet. Add your first member above.
            </p>
          ) : (
            <div className="space-y-2">
              {seats.map((seat) => (
                <div
                  key={seat.id}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white p-3 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{seat.userName || seat.email}</p>
                      {seat.isOwner && (
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                          Owner
                        </span>
                      )}
                      {seat.status === "pending" && (
                        <span className="rounded-full bg-yellow-100 px-2 py-0.5 text-xs text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300">
                          Pending
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500">{seat.email}</p>
                  </div>
                  <select
                    value={seat.tier}
                    onChange={(e) => handleUpdateTier(seat.id, e.target.value as TierId)}
                    disabled={seat.isOwner}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800"
                  >
                    {Object.values(TIERS).map((tier) => (
                      <option key={tier.id} value={tier.id}>
                        {tier.name}
                      </option>
                    ))}
                  </select>
                  {!seat.isOwner && (
                    <button
                      onClick={() => handleRemoveSeat(seat.id)}
                      className="rounded-lg border border-red-200 p-2 text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                      aria-label="Remove member"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Pending Invites */}
        {invites.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold mb-3">Pending Invites</h3>
            <div className="space-y-2">
              {invites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-900/40"
                >
                  <div className="flex-1">
                    <p className="text-sm font-medium">
                      {invite.email || "Link-only invite"}
                    </p>
                    <p className="text-xs text-slate-500">
                      {TIERS[invite.tier].name} • Expires in {invite.expiresIn} day{invite.expiresIn !== 1 ? "s" : ""}
                    </p>
                  </div>
                  <button
                    onClick={() => copyToClipboard(invite.inviteUrl)}
                    className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs hover:bg-slate-100 dark:border-slate-700 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-3 w-3 inline mr-1" />
                    Copy Link
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>

      {/* Guardrail Confirmation Modal */}
      {guardrailModal && (
        <Modal
          title={
            guardrailModal.blockingIssues.length > 0
              ? "Cannot Apply Changes"
              : "Review Changes"
          }
          description={
            guardrailModal.blockingIssues.length > 0
              ? "There are issues that prevent this change from being applied."
              : "Please review the following before confirming your changes."
          }
          open={guardrailModal.open}
          onClose={() => setGuardrailModal(null)}
        >
          <div className="space-y-4">
            {/* Blocking Issues */}
            {guardrailModal.blockingIssues.length > 0 && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/20">
                <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  Blocking Issues
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-red-700 dark:text-red-300">
                  {guardrailModal.blockingIssues.map((issue, idx) => (
                    <li key={idx}>{issue}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Warnings */}
            {guardrailModal.warnings.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  Warnings
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {guardrailModal.warnings.map((warning, idx) => (
                    <li key={idx}>{warning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Features Lost */}
            {guardrailModal.featuresLost.length > 0 && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
                <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-200 mb-2">
                  Features You&apos;ll Lose Access To:
                </h4>
                <ul className="list-disc list-inside space-y-1 text-sm text-amber-700 dark:text-amber-300">
                  {guardrailModal.featuresLost.map((feature, idx) => (
                    <li key={idx}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Price Change */}
            {guardrailModal.priceChange && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/40">
                <h4 className="text-sm font-semibold mb-2">Price Change</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">Current</span>
                    <span>{formatPrice(guardrailModal.priceChange.current, language)}/mo</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600 dark:text-slate-400">New Total</span>
                    <span className="font-semibold">
                      {formatPrice(guardrailModal.priceChange.proposed, language)}/mo
                    </span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-600 dark:text-slate-400">Change</span>
                    <span
                      className={
                        guardrailModal.priceChange.difference >= 0
                          ? "text-red-600 dark:text-red-400"
                          : "text-emerald-600 dark:text-emerald-400"
                      }
                    >
                      {guardrailModal.priceChange.difference >= 0 ? "+" : ""}
                      {formatPrice(guardrailModal.priceChange.difference, language)}/mo
                      ({guardrailModal.priceChange.percentChange >= 0 ? "+" : ""}
                      {Math.round(guardrailModal.priceChange.percentChange)}%)
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 pt-4">
              {guardrailModal.blockingIssues.length === 0 && (
                <Button
                  onClick={guardrailModal.onConfirm}
                  className="flex-1"
                >
                  Confirm Changes
                </Button>
              )}
              <Button
                onClick={() => setGuardrailModal(null)}
                variant="secondary"
                className={guardrailModal.blockingIssues.length === 0 ? "flex-1" : "w-full"}
              >
                {guardrailModal.blockingIssues.length > 0 ? "Close" : "Cancel"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </Card>
  );
}


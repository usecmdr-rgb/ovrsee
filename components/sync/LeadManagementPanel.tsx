"use client";

import { useState, useEffect } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, TrendingUp, DollarSign, AlertTriangle } from "lucide-react";
import { isOpportunityDetectionEnabled, isAutoSequenceFollowUpsEnabled } from "@/lib/sync/featureFlags";

interface Lead {
  id?: string;
  score: number;
  stage: string;
  budget?: string | null;
  timeline?: string | null;
  potential_value?: number | null;
  currency?: string | null;
  closed_value?: number | null;
  primary_opportunity_type?: string | null;
  primary_opportunity_strength?: string | null;
  sequence_id?: string | null;
}

interface Opportunity {
  id: string;
  type: string;
  strength: string;
  summary: string;
  created_at: string;
}

interface Sequence {
  id: string;
  name: string;
  description?: string | null;
  is_default: boolean;
}

interface LeadManagementPanelProps {
  lead: Lead;
  selectedEmail: any;
  setEmailQueueItems: (updater: any) => void;
}

const STAGE_LABELS: Record<string, string> = {
  new: "New",
  cold: "Cold",
  qualified: "Qualified",
  warm: "Warm",
  negotiating: "Negotiating",
  ready_to_close: "Ready to Close",
  won: "Won",
  lost: "Lost",
};

const OPPORTUNITY_TYPE_LABELS: Record<string, string> = {
  buying_signal: "Buying Signal",
  risk: "Risk",
  competitor: "Competitor",
  upsell: "Upsell",
  renewal: "Renewal",
};

const STRENGTH_COLORS: Record<string, string> = {
  high: "bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300",
  medium: "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300",
  low: "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300",
};

export default function LeadManagementPanel({
  lead,
  selectedEmail,
  setEmailQueueItems,
}: LeadManagementPanelProps) {
  const leadId = lead.id;
  const leadScore = lead.score || 0;
  const [leadStage, setLeadStageLocal] = useState(lead.stage || "new");
  const [updatingStage, setUpdatingStage] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; body: string; created_at: string }>>([]);
  const [loadingNotes, setLoadingNotes] = useState(false);
  const [showNotes, setShowNotes] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [savingNote, setSavingNote] = useState(false);
  
  // Opportunities state
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [loadingOpportunities, setLoadingOpportunities] = useState(false);
  const [showOpportunities, setShowOpportunities] = useState(false);
  
  // Revenue state
  const [potentialValue, setPotentialValue] = useState<string>(lead.potential_value?.toString() || "");
  const [currency, setCurrency] = useState<string>(lead.currency || "USD");
  const [closedValue, setClosedValue] = useState<string>(lead.closed_value?.toString() || "");
  const [updatingRevenue, setUpdatingRevenue] = useState(false);
  
  // Sequence state
  const [sequences, setSequences] = useState<Sequence[]>([]);
  const [selectedSequenceId, setSelectedSequenceId] = useState<string | null>(lead.sequence_id || null);
  const [loadingSequences, setLoadingSequences] = useState(false);
  const [updatingSequence, setUpdatingSequence] = useState(false);

  // Stage color
  let stageColor = "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300";
  if (leadScore >= 80) {
    stageColor = "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300";
  } else if (leadScore >= 60) {
    stageColor = "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300";
  }

  // Load opportunities
  const loadOpportunities = async () => {
    if (!leadId || loadingOpportunities || !isOpportunityDetectionEnabled()) return;
    try {
      setLoadingOpportunities(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}/opportunities`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setOpportunities(data.opportunities || []);
      }
    } catch (error) {
      console.error("Error loading opportunities:", error);
    } finally {
      setLoadingOpportunities(false);
    }
  };

  // Load sequences
  const loadSequences = async () => {
    if (loadingSequences || !isAutoSequenceFollowUpsEnabled()) return;
    try {
      setLoadingSequences(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch("/api/sync/sequences", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setSequences(data.sequences || []);
      }
    } catch (error) {
      console.error("Error loading sequences:", error);
    } finally {
      setLoadingSequences(false);
    }
  };

  // Update lead stage
  const updateLeadStage = async (newStage: string) => {
    if (!leadId || updatingStage) return;
    try {
      setUpdatingStage(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const updateData: any = { lead_stage: newStage };
      
      // Auto-set closed_value & closed_at when stage transitions to 'won' (only if closed_value was empty)
      if (newStage === "won" && !lead.closed_value && potentialValue) {
        updateData.closed_value = parseFloat(potentialValue) || null;
        updateData.closed_at = new Date().toISOString();
        setClosedValue(potentialValue);
      }

      const res = await fetch(`/api/sync/lead/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(updateData),
      });

      if (res.ok) {
        setLeadStageLocal(newStage);
        // Update in email data
        setEmailQueueItems((prev: any[]) =>
          prev.map((e) =>
            e.id === selectedEmail.id && (e as any).lead
              ? {
                  ...e,
                  lead: { ...(e as any).lead, stage: newStage, closed_value: updateData.closed_value, closed_at: updateData.closed_at },
                }
              : e
          )
        );
      }
    } catch (error) {
      console.error("Error updating lead stage:", error);
      alert("Failed to update lead stage");
    } finally {
      setUpdatingStage(false);
    }
  };

  // Update revenue fields
  const updateRevenue = async () => {
    if (!leadId || updatingRevenue) return;
    try {
      setUpdatingRevenue(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          potential_value: potentialValue ? parseFloat(potentialValue) : null,
          currency: currency || "USD",
          closed_value: closedValue ? parseFloat(closedValue) : null,
        }),
      });

      if (res.ok) {
        // Update in email data
        setEmailQueueItems((prev: any[]) =>
          prev.map((e) =>
            e.id === selectedEmail.id && (e as any).lead
              ? {
                  ...e,
                  lead: {
                    ...(e as any).lead,
                    potential_value: potentialValue ? parseFloat(potentialValue) : null,
                    currency: currency || "USD",
                    closed_value: closedValue ? parseFloat(closedValue) : null,
                  },
                }
              : e
          )
        );
      }
    } catch (error) {
      console.error("Error updating revenue:", error);
      alert("Failed to update revenue");
    } finally {
      setUpdatingRevenue(false);
    }
  };

  // Update sequence
  const updateSequence = async (sequenceId: string | null) => {
    if (!leadId || updatingSequence) return;
    try {
      setUpdatingSequence(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}/sequence`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ sequenceId }),
      });

      if (res.ok) {
        setSelectedSequenceId(sequenceId);
        // Update in email data
        setEmailQueueItems((prev: any[]) =>
          prev.map((e) =>
            e.id === selectedEmail.id && (e as any).lead
              ? {
                  ...e,
                  lead: { ...(e as any).lead, sequence_id: sequenceId },
                }
              : e
          )
        );
      }
    } catch (error) {
      console.error("Error updating sequence:", error);
      alert("Failed to update sequence");
    } finally {
      setUpdatingSequence(false);
    }
  };

  // Save note
  const saveNote = async () => {
    if (!leadId || !newNote.trim() || savingNote) return;
    try {
      setSavingNote(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}/notes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ body: newNote }),
      });

      if (res.ok) {
        const data = await res.json();
        setNotes([data.note, ...notes]);
        setNewNote("");
      }
    } catch (error) {
      console.error("Error saving note:", error);
      alert("Failed to save note");
    } finally {
      setSavingNote(false);
    }
  };

  useEffect(() => {
    if (showNotes && notes.length === 0 && leadId) {
      loadNotes();
    }
  }, [showNotes, leadId]);

  useEffect(() => {
    if (showOpportunities && opportunities.length === 0 && leadId) {
      loadOpportunities();
    }
  }, [showOpportunities, leadId]);

  useEffect(() => {
    if (isAutoSequenceFollowUpsEnabled() && sequences.length === 0) {
      loadSequences();
    }
  }, []);

  // Load notes function
  const loadNotes = async () => {
    if (!leadId || loadingNotes) return;
    try {
      setLoadingNotes(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) return;

      const res = await fetch(`/api/sync/lead/${leadId}/notes`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoadingNotes(false);
    }
  };

  const primaryOpportunity = lead.primary_opportunity_type && lead.primary_opportunity_strength
    ? {
        type: lead.primary_opportunity_type,
        strength: lead.primary_opportunity_strength,
      }
    : null;

  return (
    <div className="mt-2 mb-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 p-2.5 text-xs space-y-2">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="font-semibold text-slate-600 dark:text-slate-400">Lead:</span>
          <span className={`rounded-full px-2 py-0.5 font-semibold ${stageColor}`}>
            {STAGE_LABELS[leadStage] || leadStage} ({leadScore})
          </span>
          {leadId && (
            <select
              value={leadStage}
              onChange={(e) => updateLeadStage(e.target.value)}
              disabled={updatingStage}
              className="ml-1 px-1.5 py-0.5 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 disabled:opacity-50"
              onClick={(e) => e.stopPropagation()}
            >
              {Object.entries(STAGE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          )}
        </div>
        {lead.budget && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">Budget:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{lead.budget}</span>
          </div>
        )}
        {lead.timeline && (
          <div>
            <span className="text-slate-500 dark:text-slate-400">Timeline:</span>{" "}
            <span className="text-slate-700 dark:text-slate-300">{lead.timeline}</span>
          </div>
        )}
      </div>

      {/* Opportunities Section */}
      {isOpportunityDetectionEnabled() && leadId && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Opportunities</span>
            <button
              onClick={() => {
                setShowOpportunities(!showOpportunities);
                if (!showOpportunities && opportunities.length === 0) {
                  loadOpportunities();
                }
              }}
              className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300"
            >
              {showOpportunities ? "Hide" : "Show"} ({opportunities.length + (primaryOpportunity ? 1 : 0)})
            </button>
          </div>
          
          {primaryOpportunity && (
            <div className={`mb-2 rounded px-2 py-1 ${STRENGTH_COLORS[primaryOpportunity.strength] || "bg-slate-100 dark:bg-slate-800"}`}>
              <div className="flex items-center gap-1.5">
                <TrendingUp size={12} />
                <span className="font-semibold">{OPPORTUNITY_TYPE_LABELS[primaryOpportunity.type] || primaryOpportunity.type}</span>
                <span className="text-[10px] opacity-75">({primaryOpportunity.strength})</span>
              </div>
            </div>
          )}

          {showOpportunities && (
            <div className="mt-2 space-y-1.5 max-h-32 overflow-y-auto">
              {loadingOpportunities ? (
                <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
              ) : (
                <>
                  {opportunities.slice(0, 3).map((opp) => (
                    <div key={opp.id} className={`rounded px-2 py-1 text-[10px] ${STRENGTH_COLORS[opp.strength] || "bg-slate-100 dark:bg-slate-800"}`}>
                      <div className="font-semibold">{OPPORTUNITY_TYPE_LABELS[opp.type] || opp.type} ({opp.strength})</div>
                      <div className="mt-0.5 opacity-90">{opp.summary}</div>
                    </div>
                  ))}
                  {opportunities.length === 0 && !primaryOpportunity && (
                    <div className="text-[10px] text-slate-500 dark:text-slate-400 italic">No opportunities detected</div>
                  )}
                </>
              )}
            </div>
          )}
        </div>
      )}

      {/* Revenue Section */}
      {leadId && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <DollarSign size={12} className="text-slate-500 dark:text-slate-400" />
            <span className="font-semibold text-slate-600 dark:text-slate-400">Revenue</span>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={potentialValue}
                onChange={(e) => setPotentialValue(e.target.value)}
                onBlur={updateRevenue}
                placeholder="Potential value"
                className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              />
              <select
                value={currency}
                onChange={(e) => {
                  setCurrency(e.target.value);
                  updateRevenue();
                }}
                className="px-1.5 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                onClick={(e) => e.stopPropagation()}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="CAD">CAD</option>
              </select>
            </div>
            {leadStage === "won" && (
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={closedValue}
                  onChange={(e) => setClosedValue(e.target.value)}
                  onBlur={updateRevenue}
                  placeholder="Closed value"
                  className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Sequence Section */}
      {isAutoSequenceFollowUpsEnabled() && leadId && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="font-semibold text-slate-600 dark:text-slate-400">Sequence</span>
          </div>
          <select
            value={selectedSequenceId || ""}
            onChange={(e) => updateSequence(e.target.value || null)}
            disabled={updatingSequence || loadingSequences}
            className="w-full px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 disabled:opacity-50"
            onClick={(e) => e.stopPropagation()}
          >
            <option value="">None</option>
            {sequences.map((seq) => (
              <option key={seq.id} value={seq.id}>
                {seq.name} {seq.is_default ? "(Default)" : ""}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Notes Section */}
      {leadId && (
        <div className="border-t border-slate-200 dark:border-slate-700 pt-2 mt-2">
          <button
            onClick={() => {
              setShowNotes(!showNotes);
              if (!showNotes && notes.length === 0) {
                loadNotes();
              }
            }}
            className="text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
          >
            {showNotes ? "Hide" : "Show"} Notes ({notes.length})
          </button>

          {showNotes && (
            <div className="mt-2 space-y-2 max-h-32 overflow-y-auto">
              {loadingNotes ? (
                <Loader2 className="h-3 w-3 animate-spin text-slate-500" />
              ) : (
                <>
                  {notes.map((note) => (
                    <div key={note.id} className="text-xs text-slate-600 dark:text-slate-400 p-1.5 bg-white dark:bg-slate-900 rounded">
                      {note.body}
                      <span className="ml-2 text-slate-400 text-[10px]">
                        {new Date(note.created_at).toLocaleDateString()}
                      </span>
                    </div>
                  ))}
                  <div className="flex gap-1">
                    <textarea
                      value={newNote}
                      onChange={(e) => setNewNote(e.target.value)}
                      placeholder="Add a note..."
                      className="flex-1 px-2 py-1 text-xs border border-slate-300 dark:border-slate-700 rounded bg-white dark:bg-slate-900 resize-none"
                      rows={2}
                      onClick={(e) => e.stopPropagation()}
                    />
                    <button
                      onClick={saveNote}
                      disabled={!newNote.trim() || savingNote}
                      className="px-2 py-1 text-xs bg-slate-900 text-white rounded hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900"
                    >
                      {savingNote ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

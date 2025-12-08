"use client";

import { useEffect, useState } from "react";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, Clock, CheckCircle, Calendar, AlertCircle, FileText } from "lucide-react";
import { isFollowUpSuggestionsEnabled, isAutoSequenceFollowUpsEnabled } from "@/lib/sync/featureFlags";

interface TodayItem {
  id: string;
  type: "task" | "reminder" | "appointment" | "followup" | "prepared_draft";
  title: string;
  description?: string;
  dueAt?: string;
  emailId?: string;
  threadId?: string;
  leadId?: string;
  draftBody?: string;
  draftId?: string;
}

export default function TodayDashboard({ userId }: { userId: string | null }) {
  const [items, setItems] = useState<TodayItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedUserId, setResolvedUserId] = useState<string | null>(userId);

  useEffect(() => {
    const getUserId = async () => {
      if (!resolvedUserId) {
        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
        if (session?.user?.id) {
          setResolvedUserId(session.user.id);
        }
      }
    };
    getUserId();
  }, [resolvedUserId]);

  useEffect(() => {
    if (!resolvedUserId) return;

    const loadTodayItems = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabaseBrowserClient.auth.getSession();
        if (!session?.access_token) {
          setLoading(false);
          return;
        }

        const supabase = getSupabaseServerClient();
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        const allItems: TodayItem[] = [];

        // Overdue tasks
        const { data: overdueTasks } = await supabase
          .from("email_tasks")
          .select("id, title, description, due_at, email_id")
          .eq("user_id", resolvedUserId)
          .in("status", ["pending", "open"])
          .lt("due_at", today.toISOString());

        if (overdueTasks) {
          for (const task of overdueTasks) {
            // Get thread ID separately
            let threadId: string | undefined;
            if (task.email_id) {
              const { data: email } = await supabase
                .from("email_queue")
                .select("gmail_thread_id")
                .eq("id", task.email_id)
                .maybeSingle();
              threadId = email?.gmail_thread_id;
            }
            
            allItems.push({
              id: `task-${task.id}`,
              type: "task",
              title: task.title,
              description: task.description || undefined,
              dueAt: task.due_at || undefined,
              emailId: task.email_id,
              threadId,
            });
          }
        }

        // Tasks due today
        const { data: todayTasks } = await supabase
          .from("email_tasks")
          .select("id, title, description, due_at, email_id")
          .eq("user_id", resolvedUserId)
          .in("status", ["pending", "open"])
          .gte("due_at", today.toISOString())
          .lt("due_at", tomorrow.toISOString());

        if (todayTasks) {
          for (const task of todayTasks) {
            let threadId: string | undefined;
            if (task.email_id) {
              const { data: email } = await supabase
                .from("email_queue")
                .select("gmail_thread_id")
                .eq("id", task.email_id)
                .maybeSingle();
              threadId = email?.gmail_thread_id;
            }
            
            allItems.push({
              id: `task-${task.id}`,
              type: "task",
              title: task.title,
              description: task.description || undefined,
              dueAt: task.due_at || undefined,
              emailId: task.email_id,
              threadId,
            });
          }
        }

        // Active reminders (due today or overdue)
        const { data: reminders } = await supabase
          .from("email_reminders")
          .select("id, message, remind_at, email_id")
          .eq("user_id", resolvedUserId)
          .eq("status", "active")
          .lte("remind_at", new Date().toISOString());

        if (reminders) {
          for (const reminder of reminders) {
            let threadId: string | undefined;
            if (reminder.email_id) {
              const { data: email } = await supabase
                .from("email_queue")
                .select("gmail_thread_id")
                .eq("id", reminder.email_id)
                .maybeSingle();
              threadId = email?.gmail_thread_id;
            }
            
            allItems.push({
              id: `reminder-${reminder.id}`,
              type: "reminder",
              title: reminder.message,
              dueAt: reminder.remind_at,
              emailId: reminder.email_id,
              threadId,
            });
          }
        }

        // Upcoming appointments (next 24-48 hours)
        const next48Hours = new Date();
        next48Hours.setHours(next48Hours.getHours() + 48);

        const { data: appointments } = await supabase
          .from("email_appointments")
          .select("id, summary, description, start_at, email_id")
          .eq("user_id", resolvedUserId)
          .gte("start_at", new Date().toISOString())
          .lte("start_at", next48Hours.toISOString());

        if (appointments) {
          for (const apt of appointments) {
            let threadId: string | undefined;
            if (apt.email_id) {
              const { data: email } = await supabase
                .from("email_queue")
                .select("gmail_thread_id")
                .eq("id", apt.email_id)
                .maybeSingle();
              threadId = email?.gmail_thread_id;
            }
            
            allItems.push({
              id: `appt-${apt.id}`,
              type: "appointment",
              title: apt.summary,
              description: apt.description || undefined,
              dueAt: apt.start_at,
              emailId: apt.email_id,
              threadId,
            });
          }
        }

        // Pending follow-up suggestions
        if (isFollowUpSuggestionsEnabled()) {
          const { data: followUps } = await supabase
            .from("lead_follow_up_suggestions")
            .select("id, suggested_for, email_id, lead_id")
            .eq("user_id", resolvedUserId)
            .eq("status", "pending")
            .lte("suggested_for", new Date().toISOString());

          if (followUps) {
            for (const fu of followUps) {
              let threadId: string | undefined;
              if (fu.email_id) {
                const { data: email } = await supabase
                  .from("email_queue")
                  .select("gmail_thread_id")
                  .eq("id", fu.email_id)
                  .maybeSingle();
                threadId = email?.gmail_thread_id;
              }
              
              allItems.push({
                id: `followup-${fu.id}`,
                type: "followup",
                title: "Follow-up suggested",
                description: "This lead needs a follow-up",
                dueAt: fu.suggested_for,
                emailId: fu.email_id,
                threadId,
                leadId: fu.lead_id,
              });
            }
          }
        }

        // Prepared follow-up drafts
        if (isAutoSequenceFollowUpsEnabled()) {
          const { data: { session } } = await supabaseBrowserClient.auth.getSession();
          if (session?.access_token) {
            try {
              const res = await fetch("/api/sync/follow-ups/prepared", {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });

              if (res.ok) {
                const { drafts } = await res.json();
                if (drafts && drafts.length > 0) {
                  for (const draft of drafts) {
                    allItems.push({
                      id: `prepared-${draft.id}`,
                      type: "prepared_draft",
                      title: `Draft ready for ${draft.contact.name || draft.contact.email}`,
                      description: draft.email.subject || "Follow-up draft",
                      dueAt: draft.createdAt,
                      emailId: draft.emailId,
                      threadId: draft.email.threadId,
                      leadId: draft.leadId,
                      draftBody: draft.draftBody,
                      draftId: draft.id,
                    });
                  }
                }
              }
            } catch (error) {
              console.error("[TodayDashboard] Error loading prepared drafts:", error);
            }
          }
        }

        // Sort by due date
        allItems.sort((a, b) => {
          if (!a.dueAt && !b.dueAt) return 0;
          if (!a.dueAt) return 1;
          if (!b.dueAt) return -1;
          return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
        });

        setItems(allItems);
      } catch (error) {
        console.error("Error loading today items:", error);
      } finally {
        setLoading(false);
      }
    };

    loadTodayItems();
  }, [resolvedUserId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
        <span className="ml-2 text-sm text-slate-500">Loading today&apos;s items...</span>
      </div>
    );
  }

  // Group items by type
  const overdue = items.filter((item) => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    return due < new Date();
  });

  const dueToday = items.filter((item) => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return due >= today && due < tomorrow;
  });

  const upcoming = items.filter((item) => {
    if (!item.dueAt) return false;
    const due = new Date(item.dueAt);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    tomorrow.setHours(0, 0, 0, 0);
    return due >= tomorrow;
  });

  const renderItem = (item: TodayItem) => {
    const getIcon = () => {
      switch (item.type) {
        case "task":
          return <CheckCircle className="h-4 w-4" />;
        case "reminder":
          return <Clock className="h-4 w-4" />;
        case "appointment":
          return <Calendar className="h-4 w-4" />;
        case "followup":
          return <AlertCircle className="h-4 w-4" />;
        case "prepared_draft":
          return <FileText className="h-4 w-4" />;
      }
    };

    const getColor = () => {
      switch (item.type) {
        case "task":
          return "text-blue-600 dark:text-blue-400";
        case "reminder":
          return "text-purple-600 dark:text-purple-400";
        case "appointment":
          return "text-emerald-600 dark:text-emerald-400";
        case "followup":
          return "text-amber-600 dark:text-amber-400";
        case "prepared_draft":
          return "text-orange-600 dark:text-orange-400";
      }
    };

    return (
      <div
        key={item.id}
        className="rounded-lg border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-3 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition"
      >
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className={`mt-0.5 ${getColor()}`}>{getIcon()}</div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.title}</p>
              {item.description && (
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1">{item.description}</p>
              )}
              {item.dueAt && (
                <p className="text-xs text-slate-500 dark:text-slate-500 mt-1">
                  {new Date(item.dueAt).toLocaleString()}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {item.type === "prepared_draft" && (
              <button
                className="text-xs px-2 py-1 rounded bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 hover:bg-orange-200 dark:hover:bg-orange-900/60"
                onClick={() => {
                  // Navigate to email with draft pre-filled
                  if (item.emailId) {
                    window.location.href = `/sync?emailId=${item.emailId}&draftId=${item.draftId}`;
                  }
                }}
              >
                Review draft
              </button>
            )}
            {item.emailId && (
              <button
                className="text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-300"
                onClick={() => {
                  // Navigate to email
                  window.location.href = `/sync?emailId=${item.emailId}`;
                }}
              >
                Open email
              </button>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-red-600 dark:text-red-400 mb-3 flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            Overdue ({overdue.length})
          </h3>
          <div className="space-y-2">
            {overdue.map(renderItem)}
          </div>
        </section>
      )}

      {dueToday.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Clock className="h-4 w-4" />
            Due Today ({dueToday.length})
          </h3>
          <div className="space-y-2">
            {dueToday.map(renderItem)}
          </div>
        </section>
      )}

      {upcoming.length > 0 && (
        <section>
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            Upcoming ({upcoming.length})
          </h3>
          <div className="space-y-2">
            {upcoming.map(renderItem)}
          </div>
        </section>
      )}

      {items.length === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-slate-500 dark:text-slate-400">No items for today</p>
        </div>
      )}
    </div>
  );
}


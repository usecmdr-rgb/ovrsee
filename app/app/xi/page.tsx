"use client";

import { useMemo, useState, FormEvent } from "react";
import { mockEmails } from "@/lib/data";
import { useAppState } from "@/context/AppStateContext";
import type { EmailRecord } from "@/types";
import { useAgentStats, emptyAgentStats } from "@/hooks/useAgentStats";

interface ChatMessage {
  role: "user" | "agent";
  text: string;
}

const XiPage = () => {
  const { alertCategories } = useAppState();
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedEmail, setSelectedEmail] = useState<EmailRecord | null>(mockEmails[0]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "agent", text: "Tell me how you'd like to change or edit the draft." },
  ]);
  const [isProcessing, setIsProcessing] = useState(false);
  const { stats, loading, error } = useAgentStats();
  // Fallback to realistic random numbers if no stats available
  const fallbackStats = {
    ...emptyAgentStats,
    xi_important_emails: 18,
    xi_payments_bills: 7,
    xi_invoices: 4,
    xi_missed_emails: 3,
  };
  const latestStats = stats ?? fallbackStats;
  const noStats = !stats && !loading && !error;

  const filteredEmails = useMemo(() => {
    if (!activeCategory) return mockEmails;
    return mockEmails.filter((email) => email.categoryId === activeCategory);
  }, [activeCategory]);

  const categoryMap = Object.fromEntries(alertCategories.map((cat) => [cat.id, cat]));

  const handleChat = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const input = form.elements.namedItem("message") as HTMLInputElement;
    if (!input.value.trim() || !selectedEmail) return;

    const userMessage = input.value.trim();
    setChatMessages((prev) => [...prev, { role: "user", text: userMessage }]);
    input.value = "";
    setIsProcessing(true);

    // Simulate AI processing - in production, this would call an API
    setTimeout(() => {
      // Update the draft based on user feedback
      // In a real implementation, this would call an API endpoint to update the draft
      const updatedDraft = `[Updated based on your feedback: "${userMessage}"] ${selectedEmail.draft || "Placeholder draft goes here."}`;
      
      // Update the selected email's draft
      if (selectedEmail) {
        setSelectedEmail({ ...selectedEmail, draft: updatedDraft });
      }

      setChatMessages((prev) => [
        ...prev,
        { role: "agent", text: `I've updated the draft based on your feedback. The changes have been applied to the preview above.` },
      ]);
      setIsProcessing(false);
    }, 1000);
  };

  // Reset chat messages when email selection changes
  const handleEmailSelect = (email: EmailRecord) => {
    setSelectedEmail(email);
    setChatMessages([{ role: "agent", text: "Tell me how you'd like to change or edit the draft." }]);
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-widest text-slate-500">Xi / Chi agent</p>
          <h1 className="text-3xl font-semibold">Inbox & calendar command board</h1>
        </div>
        <button className="rounded-full border border-slate-200 px-5 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
          Connect your Gmail
        </button>
      </header>
      <section className="rounded-3xl border border-slate-200 bg-white/80 p-5 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">Latest inbox metrics</p>
          {loading && <span className="text-xs text-slate-500">Loading stats…</span>}
          {error && <span className="text-xs text-red-500">Couldn&apos;t load stats</span>}
          {noStats && <span className="text-xs text-slate-500">No stats yet</span>}
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { label: "Important emails", value: latestStats.xi_important_emails },
            { label: "Payments / bills", value: latestStats.xi_payments_bills },
            { label: "Invoices", value: latestStats.xi_invoices },
            { label: "Missed emails", value: latestStats.xi_missed_emails },
          ].map((metric) => (
            <div key={metric.label} className="rounded-2xl border border-slate-200 bg-white/80 p-4 text-sm font-semibold dark:border-slate-800 dark:bg-slate-900/60 min-w-0">
              <p className="text-xs uppercase tracking-widest text-slate-500 break-words leading-tight">{metric.label}</p>
              <p className="mt-2 text-2xl">{metric.value}</p>
            </div>
          ))}
        </div>
      </section>
      <section className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {alertCategories.map((category) => (
          <button
            key={category.id}
            onClick={() => setActiveCategory((prev) => (prev === category.id ? null : category.id))}
            style={{ backgroundColor: category.color }}
            className={`rounded-2xl p-3 text-left text-sm font-semibold text-white shadow-sm transition ${
              activeCategory === category.id ? "ring-2 ring-white/70" : "opacity-90"
            }`}
          >
            <p>{category.name}</p>
            <p className="text-xs opacity-80">{category.count} alerts</p>
          </button>
        ))}
      </section>
      <div className="grid gap-6 lg:grid-cols-[1.5fr,1fr]">
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">Email queue</h2>
            {activeCategory && (
              <button onClick={() => setActiveCategory(null)} className="text-xs uppercase tracking-wide text-brand-accent">
                Clear filter
              </button>
            )}
          </div>
          <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
            {filteredEmails.map((email) => (
              <button
                key={email.id}
                onClick={() => handleEmailSelect(email)}
                className={`w-full py-3 text-left ${
                  selectedEmail?.id === email.id ? "bg-slate-100 dark:bg-slate-800/60" : ""
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="text-sm font-semibold">{email.sender}</p>
                  <span className="text-xs text-slate-500">{email.timestamp}</span>
                </div>
                <p className="text-sm text-slate-600 dark:text-slate-300">{email.subject}</p>
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span
                    className="rounded-full px-2 py-1 text-white"
                    style={{ backgroundColor: categoryMap[email.categoryId]?.color || "#0f172a" }}
                  >
                    {categoryMap[email.categoryId]?.name ?? "Uncategorized"}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-slate-500 dark:bg-slate-800">
                    {email.status.replace("_", " ")}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white/80 p-5 text-sm shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold">Draft preview</h2>
          {selectedEmail ? (
            <div className="mt-4 space-y-4 text-slate-600 dark:text-slate-200">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Original</p>
                <p className="mt-1 rounded-2xl bg-slate-100/70 p-3 text-sm dark:bg-slate-800/60">
                  {selectedEmail.snippet}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">Xi draft</p>
                <p className="mt-1 rounded-2xl bg-slate-900/90 p-3 text-sm text-white dark:bg-white/10 dark:text-white">
                  {selectedEmail.draft || "Placeholder draft goes here."}
                </p>
              </div>
              <div className="flex gap-3">
                <button className="flex-1 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 dark:bg-white dark:text-slate-900">
                  Accept draft
                </button>
                <button className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-800">
                  Edit draft
                </button>
              </div>
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/60">
                <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Chat with Xi</h3>
                <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
                  {chatMessages.map((message, index) => (
                    <div
                      key={index}
                      className={`rounded-2xl px-3 py-2 text-xs ${
                        message.role === "agent"
                          ? "bg-slate-900/90 text-white dark:bg-slate-800"
                          : "bg-slate-100 text-slate-700 dark:bg-slate-800/60 dark:text-slate-200"
                      }`}
                    >
                      {message.text}
                    </div>
                  ))}
                  {isProcessing && (
                    <div className="rounded-2xl bg-slate-900/90 px-3 py-2 text-xs text-white dark:bg-slate-800">
                      Processing your request...
                    </div>
                  )}
                </div>
                <form onSubmit={handleChat} className="mt-3 flex gap-2">
                  <input
                    name="message"
                    placeholder="Tell Xi how to change or edit the draft..."
                    disabled={isProcessing}
                    className="flex-1 rounded-xl border border-slate-200 bg-transparent px-3 py-2 text-xs focus:border-brand-accent focus:outline-none disabled:opacity-50 dark:border-slate-700"
                  />
                  <button
                    type="submit"
                    disabled={isProcessing}
                    className="rounded-xl bg-slate-900 px-4 py-2 text-xs font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
                  >
                    Send
                  </button>
                </form>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-slate-500">Select an email to preview Xi&apos;s draft.</p>
          )}
        </div>
      </div>
    </div>
  );
};

export default XiPage;

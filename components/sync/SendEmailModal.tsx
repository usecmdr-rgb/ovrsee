"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { Loader2, Send } from "lucide-react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

interface SendEmailModalProps {
  open: boolean;
  onClose: () => void;
  email: {
    id: string;
    to: string;
    toName?: string | null;
    subject: string;
    body: string;
    threadId?: string | null;
  };
  onSendSuccess?: () => void;
}

export default function SendEmailModal({
  open,
  onClose,
  email,
  onSendSuccess,
}: SendEmailModalProps) {
  const [subject, setSubject] = useState(`Re: ${email.subject}`);
  const [body, setBody] = useState(email.body);
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or email changes
  useEffect(() => {
    if (open) {
      setSubject(`Re: ${email.subject}`);
      setBody(email.body);
      setError(null);
    }
  }, [open, email.subject, email.body]);

  const handleSend = async () => {
    if (!body.trim()) {
      setError("Email body cannot be empty");
      return;
    }

    setIsSending(true);
    setError(null);

    try {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setError("Not authenticated");
        setIsSending(false);
        return;
      }

      const res = await fetch("/api/sync/email/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          emailId: email.id,
          to: email.to,
          subject: subject.trim(),
          body: body.trim(),
          threadId: email.threadId,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to send email");
      }

      // Success - close modal and notify parent
      onSendSuccess?.();
      onClose();
    } catch (err: any) {
      console.error("Error sending email:", err);
      setError(err.message || "Failed to send email. Please try again.");
    } finally {
      setIsSending(false);
    }
  };

  const recipientDisplay = email.toName 
    ? `${email.toName} <${email.to}>`
    : email.to;

  return (
    <Modal
      title="Send Email"
      description="Review your email before sending"
      open={open}
      onClose={isSending ? () => {} : onClose}
      size="lg"
    >
      <div className="space-y-4">
        {/* Error message */}
        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-300">
            {error}
          </div>
        )}

        {/* To field */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            To
          </label>
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            {recipientDisplay}
          </div>
        </div>

        {/* Subject field */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            disabled={isSending}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-600 dark:focus:ring-slate-800"
            placeholder="Email subject"
          />
        </div>

        {/* Body field */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Message
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            disabled={isSending}
            rows={12}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-600 dark:focus:ring-slate-800 resize-y"
            placeholder="Email body"
          />
        </div>

        {/* Warning message */}
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="mt-0.5">
            <svg
              className="h-4 w-4 text-amber-600 dark:text-amber-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            This will send the email to <strong>{email.to}</strong>. Make sure everything looks correct before sending.
          </p>
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isSending}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || !body.trim() || !subject.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                Send Email
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}


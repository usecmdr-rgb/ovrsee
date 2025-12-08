"use client";

import { useState, useEffect } from "react";
import Modal from "@/components/ui/Modal";
import { Loader2, Save } from "lucide-react";

interface EditDraftModalProps {
  open: boolean;
  onClose: () => void;
  email: {
    id: string;
    to: string;
    toName?: string | null;
    subject: string;
    body: string;
    originalBody?: string;
    originalFrom?: string;
  };
  onSave: (editedDraft: string) => Promise<void>;
  isSaving?: boolean;
}

export default function EditDraftModal({
  open,
  onClose,
  email,
  onSave,
  isSaving = false,
}: EditDraftModalProps) {
  const [draft, setDraft] = useState(email.body);
  const [error, setError] = useState<string | null>(null);

  // Reset form when modal opens/closes or email changes
  useEffect(() => {
    if (open) {
      setDraft(email.body);
      setError(null);
    }
  }, [open, email.body]);

  const handleSave = async () => {
    if (!draft.trim()) {
      setError("Draft cannot be empty");
      return;
    }

    setError(null);
    await onSave(draft.trim());
  };

  const recipientDisplay = email.toName 
    ? `${email.toName} <${email.to}>`
    : email.to;

  return (
    <Modal
      title="Edit Draft"
      description="Review and edit your draft reply"
      open={open}
      onClose={isSaving ? undefined : onClose}
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
          <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/50 dark:text-slate-300">
            {email.subject}
          </div>
        </div>

        {/* Draft body field */}
        <div>
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
            Draft Reply
          </label>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            disabled={isSaving}
            rows={16}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:focus:border-slate-600 dark:focus:ring-slate-800 resize-y"
            placeholder="Edit your draft reply..."
          />
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 pt-2">
          <button
            onClick={onClose}
            disabled={isSaving}
            className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving || !draft.trim()}
            className="flex flex-1 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow transition hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                Save Draft
              </>
            )}
          </button>
        </div>
      </div>
    </Modal>
  );
}



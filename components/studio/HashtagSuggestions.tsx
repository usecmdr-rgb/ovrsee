"use client";

import { useState } from "react";
import { Hash, Loader2, Plus, X } from "lucide-react";

interface HashtagSuggestionsProps {
  contentBrief?: string;
  platform?: "instagram" | "tiktok" | "facebook";
  onHashtagsSelected?: (hashtags: string[]) => void;
  currentHashtags?: string[];
}

export default function HashtagSuggestions({
  contentBrief,
  platform = "instagram",
  onHashtagsSelected,
  currentHashtags = [],
}: HashtagSuggestionsProps) {
  const [loading, setLoading] = useState(false);
  const [suggestedHashtags, setSuggestedHashtags] = useState<string[]>([]);
  const [selectedHashtags, setSelectedHashtags] = useState<string[]>(currentHashtags);
  const [error, setError] = useState<string | null>(null);

  const handleSuggest = async () => {
    if (!contentBrief || contentBrief.trim().length === 0) {
      setError("Please provide a content brief to get hashtag suggestions");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data: { session } } = await (await import("@/lib/supabaseClient")).supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/studio/hashtags/suggest", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          content_brief: contentBrief,
          platform,
          count: 10,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.error || "Failed to get hashtag suggestions");
      }

      setSuggestedHashtags(result.data.suggested_hashtags || []);
    } catch (err: any) {
      setError(err.message || "Failed to get hashtag suggestions");
    } finally {
      setLoading(false);
    }
  };

  const toggleHashtag = (hashtag: string) => {
    const normalized = hashtag.replace(/^#/, "").toLowerCase();
    if (selectedHashtags.includes(normalized)) {
      const updated = selectedHashtags.filter((h) => h !== normalized);
      setSelectedHashtags(updated);
      if (onHashtagsSelected) {
        onHashtagsSelected(updated);
      }
    } else {
      const updated = [...selectedHashtags, normalized];
      setSelectedHashtags(updated);
      if (onHashtagsSelected) {
        onHashtagsSelected(updated);
      }
    }
  };

  const applyAll = () => {
    const allHashtags = [...new Set([...selectedHashtags, ...suggestedHashtags])];
    setSelectedHashtags(allHashtags);
    if (onHashtagsSelected) {
      onHashtagsSelected(allHashtags);
    }
  };

  return (
    <div className="rounded-2xl border border-slate-200 bg-white/80 p-4 dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Hash size={16} className="text-slate-600 dark:text-slate-400" />
          <h4 className="text-sm font-semibold">Recommended Hashtags</h4>
        </div>
        <button
          onClick={handleSuggest}
          disabled={loading || !contentBrief}
          className="text-xs px-3 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:hover:bg-slate-700"
        >
          {loading ? (
            <Loader2 size={12} className="animate-spin" />
          ) : (
            "Suggest"
          )}
        </button>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 border border-red-200 p-2 text-xs text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
          {error}
        </div>
      )}

      {suggestedHashtags.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {suggestedHashtags.length} suggestions
            </p>
            <button
              onClick={applyAll}
              className="text-xs text-violet-600 hover:text-violet-700 dark:text-violet-400"
            >
              Apply All
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {suggestedHashtags.map((hashtag) => {
              const normalized = hashtag.replace(/^#/, "").toLowerCase();
              const isSelected = selectedHashtags.includes(normalized);
              return (
                <button
                  key={hashtag}
                  onClick={() => toggleHashtag(hashtag)}
                  className={`
                    flex items-center gap-1 px-2 py-1 rounded-lg text-xs border transition-colors
                    ${
                      isSelected
                        ? "bg-violet-100 border-violet-300 text-violet-700 dark:bg-violet-900/20 dark:border-violet-700 dark:text-violet-300"
                        : "bg-slate-50 border-slate-200 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-700"
                    }
                  `}
                >
                  #{normalized}
                  {isSelected ? (
                    <X size={12} />
                  ) : (
                    <Plus size={12} />
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {selectedHashtags.length > 0 && (
        <div>
          <p className="text-xs text-slate-600 dark:text-slate-400 mb-2">
            Selected ({selectedHashtags.length})
          </p>
          <div className="flex flex-wrap gap-2">
            {selectedHashtags.map((hashtag) => (
              <span
                key={hashtag}
                className="px-2 py-1 rounded-lg text-xs bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300"
              >
                #{hashtag}
              </span>
            ))}
          </div>
        </div>
      )}

      {suggestedHashtags.length === 0 && !loading && (
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Click &quot;Suggest&quot; to get AI-powered hashtag recommendations based on your content and top-performing tags.
        </p>
      )}
    </div>
  );
}


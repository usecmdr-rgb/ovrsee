"use client";

import { useState } from "react";
import { Sparkles, Send, Loader2, Zap, Image, Hash, CheckCircle, ExternalLink } from "lucide-react";
import { useRouter } from "next/navigation";
import HashtagSuggestions from "./HashtagSuggestions";

export default function StudioIntelligence() {
  const router = useRouter();
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const [suggestedAssets, setSuggestedAssets] = useState<any[]>([]);
  const [actionsTaken, setActionsTaken] = useState<Array<{ tool: string; success: boolean; message: string; data?: any }>>([]);
  const [links, setLinks] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleAsk = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!question.trim()) return;

    setLoading(true);
    setError(null);
    setAnswer(null);
    setSuggestedAssets([]);
    setActionsTaken([]);
    setLinks([]);

    try {
      const response = await fetch("/api/studio/agent/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: question }),
      });

      const result = await response.json();

      if (result.ok) {
        setAnswer(result.data.answer);
        setSuggestedAssets(result.data.suggestedAssets || []);
        setActionsTaken(result.data.actions_taken || []);
        setLinks(result.data.links || []);
        setQuestion("");
      } else {
        setError(result.error || "Failed to get answer");
      }
    } catch (err: any) {
      setError(err.message || "Failed to get answer");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAsset = (asset: any) => {
    // Prefill Studio with asset details
    const params = new URLSearchParams({
      type: asset.type || "image",
      tone: asset.tone || "",
      label: asset.label || "",
    });
    window.location.href = `/studio?${params.toString()}`;
  };

  return (
    <div className="rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900/40">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles size={20} className="text-slate-600 dark:text-slate-400" />
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
            Studio Agent
          </p>
          <h3 className="text-xl font-semibold">Studio Agent</h3>
        </div>
      </div>

      <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
        Studio Agent can create posts, schedule them, repurpose content, run experiments, and generate weekly plans for you. Just ask.
      </p>

      {!answer && !loading && (
        <div className="mb-4 space-y-2">
          <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2">Try asking:</p>
          <div className="flex flex-wrap gap-2">
            {[
              "Plan my posts for next week",
              "Repurpose last week's best post for TikTok",
              "Create an experiment to test two hooks for Friday's post",
              "Summarize our performance from last week",
            ].map((suggestion, idx) => (
              <button
                key={idx}
                onClick={() => setQuestion(suggestion)}
                className="px-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <form onSubmit={handleAsk} className="mb-4">
        <div className="flex gap-2">
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask Studio Agent to create posts, schedule content, repurpose, or plan..."
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-200 bg-transparent px-4 py-2 text-sm focus:border-brand-accent focus:outline-none disabled:opacity-50 dark:border-slate-700"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50 dark:bg-white dark:text-slate-900"
          >
            {loading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Send size={16} />
            )}
          </button>
        </div>
      </form>

      {error && (
        <div className="rounded-2xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300 mb-4">
          {error}
        </div>
      )}

      {answer && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-slate-900/90 p-4 text-sm text-white dark:bg-slate-800">
            {answer}
          </div>

          {actionsTaken.length > 0 && (
            <div className="rounded-2xl border border-green-200 bg-green-50 p-4 dark:border-green-800 dark:bg-green-900/20">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle size={16} className="text-green-600 dark:text-green-400" />
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                  Actions Taken
                </p>
              </div>
              <div className="space-y-2">
                {actionsTaken.map((action, idx) => (
                  <div
                    key={idx}
                    className={`text-xs p-2 rounded-lg ${
                      action.success
                        ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                        : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                    }`}
                  >
                    <span className="font-medium">{action.tool}:</span> {action.message}
                    {action.data?.post_id && (
                      <span className="ml-2 text-xs opacity-75">(Post ID: {action.data.post_id.substring(0, 8)}...)</span>
                    )}
                    {action.data?.created_post_ids && (
                      <span className="ml-2 text-xs opacity-75">
                        ({action.data.created_post_ids.length} posts created)
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {links.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {links.map((link, idx) => (
                <button
                  key={idx}
                  onClick={() => router.push(link as any)}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 hover:bg-violet-200 text-xs font-medium dark:bg-violet-900/30 dark:text-violet-300 dark:hover:bg-violet-900/50"
                >
                  <ExternalLink size={12} />
                  {link === "/studio/calendar" ? "View in Calendar" : link}
                </button>
              ))}
            </div>
          )}

          {suggestedAssets.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                <Image size={16} className="text-slate-600 dark:text-slate-400" aria-hidden="true" />
                <p className="text-sm font-semibold">Suggested Content</p>
              </div>
              <div className="space-y-2">
                {suggestedAssets.map((asset, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCreateAsset(asset)}
                    className="w-full text-left rounded-2xl border border-slate-200 bg-white/80 p-3 text-sm hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:bg-slate-800/80"
                  >
                    <p className="font-semibold">{asset.label}</p>
                    {asset.description && (
                      <p className="text-xs text-slate-500 mt-1">{asset.description}</p>
                    )}
                    {asset.tone && (
                      <p className="text-xs text-slate-400 mt-1">Tone: {asset.tone}</p>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Hashtag Suggestions */}
      <div className="mt-4">
        <HashtagSuggestions
          contentBrief={question}
          platform="instagram"
        />
      </div>
    </div>
  );
}


"use client";

import { useState } from "react";
import { X, Instagram, Facebook, Music, Loader2, Check } from "lucide-react";

type SocialPlatform = "instagram" | "tiktok" | "facebook";

interface RepurposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sourcePostId: string;
  sourcePlatform: SocialPlatform;
  onSuccess?: (createdPosts: Array<{ id: string; platform: SocialPlatform }>) => void;
}

const PLATFORM_OPTIONS: Array<{ value: SocialPlatform; label: string; icon: typeof Instagram }> = [
  { value: "instagram", label: "Instagram", icon: Instagram },
  { value: "tiktok", label: "TikTok", icon: Music },
  { value: "facebook", label: "Facebook", icon: Facebook },
];

export default function RepurposeModal({
  isOpen,
  onClose,
  sourcePostId,
  sourcePlatform,
  onSuccess,
}: RepurposeModalProps) {
  const [selectedPlatforms, setSelectedPlatforms] = useState<SocialPlatform[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [createdPosts, setCreatedPosts] = useState<Array<{ id: string; platform: SocialPlatform }>>([]);

  // Filter out source platform from options
  const availablePlatforms = PLATFORM_OPTIONS.filter((p) => p.value !== sourcePlatform);

  const togglePlatform = (platform: SocialPlatform) => {
    if (selectedPlatforms.includes(platform)) {
      setSelectedPlatforms(selectedPlatforms.filter((p) => p !== platform));
    } else {
      setSelectedPlatforms([...selectedPlatforms, platform]);
    }
  };

  const handleRepurpose = async () => {
    if (selectedPlatforms.length === 0) {
      setError("Please select at least one platform");
      return;
    }

    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const { data: { session } } = await (await import("@/lib/supabaseClient")).supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        setError("Not authenticated");
        return;
      }

      const res = await fetch("/api/studio/repurpose", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          source_post_id: sourcePostId,
          target_platforms: selectedPlatforms,
        }),
      });

      const result = await res.json();

      if (!result.ok) {
        throw new Error(result.error || "Failed to repurpose post");
      }

      setCreatedPosts(result.data.created_posts || []);
      setSuccess(true);

      if (onSuccess) {
        onSuccess(result.data.created_posts || []);
      }

      // Auto-close after 2 seconds
      setTimeout(() => {
        handleClose();
      }, 2000);
    } catch (err: any) {
      setError(err.message || "Failed to repurpose post");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      setSelectedPlatforms([]);
      setError(null);
      setSuccess(false);
      setCreatedPosts([]);
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-800 dark:bg-slate-900">
        <button
          onClick={handleClose}
          disabled={loading}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 dark:hover:bg-slate-800 dark:hover:text-slate-300"
        >
          <X size={20} />
        </button>

        <h2 className="mb-4 text-xl font-semibold">Repurpose to Other Platforms</h2>
        <p className="mb-6 text-sm text-slate-600 dark:text-slate-400">
          Generate platform-specific content variants from this post. The AI will adapt the message for each platform&apos;s format and audience.
        </p>

        {error && (
          <div className="mb-4 rounded-xl bg-red-50 border border-red-200 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:border-red-800 dark:text-red-300">
            {error}
          </div>
        )}

        {success ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-xl bg-green-50 border border-green-200 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:border-green-800 dark:text-green-300">
              <Check size={16} />
              <span>Successfully created {createdPosts.length} draft post(s)!</span>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Created drafts:</p>
              {createdPosts.map((post) => {
                const platform = PLATFORM_OPTIONS.find((p) => p.value === post.platform);
                const Icon = platform?.icon || Instagram;
                return (
                  <div
                    key={post.id}
                    className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 p-2 dark:border-slate-800 dark:bg-slate-800"
                  >
                    <Icon size={16} className="text-slate-600 dark:text-slate-400" />
                    <span className="text-sm capitalize">{post.platform}</span>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <>
            <div className="mb-6 space-y-2">
              <p className="text-sm font-semibold">Select target platforms:</p>
              <div className="grid grid-cols-1 gap-2">
                {availablePlatforms.map((platform) => {
                  const Icon = platform.icon;
                  const isSelected = selectedPlatforms.includes(platform.value);
                  return (
                    <button
                      key={platform.value}
                      type="button"
                      onClick={() => togglePlatform(platform.value)}
                      disabled={loading}
                      className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-violet-500 bg-violet-50 dark:border-violet-500 dark:bg-violet-900/20"
                          : "border-slate-200 bg-white hover:bg-slate-50 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-slate-800"
                      } disabled:opacity-50`}
                    >
                      <div
                        className={`flex h-5 w-5 items-center justify-center rounded border ${
                          isSelected
                            ? "border-violet-500 bg-violet-500"
                            : "border-slate-300 dark:border-slate-700"
                        }`}
                      >
                        {isSelected && <Check size={12} className="text-white" />}
                      </div>
                      <Icon size={20} className="text-slate-600 dark:text-slate-400" />
                      <span className="text-sm font-medium">{platform.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleClose}
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
              >
                Cancel
              </button>
              <button
                onClick={handleRepurpose}
                disabled={loading || selectedPlatforms.length === 0}
                className="flex-1 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="mr-2 inline animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Repurpose"
                )}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}


"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { Loader2, Save, Palette, Users, MessageSquare } from "lucide-react";

interface BrandProfile {
  id?: string;
  brand_description: string | null;
  target_audience: string | null;
  voice_tone: {
    style?: string;
    formality?: string;
    personality?: string[];
    do_not_use?: string[];
    preferred_phrases?: string[];
  };
  brand_attributes: {
    keywords?: string[];
    colors?: string[];
    values?: string[];
    mission?: string;
    tagline?: string;
  };
}

const VOICE_STYLES = [
  { value: "professional", label: "Professional" },
  { value: "casual", label: "Casual" },
  { value: "friendly", label: "Friendly" },
  { value: "authoritative", label: "Authoritative" },
  { value: "playful", label: "Playful" },
];

const FORMALITY_LEVELS = [
  { value: "formal", label: "Formal" },
  { value: "semi-formal", label: "Semi-formal" },
  { value: "casual", label: "Casual" },
];

const PERSONALITY_TRAITS = [
  "warm",
  "confident",
  "helpful",
  "innovative",
  "trustworthy",
  "energetic",
  "calm",
  "humorous",
  "serious",
  "approachable",
];

export default function StudioBrandProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<BrandProfile>({
    brand_description: null,
    target_audience: null,
    voice_tone: {},
    brand_attributes: {},
  });

  useEffect(() => {
    loadBrandProfile();
  }, []);

  const loadBrandProfile = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/brand-profile", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!res.ok) {
        throw new Error("Failed to load brand profile");
      }

      const data = await res.json();
      if (data.ok && data.data) {
        setProfile(data.data);
      }
    } catch (error) {
      console.error("Error loading brand profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      if (!session?.access_token) {
        router.push("/");
        return;
      }

      const res = await fetch("/api/studio/brand-profile", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(profile),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to save brand profile");
      }

      const data = await res.json();
      if (data.ok) {
        // Show success message (could use a toast library)
        alert("Brand profile saved successfully!");
      }
    } catch (error: any) {
      console.error("Error saving brand profile:", error);
      alert(error.message || "Failed to save brand profile");
    } finally {
      setSaving(false);
    }
  };

  const updateVoiceTone = (field: string, value: any) => {
    setProfile((prev) => ({
      ...prev,
      voice_tone: {
        ...prev.voice_tone,
        [field]: value,
      },
    }));
  };

  const togglePersonalityTrait = (trait: string) => {
    const current = profile.voice_tone.personality || [];
    const updated = current.includes(trait)
      ? current.filter((t) => t !== trait)
      : [...current, trait];
    updateVoiceTone("personality", updated);
  };

  const updateBrandAttributes = (field: string, value: any) => {
    setProfile((prev) => ({
      ...prev,
      brand_attributes: {
        ...prev.brand_attributes,
        [field]: value,
      },
    }));
  };

  const addKeyword = () => {
    const keyword = prompt("Enter a keyword:");
    if (keyword) {
      const current = profile.brand_attributes.keywords || [];
      updateBrandAttributes("keywords", [...current, keyword]);
    }
  };

  const removeKeyword = (index: number) => {
    const current = profile.brand_attributes.keywords || [];
    updateBrandAttributes("keywords", current.filter((_, i) => i !== index));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-violet-500" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
            Brand Profile
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Define your brand identity to inform Studio&apos;s AI content generation
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {saving ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save
        </button>
      </div>

      <div className="space-y-6">
        {/* Brand Description */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Palette className="w-5 h-5 text-violet-500" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Brand Description
            </h2>
          </div>
          <textarea
            value={profile.brand_description || ""}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, brand_description: e.target.value }))
            }
            placeholder="Describe your brand, its mission, values, and what makes it unique..."
            className="w-full h-32 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        {/* Target Audience */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <Users className="w-5 h-5 text-violet-500" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Target Audience
            </h2>
          </div>
          <textarea
            value={profile.target_audience || ""}
            onChange={(e) =>
              setProfile((prev) => ({ ...prev, target_audience: e.target.value }))
            }
            placeholder="Describe your target audience: demographics, psychographics, interests, pain points..."
            className="w-full h-32 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
          />
        </div>

        {/* Voice & Tone */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <div className="flex items-center gap-2 mb-4">
            <MessageSquare className="w-5 h-5 text-violet-500" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Voice & Tone
            </h2>
          </div>

          <div className="space-y-4">
            {/* Style */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Style
              </label>
              <select
                value={profile.voice_tone.style || ""}
                onChange={(e) => updateVoiceTone("style", e.target.value || undefined)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="">Select a style</option>
                {VOICE_STYLES.map((style) => (
                  <option key={style.value} value={style.value}>
                    {style.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Formality */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Formality Level
              </label>
              <select
                value={profile.voice_tone.formality || ""}
                onChange={(e) => updateVoiceTone("formality", e.target.value || undefined)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              >
                <option value="">Select formality level</option>
                {FORMALITY_LEVELS.map((level) => (
                  <option key={level.value} value={level.value}>
                    {level.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Personality Traits */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Personality Traits
              </label>
              <div className="flex flex-wrap gap-2">
                {PERSONALITY_TRAITS.map((trait) => {
                  const isSelected = profile.voice_tone.personality?.includes(trait);
                  return (
                    <button
                      key={trait}
                      type="button"
                      onClick={() => togglePersonalityTrait(trait)}
                      className={`px-3 py-1 rounded-full text-sm font-medium transition-colors ${
                        isSelected
                          ? "bg-violet-600 text-white"
                          : "bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600"
                      }`}
                    >
                      {trait}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* Brand Attributes */}
        <div className="bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-6">
          <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-4">
            Brand Attributes
          </h2>

          <div className="space-y-4">
            {/* Keywords */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                  Keywords
                </label>
                <button
                  type="button"
                  onClick={addKeyword}
                  className="text-sm text-violet-600 hover:text-violet-700"
                >
                  + Add Keyword
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.brand_attributes.keywords?.map((keyword, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 rounded-full text-sm"
                  >
                    {keyword}
                    <button
                      type="button"
                      onClick={() => removeKeyword(index)}
                      className="hover:text-violet-900 dark:hover:text-violet-100"
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            </div>

            {/* Mission */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Mission Statement
              </label>
              <textarea
                value={profile.brand_attributes.mission || ""}
                onChange={(e) => updateBrandAttributes("mission", e.target.value || undefined)}
                placeholder="Your brand's mission statement..."
                className="w-full h-24 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>

            {/* Tagline */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tagline
              </label>
              <input
                type="text"
                value={profile.brand_attributes.tagline || ""}
                onChange={(e) => updateBrandAttributes("tagline", e.target.value || undefined)}
                placeholder="Your brand tagline..."
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-violet-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}


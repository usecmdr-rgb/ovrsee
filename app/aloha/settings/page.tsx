"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllVoiceProfiles,
  getVoiceProfileByKey,
  DEFAULT_VOICE_KEY,
  type AlohaVoiceKey,
  type AlohaVoiceProfile,
} from "@/lib/aloha/voice-profiles";
import type { AlohaProfile } from "@/types/database";
import type { UserPhoneNumber } from "@/types/database";
import CallForwardingModal from "@/components/modals/CallForwardingModal";
import { Search, Shuffle, X, Check, Brain, MessageSquare, Heart, Shield, Users, Clock } from "lucide-react";

export default function AlohaSettingsPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<AlohaProfile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<UserPhoneNumber | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Voice settings
  const [displayName, setDisplayName] = useState("");
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<AlohaVoiceKey>(DEFAULT_VOICE_KEY);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<AlohaVoiceKey | null>(null);

  // Phone number selection
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<Array<{ phoneNumber: string; friendlyName?: string }>>([]);
  const [randomNumber, setRandomNumber] = useState<string | null>(null);
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);

  // Voicemail settings
  const [externalPhoneNumber, setExternalPhoneNumber] = useState("");
  const [voicemailEnabled, setVoicemailEnabled] = useState(false);
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [forwardingConfirmed, setForwardingConfirmed] = useState(false);
  const [showForwardingModal, setShowForwardingModal] = useState(false);

  const voiceProfiles = getAllVoiceProfiles();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      
      // Fetch Aloha profile
      const profileResponse = await fetch("/api/aloha/profile");
      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.ok && profileData.profile) {
          setProfile(profileData.profile);
          setDisplayName(profileData.profile.display_name || "Aloha");
          setSelectedVoiceKey(
            (profileData.profile.voice_key as AlohaVoiceKey) || DEFAULT_VOICE_KEY
          );
        }
      }

      // Fetch phone number
      const phoneResponse = await fetch("/api/telephony/twilio/active-number");
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json();
        if (phoneData.ok && phoneData.phoneNumber) {
          setPhoneNumber(phoneData.phoneNumber);
          setExternalPhoneNumber(phoneData.phoneNumber.external_phone_number || "");
          setVoicemailEnabled(phoneData.phoneNumber.voicemail_enabled || false);
          setForwardingEnabled(phoneData.phoneNumber.forwarding_enabled || false);
          setForwardingConfirmed(phoneData.phoneNumber.forwarding_confirmed || false);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveVoiceSettings = async () => {
    if (!displayName.trim()) {
      setError("Display name cannot be empty");
      return;
    }

    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/aloha/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          display_name: displayName.trim(),
          voice_key: selectedVoiceKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (data.ok && data.profile) {
        setProfile(data.profile);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleSearchNumbers = async () => {
    try {
      setSearchingNumbers(true);
      setError(null);
      const response = await fetch(
        `/api/telephony/twilio/available-numbers?country=${country}${areaCode ? `&areaCode=${areaCode}` : ""}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to search numbers");
      }
      
      setAvailableNumbers(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSearchingNumbers(false);
    }
  };

  const handleGetRandomNumber = async () => {
    try {
      setError(null);
      const response = await fetch(
        `/api/telephony/twilio/random-number?country=${country}${areaCode ? `&areaCode=${areaCode}` : ""}`
      );
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to get random number");
      }
      
      setRandomNumber(data.phoneNumber);
      setAvailableNumbers([{ phoneNumber: data.phoneNumber, friendlyName: data.friendlyName }]);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePurchaseNumber = async (phoneNumberToPurchase: string) => {
    try {
      setPurchasingNumber(phoneNumberToPurchase);
      setError(null);
      
      const response = await fetch("/api/telephony/twilio/purchase-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumberToPurchase,
          country,
          areaCode: areaCode || undefined,
        }),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to purchase number");
      }
      
      // Refresh phone number data
      await fetchData();
      setAvailableNumbers([]);
      setRandomNumber(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurchasingNumber(null);
    }
  };

  const handleReleaseNumber = async () => {
    if (!confirm("Are you sure you want to release your Aloha number? This will disable voicemail and forwarding.")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/telephony/twilio/release-number", {
        method: "POST",
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.error || "Failed to release number");
      }
      
      // Refresh phone number data
      await fetchData();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleSaveVoicemailSettings = async () => {
    try {
      setSaving(true);
      setError(null);
      setSuccess(false);

      const response = await fetch("/api/telephony/voicemail/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          externalPhoneNumber: externalPhoneNumber || undefined,
          voicemailEnabled,
          voicemailMode: voicemailEnabled ? "voicemail_only" : "none",
          forwardingEnabled: voicemailEnabled ? forwardingEnabled : false,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update voicemail settings");
      }

      if (data.ok) {
        setForwardingEnabled(data.settings.forwardingEnabled);
        setForwardingConfirmed(data.settings.forwardingConfirmed);
        setSuccess(true);
        setTimeout(() => setSuccess(false), 3000);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmForwarding = async () => {
    try {
      const response = await fetch("/api/telephony/voicemail/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          forwardingConfirmed: true,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to confirm forwarding");
      }

      if (data.ok) {
        setForwardingConfirmed(true);
      }
    } catch (err: any) {
      console.error("Error confirming forwarding:", err);
      throw err;
    }
  };

  const handlePreviewVoice = async (voiceKey: AlohaVoiceKey) => {
    setPreviewingVoiceKey(voiceKey);

    try {
      const response = await fetch("/api/aloha/voice-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice_key: voiceKey }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate voice preview");
      }

      const data = await response.json();
      if (data.ok && data.audioUrl) {
        const audio = new Audio(data.audioUrl);
        audio.play();

        audio.onended = () => {
          setPreviewingVoiceKey(null);
        };

        audio.onerror = () => {
          setPreviewingVoiceKey(null);
          setError("Failed to play voice preview");
        };
      }
    } catch (err: any) {
      console.error("Error previewing voice:", err);
      setPreviewingVoiceKey(null);
      setError(err.message || "Failed to preview voice");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-slate-500">Loading Aloha settings...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl mx-auto p-6">
      <header>
        <button
          onClick={() => router.back()}
          className="text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 mb-4"
        >
          ← Back
        </button>
        <p className="text-sm uppercase tracking-widest text-slate-500">Aloha Agent</p>
        <h1 className="text-3xl font-semibold">Settings</h1>
        <p className="text-slate-600 dark:text-slate-400 mt-2">
          Configure your Aloha phone agent, voice, and voicemail settings
        </p>
      </header>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 dark:border-red-800 dark:bg-red-900/20 dark:text-red-200">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-green-800 dark:border-green-800 dark:bg-green-900/20 dark:text-green-200">
          Settings saved successfully!
        </div>
      )}

      <div className="space-y-6">
        {/* Phone Number Selection Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Phone Number</h2>
          
          {phoneNumber ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-slate-600 dark:text-slate-400">Your active Aloha number:</p>
                  <p className="text-lg font-mono font-semibold text-slate-900 dark:text-slate-100 mt-1">
                    {phoneNumber.phone_number}
                  </p>
                </div>
                <button
                  onClick={handleReleaseNumber}
                  className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-900/20"
                >
                  Release Number
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
                Choose a phone number for Aloha to use. You can search by area code or get a random number.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Country
                  </label>
                  <select
                    value={country}
                    onChange={(e) => setCountry(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  >
                    <option value="US">United States</option>
                    <option value="CA">Canada</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Area Code (optional)
                  </label>
                  <input
                    type="text"
                    value={areaCode}
                    onChange={(e) => setAreaCode(e.target.value.replace(/\D/g, "").slice(0, 3))}
                    placeholder="e.g., 415"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                  />
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handleSearchNumbers}
                  disabled={searchingNumbers}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700 disabled:opacity-50"
                >
                  <Search size={16} />
                  {searchingNumbers ? "Searching..." : "Search Numbers"}
                </button>
                <button
                  onClick={handleGetRandomNumber}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-lg hover:bg-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:hover:bg-slate-700"
                >
                  <Shuffle size={16} />
                  Random Number
                </button>
              </div>

              {availableNumbers.length > 0 && (
                <div className="space-y-2 mt-4">
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Available Numbers:</p>
                  <div className="space-y-2">
                    {availableNumbers.map((num) => (
                      <div
                        key={num.phoneNumber}
                        className="flex items-center justify-between p-3 border border-slate-200 rounded-lg dark:border-slate-700"
                      >
                        <div>
                          <p className="font-mono font-semibold text-slate-900 dark:text-slate-100">
                            {num.phoneNumber}
                          </p>
                          {num.friendlyName && (
                            <p className="text-xs text-slate-500 dark:text-slate-400">{num.friendlyName}</p>
                          )}
                        </div>
                        <button
                          onClick={() => handlePurchaseNumber(num.phoneNumber)}
                          disabled={purchasingNumber === num.phoneNumber}
                          className="px-3 py-1.5 text-sm font-medium text-white bg-brand-accent rounded-lg hover:bg-brand-accent/90 disabled:opacity-50"
                        >
                          {purchasingNumber === num.phoneNumber ? "Purchasing..." : "Use this number"}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Aloha as Voicemail Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Aloha as Voicemail</h2>
          
          {!phoneNumber ? (
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-800">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                You need to choose an Aloha number before enabling voicemail.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Your Phone Number (for call forwarding)
                </label>
                <input
                  type="tel"
                  value={externalPhoneNumber}
                  onChange={(e) => setExternalPhoneNumber(e.target.value)}
                  placeholder="+1 (555) 123-4567"
                  className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
                />
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Your real phone number that will forward calls to Aloha
                </p>
              </div>

              <div className="flex items-start gap-3">
                <input
                  type="checkbox"
                  id="voicemail-enabled"
                  checked={voicemailEnabled}
                  onChange={(e) => {
                    setVoicemailEnabled(e.target.checked);
                    if (!e.target.checked) {
                      setForwardingEnabled(false);
                    }
                  }}
                  className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                />
                <label htmlFor="voicemail-enabled" className="flex-1">
                  <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                    Enable Aloha as my voicemail
                  </span>
                  <span className="text-xs text-slate-500 dark:text-slate-400">
                    Aloha will answer missed calls and collect messages
                  </span>
                </label>
              </div>

              {voicemailEnabled && (
                <div className="space-y-4 pl-8 border-l-2 border-slate-200 dark:border-slate-700">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      id="forwarding-enabled"
                      checked={forwardingEnabled}
                      onChange={(e) => setForwardingEnabled(e.target.checked)}
                      className="mt-1 h-5 w-5 rounded border-slate-300 text-brand-accent focus:ring-brand-accent"
                    />
                    <label htmlFor="forwarding-enabled" className="flex-1">
                      <span className="block text-sm font-medium text-slate-700 dark:text-slate-300">
                        I&apos;ll use call forwarding from my phone to send missed calls to Aloha
                      </span>
                    </label>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setShowForwardingModal(true)}
                      className="text-sm text-brand-accent hover:underline"
                    >
                      How do I set this up?
                    </button>
                  </div>

                  <div className="text-sm">
                    {forwardingConfirmed ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Check size={16} />
                        <span>Forwarding marked as set up.</span>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400">
                        Forwarding not yet confirmed.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <button
                onClick={handleSaveVoicemailSettings}
                disabled={saving || !voicemailEnabled || !externalPhoneNumber.trim()}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-accent rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? "Saving..." : "Save Voicemail Settings"}
              </button>
            </div>
          )}
        </section>

        {/* Agent Name Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Agent Name</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            How should Aloha introduce itself during calls?
          </p>
          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              Display Name
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Aloha"
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
            <p className="text-xs text-slate-500">
              Example: &quot;Sarah&quot;, &quot;Alex&quot;, &quot;Reception&quot;, or &quot;Sarah from [Your Business Name]&quot;
            </p>
          </div>
        </section>

        {/* Voice Selection Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">Voice Selection</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            Choose how Aloha sounds during calls. Each voice has a distinct style and personality.
            Aloha&apos;s behavior and personality stay the same; only the voice changes.
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            {voiceProfiles.map((voiceProfile) => (
              <VoiceProfileCard
                key={voiceProfile.key}
                voiceProfile={voiceProfile}
                isSelected={selectedVoiceKey === voiceProfile.key}
                isPreviewing={previewingVoiceKey === voiceProfile.key}
                onSelect={() => setSelectedVoiceKey(voiceProfile.key)}
                onPreview={() => handlePreviewVoice(voiceProfile.key)}
              />
            ))}
          </div>
        </section>

        {/* Conversation Intelligence Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <Brain className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Conversation Intelligence</h2>
              <p className="text-xs text-slate-500">Automatic intent classification & understanding</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Always Enabled</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Question Types</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Pricing, Availability, Services, Appointments, Hours, Location, Contact, Policy</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Statement Types</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Complaint, Praise, Confusion, Correction, Information Provided</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Emotional States</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Happy, Neutral, Upset, Angry, Stressed, Frustrated, Confused</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">Call Flow Intents</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Wants Callback, Wants Email, Wants Appointment, Wants Reschedule</p>
              </div>
            </div>
          </div>
        </section>

        {/* Natural Voice Dynamics Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
              <MessageSquare className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Natural Voice Dynamics</h2>
              <p className="text-xs text-slate-500">Human-like speech patterns & flow</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Always Enabled</span>
          </div>
          
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Micro pauses between clauses for natural flow
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Context-aware natural disfluencies (sparingly)
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Softening phrases for gentle communication
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Emotion-aware tone adjustments
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              Varies sentence lengths for natural rhythm
            </li>
          </ul>
        </section>

        {/* Emotional Intelligence Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <Heart className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Emotional Intelligence</h2>
              <p className="text-xs text-slate-500">Empathetic response shaping based on caller emotions</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Always Enabled</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Upset Callers</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Gentle tone, acknowledgment, softer language</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Angry Callers</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">De-escalation, neutral clarity, acknowledges frustration</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Stressed Callers</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Slow pace, reassurance, &quot;No worries&quot; phrases</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Confused Callers</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Explicit guidance, broken-down instructions, clarifying phrases</p>
            </div>
          </div>
        </section>

        {/* Communication Resilience Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
              <Shield className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Communication Resilience</h2>
              <p className="text-xs text-slate-500">Handles connection issues & silence gracefully</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Always Enabled</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Bad Connection Detection</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Automatically detects low STT confidence and inaudible segments, prompts for repetition</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Silence Handling</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                <p>• 2-3 seconds: &quot;Are you still there?&quot;</p>
                <p>• 6-7 seconds: &quot;It might be a quiet moment, no rush.&quot;</p>
                <p>• 10+ seconds: Graceful call ending</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">Talkative Caller Management</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">Politely redirects long responses back to campaign goal</p>
            </div>
          </div>
        </section>

        {/* Contact Memory Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
              <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">Contact Memory</h2>
              <p className="text-xs text-slate-500">Lightweight per-phone-number memory for personalized conversations</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Always Enabled</span>
          </div>
          
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Remembers caller name and basic preferences per phone number
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Enforces do-not-call flags automatically
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Adjusts greetings based on previous interactions
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              Tracks call frequency and outcomes
            </li>
          </ul>
          
          <Link
            href="/aloha/contacts"
            className="inline-block text-sm text-brand-accent hover:underline font-medium"
          >
            Manage Contacts →
          </Link>
        </section>

        {/* End-of-Call Intelligence Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">End-of-Call Intelligence</h2>
              <p className="text-xs text-slate-500">Graceful call endings with context awareness</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">Always Enabled</span>
          </div>
          
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Detects exit intent (explicit and implicit)
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Checks for additional needs before closing
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Context-aware closing messages (standard, upset, bad connection)
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              Respectful endings that honor caller&apos;s time
            </li>
          </ul>
        </section>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSaveVoiceSettings}
            disabled={saving || !displayName.trim() || !selectedVoiceKey}
            className="px-6 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? "Saving..." : "Save Settings"}
          </button>
        </div>
      </div>

      {/* Call Forwarding Modal */}
      {phoneNumber && (
        <CallForwardingModal
          open={showForwardingModal}
          onClose={() => setShowForwardingModal(false)}
          alohaPhoneNumber={phoneNumber.phone_number}
          onConfirmSetup={handleConfirmForwarding}
        />
      )}
    </div>
  );
}

interface VoiceProfileCardProps {
  voiceProfile: AlohaVoiceProfile;
  isSelected: boolean;
  isPreviewing: boolean;
  onSelect: () => void;
  onPreview: () => void;
}

function VoiceProfileCard({
  voiceProfile,
  isSelected,
  isPreviewing,
  onSelect,
  onPreview,
}: VoiceProfileCardProps) {
  return (
    <div
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all ${
        isSelected
          ? "border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <h3 className="font-semibold text-lg">{voiceProfile.label}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">
            {voiceProfile.description}
          </p>
        </div>
        {isSelected && (
          <div className="ml-2 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-3">
        <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
          {voiceProfile.tonePreset}
        </span>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          disabled={isPreviewing}
          className="text-xs px-3 py-1 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 disabled:opacity-50 transition-colors"
        >
          {isPreviewing ? "Playing..." : "Preview"}
        </button>
      </div>
    </div>
  );
}

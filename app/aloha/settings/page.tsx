"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  getAllVoiceProfiles,
  getVoicePreviewScript,
  DEFAULT_VOICE_KEY,
  getVoicePreviewAssetPath,
  type AlohaVoiceKey,
  type AlohaVoiceProfile,
} from "@/lib/aloha/voice-profiles";
import type { AlohaProfile } from "@/types/database";
import CallForwardingModal from "@/components/modals/CallForwardingModal";
import Modal from "@/components/ui/Modal";
import {
  Search,
  Shuffle,
  X,
  Check,
  Brain,
  MessageSquare,
  Heart,
  Shield,
  Users,
  Clock,
  Play,
  Square,
  AlertTriangle,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

type VoicePreviewSourcesMap = Partial<
  Record<
    AlohaVoiceKey,
    {
      objectUrl: string;
      playbackUrl: string;
      sampleText: string;
      version: number;
    }
  >
>;

export default function AlohaSettingsPage() {
  const router = useRouter();
  const t = useTranslation();
  const [profile, setProfile] = useState<AlohaProfile | null>(null);
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  
  // Voice settings
  const [displayName, setDisplayName] = useState("");
  const [selectedVoiceKey, setSelectedVoiceKey] = useState<AlohaVoiceKey>(DEFAULT_VOICE_KEY);
  const [previewingVoiceKey, setPreviewingVoiceKey] = useState<AlohaVoiceKey | null>(null);
  const [voicePreviewSources, setVoicePreviewSources] = useState<VoicePreviewSourcesMap>({});
  const [previewGenerationStatus, setPreviewGenerationStatus] =
    useState<Partial<Record<AlohaVoiceKey, "idle" | "pending">>>({});
  const [previewToast, setPreviewToast] = useState<string | null>(null);

  // Twilio health check
  const [twilioHealth, setTwilioHealth] = useState<{
    status: "ok" | "error" | null;
    message?: string;
    number?: string | null;
    checks?: {
      exists: boolean;
      webhookConfigured: boolean;
      webhookUrl: string | null;
      expectedWebhook: string | null;
      voiceMethodCorrect: boolean;
    };
  } | null>(null);
  const [twilioHealthLoading, setTwilioHealthLoading] = useState(false);

  // Phone number selection
  const [country, setCountry] = useState("US");
  const [areaCode, setAreaCode] = useState("");
  const [searchingNumbers, setSearchingNumbers] = useState(false);
  const [availableNumbers, setAvailableNumbers] = useState<Array<{ phoneNumber: string; friendlyName?: string }>>([]);
  const [randomNumber, setRandomNumber] = useState<string | null>(null);
  const [purchasingNumber, setPurchasingNumber] = useState<string | null>(null);
  const [pendingNumberToChange, setPendingNumberToChange] = useState<string | null>(null);
  const [showChangeNumberConfirm, setShowChangeNumberConfirm] = useState(false);

  // Voicemail settings
  const [externalPhoneNumber, setExternalPhoneNumber] = useState("");
  const [voicemailEnabled, setVoicemailEnabled] = useState(false);
  const [forwardingEnabled, setForwardingEnabled] = useState(false);
  const [forwardingConfirmed, setForwardingConfirmed] = useState(false);
  const [showForwardingModal, setShowForwardingModal] = useState(false);

  const voiceProfiles = useMemo(() => getAllVoiceProfiles(), []);
  const trimmedDisplayName = displayName.trim();
  // Use display name, otherwise default to "Aloha"
  const previewName = trimmedDisplayName || "Aloha";
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const voicePreviewSourcesRef = useRef<VoicePreviewSourcesMap>({});
  const pendingPreviewRequestsRef =
    useRef<Partial<Record<AlohaVoiceKey, AbortController | null>>>({});
  const previewRegenerationTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);
  const previewToastTimeoutRef =
    useRef<ReturnType<typeof setTimeout> | null>(null);

  const stopCurrentAudio = () => {
    if (audioRef.current) {
      try {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      } catch (error) {
        console.warn("Error stopping audio:", error);
      }
      audioRef.current = null;
    }
  };

  const playAudioElement = async (audio: HTMLAudioElement, voiceKey: AlohaVoiceKey) => {
    audioRef.current = audio;

    const finalizePlayback = () => {
      if (audioRef.current === audio) {
        audioRef.current = null;
      }
      setPreviewingVoiceKey((current) => (current === voiceKey ? null : current));
    };

    audio.onended = finalizePlayback;
    audio.onerror = (event) => {
      console.error("Audio playback error:", event, audio.error);
      const errorCode = audio.error?.code;
      let message = "Failed to play voice preview.";
      if (errorCode === 4) {
        message = "Audio format not supported. Please try a different browser.";
      } else if (errorCode === 2) {
        message = "Network error loading audio. Please check your connection.";
      } else if (errorCode === 3) {
        message = "Audio decoding failed. Please try again.";
      }
      setError(message);
      finalizePlayback();
    };

    // Set preload and load the audio
    audio.preload = "auto";
    
    try {
      // Load the audio first
      audio.load();
      
      // Wait for audio to be ready to play
      await new Promise<void>((resolve, reject) => {
        const handleCanPlay = () => {
          audio.removeEventListener("canplaythrough", handleCanPlay);
          audio.removeEventListener("error", handleError);
          resolve();
        };
        
        const handleError = () => {
          audio.removeEventListener("canplaythrough", handleCanPlay);
          audio.removeEventListener("error", handleError);
          reject(new Error("Audio failed to load"));
        };
        
        // Check if already ready
        if (audio.readyState >= 3) { // HAVE_FUTURE_DATA or higher
          resolve();
        } else {
          audio.addEventListener("canplaythrough", handleCanPlay, { once: true });
          audio.addEventListener("error", handleError, { once: true });
          
          // Timeout after 5 seconds
          setTimeout(() => {
            audio.removeEventListener("canplaythrough", handleCanPlay);
            audio.removeEventListener("error", handleError);
            reject(new Error("Audio loading timeout"));
          }, 5000);
        }
      });
      
      // Now attempt to play
      await audio.play();
    } catch (playError: any) {
      console.error("Error playing audio:", playError);
      
      // Handle autoplay restrictions
      if (playError.name === "NotAllowedError" || playError.name === "NotSupportedError") {
        setError(
          "Browser blocked audio playback. Please click the preview button again to allow audio."
        );
      } else {
        setError(
          "Could not play audio. Please check your browser's audio settings and try again."
        );
      }
      
      finalizePlayback();
      throw playError;
    }
  };

  const showPreviewToast = useCallback((message: string) => {
    setPreviewToast(message);
    if (previewToastTimeoutRef.current) {
      clearTimeout(previewToastTimeoutRef.current);
    }
    previewToastTimeoutRef.current = setTimeout(() => {
      setPreviewToast(null);
    }, 4000);
  }, []);

  const base64ToBlob = useCallback((base64: string, contentType: string) => {
    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i += 1) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    return new Blob([byteArray], { type: contentType });
  }, []);

  const updateVoicePreviewSource = useCallback(
    (voiceKey: AlohaVoiceKey, sampleText: string, blob: Blob) => {
      const objectUrl = URL.createObjectURL(blob);
      const version = Date.now();
      const playbackUrl = `${objectUrl}?v=${version}`;

      setVoicePreviewSources((prev) => {
        const previousEntry = prev[voiceKey];
        if (previousEntry?.objectUrl) {
          URL.revokeObjectURL(previousEntry.objectUrl);
        }
        return {
          ...prev,
          [voiceKey]: {
            objectUrl,
            playbackUrl,
            sampleText,
            version,
          },
        };
      });
    },
    []
  );

  const queueVoicePreviewRegeneration = useCallback(
    (voiceKey: AlohaVoiceKey, sampleText: string) => {
      const normalizedText = sampleText.trim();
      if (!normalizedText) {
        return;
      }

      const currentEntry = voicePreviewSourcesRef.current[voiceKey];
      if (currentEntry && currentEntry.sampleText === normalizedText) {
        return;
      }

      const previousController = pendingPreviewRequestsRef.current[voiceKey];
      if (previousController) {
        previousController.abort();
      }

      const controller = new AbortController();
      pendingPreviewRequestsRef.current[voiceKey] = controller;

      setPreviewGenerationStatus((prev) => ({
        ...prev,
        [voiceKey]: "pending",
      }));

      fetch("/api/voice-preview", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voiceKey,
          sampleText: normalizedText,
        }),
        signal: controller.signal,
      })
        .then(async (response) => {
          // Handle aborted requests (status 499)
          if (response.status === 499) {
            return;
          }
          
          // Handle empty responses (aborted)
          if (response.status === 0 || !response.ok) {
            const data = await response.json().catch(() => null);
            if (!data) {
              // Empty or invalid response, likely aborted
              return;
            }
            
            // Handle structured error response
            const errorMessage = data?.error?.messageKey
              ? t(data.error.messageKey)
              : data?.error?.defaultMessage || data?.error || "Failed to regenerate preview";
            throw new Error(errorMessage);
          }
          
          const data = await response.json();
          if (!data?.ok || !data.audioBase64) {
            // Handle structured error response
            const errorMessage = data?.error?.messageKey
              ? t(data.error.messageKey)
              : data?.error?.defaultMessage || data?.error || "Failed to regenerate preview";
            throw new Error(errorMessage);
          }

          const blob = base64ToBlob(
            data.audioBase64,
            data.contentType || "audio/mpeg"
          );
          updateVoicePreviewSource(voiceKey, normalizedText, blob);
        })
        .catch((requestError) => {
          // Silently ignore aborted requests
          if (requestError?.name === "AbortError" || requestError?.code === "ECONNRESET") {
            return;
          }
          console.error("Voice preview regeneration error:", requestError);
          showPreviewToast(
            "Could not refresh the preview audio. Still using the previous clip."
          );
        })
        .finally(() => {
          const activeController = pendingPreviewRequestsRef.current[voiceKey];
          if (activeController === controller) {
            pendingPreviewRequestsRef.current[voiceKey] = null;
          }
          setPreviewGenerationStatus((prev) => ({
            ...prev,
            [voiceKey]: "idle",
          }));
        });
    },
    [base64ToBlob, showPreviewToast, updateVoicePreviewSource, t]
  );

  useEffect(() => {
    voicePreviewSourcesRef.current = voicePreviewSources;
  }, [voicePreviewSources]);

  // We intentionally run the initial data fetch only once on mount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (!voiceProfiles.length) {
      return;
    }

    if (previewRegenerationTimeoutRef.current) {
      clearTimeout(previewRegenerationTimeoutRef.current);
    }

    previewRegenerationTimeoutRef.current = setTimeout(() => {
      voiceProfiles.forEach((voiceProfile) => {
        const sampleText = getVoicePreviewScript(voiceProfile.key, previewName);
        queueVoicePreviewRegeneration(voiceProfile.key, sampleText);
      });
    }, 350);

    return () => {
      if (previewRegenerationTimeoutRef.current) {
        clearTimeout(previewRegenerationTimeoutRef.current);
      }
    };
  }, [previewName, voiceProfiles, queueVoicePreviewRegeneration]);

  useEffect(() => {
    // Capture ref values at effect setup time for cleanup
    const pendingRequests = pendingPreviewRequestsRef.current;
    const voiceSources = voicePreviewSourcesRef.current;

    return () => {
      stopCurrentAudio();

      if (previewRegenerationTimeoutRef.current) {
        clearTimeout(previewRegenerationTimeoutRef.current);
      }

      if (previewToastTimeoutRef.current) {
        clearTimeout(previewToastTimeoutRef.current);
      }

      Object.values(pendingRequests).forEach((controller) => {
        controller?.abort();
      });

      Object.values(voiceSources).forEach((entry) => {
        if (entry?.objectUrl) {
          URL.revokeObjectURL(entry.objectUrl);
        }
      });
    };
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
          const fetchedDisplayName = (profileData.profile.display_name || "Aloha").trim();
          setDisplayName(fetchedDisplayName);
          setSelectedVoiceKey(
            (profileData.profile.voice_key as AlohaVoiceKey) || DEFAULT_VOICE_KEY
          );
        }
      }

      // Fetch phone number (one per user)
      const phoneResponse = await fetch("/api/user/phone-number");
      if (phoneResponse.ok) {
        const phoneData = await phoneResponse.json();
        setPhoneNumber(phoneData.phoneNumber || null);
      }

      // Fetch voicemail settings independently
      const voicemailResponse = await fetch("/api/telephony/voicemail/settings");
      if (voicemailResponse.ok) {
        const voicemailData = await voicemailResponse.json();
        if (voicemailData.ok && voicemailData.settings) {
          setExternalPhoneNumber(voicemailData.settings.externalPhoneNumber || "");
          setVoicemailEnabled(!!voicemailData.settings.voicemailEnabled);
          setForwardingEnabled(!!voicemailData.settings.forwardingEnabled);
          setForwardingConfirmed(!!voicemailData.settings.forwardingConfirmed);
        }
      }

      // Fetch Twilio number health
      await fetchTwilioHealth();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchTwilioHealth = async () => {
    try {
      setTwilioHealthLoading(true);
      const response = await fetch("/api/twilio/health");
      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setTwilioHealth({
          status: "error",
          message: data?.message || "Failed to check Twilio health.",
        });
        return;
      }

      setTwilioHealth({
        status: data.status,
        message: data.message,
        number: data.number,
        checks: data.checks || null,
      });
    } catch (err: any) {
      console.error("Error fetching Twilio health:", err);
      setTwilioHealth({
        status: "error",
        message: err.message || "Failed to check Twilio health.",
      });
    } finally {
      setTwilioHealthLoading(false);
    }
  };

  const handleSaveVoiceSettings = async () => {
    if (!trimmedDisplayName) {
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
          display_name: trimmedDisplayName,
          // Keep self-name wiring unified with Agent Name
          aloha_self_name: trimmedDisplayName,
          voice_key: selectedVoiceKey,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to update profile");
      }

      if (data.ok && data.profile) {
        setProfile(data.profile);
        setDisplayName(trimmedDisplayName);

        // If voice pack was regenerated, update the preview sources
        if (data.voicePack) {
          const blob = base64ToBlob(
            data.voicePack.audioBase64,
            data.voicePack.contentType || "audio/mpeg"
          );
          // Calculate effective name for preview (use self-name if set, otherwise display name, otherwise "Aloha")
          const effectiveName = trimmedDisplayName || "Aloha";
          // Update preview for the selected voice
          updateVoicePreviewSource(selectedVoiceKey, getVoicePreviewScript(selectedVoiceKey, effectiveName), blob);
        }
        
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
        `/api/phone-numbers/available?country=${country}${areaCode ? `&areaCode=${areaCode}` : ""}`
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
      const response = await fetch("/api/user/phone-number/random", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country,
          areaCode: areaCode || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      
      if (!response.ok) {
        throw new Error(
          data?.error || "Could not assign a random number. Please try again."
        );
      }
      
      setPhoneNumber(data.phoneNumber || null);
      setRandomNumber(null);
      setAvailableNumbers([]);
      // Re-run health check so user sees fresh status
      await fetchTwilioHealth();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handlePurchaseNumber = async (phoneNumberToPurchase: string) => {
    try {
      setError(null);

      // If user already has a number, this is a change → show confirmation first
      if (phoneNumber) {
        setPendingNumberToChange(phoneNumberToPurchase);
        setShowChangeNumberConfirm(true);
        return;
      }

      // First-time assignment (no monthly limit)
      setPurchasingNumber(phoneNumberToPurchase);
      
      const response = await fetch("/api/user/phone-number", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: phoneNumberToPurchase,
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

  const confirmChangeNumber = async () => {
    if (!pendingNumberToChange) return;
    try {
      setPurchasingNumber(pendingNumberToChange);
      setError(null);

      const response = await fetch("/api/user/phone-number", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: pendingNumberToChange,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        // Surface monthly limit or other business-rule errors clearly
        throw new Error(
          data?.error ||
            "Failed to change number. You may have reached the monthly change limit."
        );
      }

      await fetchData();
      setAvailableNumbers([]);
      setRandomNumber(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setPurchasingNumber(null);
      setPendingNumberToChange(null);
      setShowChangeNumberConfirm(false);
    }
  };

  const handleReleaseNumber = async () => {
    if (!confirm("Are you sure you want to release your Aloha number? This will disable voicemail and forwarding.")) {
      return;
    }

    try {
      setError(null);
      const response = await fetch("/api/user/phone-number", {
        method: "DELETE",
      });
      
      if (!response.ok && response.status !== 204) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.error || "Failed to release number");
      }
      
      // Refresh phone number and voicemail data
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
    if (previewingVoiceKey === voiceKey) {
      stopCurrentAudio();
      setPreviewingVoiceKey(null);
      return;
    }

    stopCurrentAudio();
    setPreviewingVoiceKey(voiceKey);
    setError(null);

    const cacheEntry = voicePreviewSources[voiceKey];
    const fallbackUrl = getVoicePreviewAssetPath(voiceKey);
    const playbackUrl = cacheEntry
      ? cacheEntry.playbackUrl
      : `${fallbackUrl}?v=static`;

    // Create audio element
    const audio = new Audio(playbackUrl);
    
    // Set crossOrigin to handle CORS if needed
    audio.crossOrigin = "anonymous";
    
    try {
      await playAudioElement(audio, voiceKey);
    } catch (playError: any) {
      console.error("Error playing voice preview:", playError);
      
      // If it's an autoplay error, don't clear the previewing state
      // so user can try again
      if (playError.name === "NotAllowedError" || playError.name === "NotSupportedError") {
        // Keep previewing state so user can retry
        return;
      }
      
      setPreviewingVoiceKey(null);
      // Error message is already set in playAudioElement
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
    <>
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
                    {phoneNumber}
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

        {/* Phone Number Health Check */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xl font-semibold">Phone Number Health Check</h2>
            <button
              onClick={fetchTwilioHealth}
              disabled={twilioHealthLoading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"
            >
              {twilioHealthLoading ? "Checking..." : "Recheck"}
            </button>
          </div>

          {twilioHealth?.status === "ok" ? (
            <div className="flex items-start gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 dark:border-emerald-900 dark:bg-emerald-900/20">
              <div className="mt-0.5">
                <Check className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  Your Twilio number is correctly connected to Aloha.
                </p>
                {twilioHealth.number && (
                  <p className="mt-1 text-xs font-mono text-emerald-800 dark:text-emerald-200">
                    {twilioHealth.number}
                  </p>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex items-start gap-3 rounded-2xl border border-red-200 bg-red-50 p-4 dark:border-red-900 dark:bg-red-900/20">
                <div className="mt-0.5">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                    Your Twilio number is not fully connected to Aloha.
                  </p>
                  <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                    {twilioHealth?.message ||
                      "One or more configuration checks failed. See details below."}
                  </p>
                </div>
              </div>

              {twilioHealth?.checks && (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-200">
                  <ul className="space-y-1">
                    <li>
                      <span className="font-semibold">Twilio number exists:</span>{" "}
                      {twilioHealth.checks.exists ? "Yes" : "No"}
                    </li>
                    <li>
                      <span className="font-semibold">Webhook configured:</span>{" "}
                      {twilioHealth.checks.webhookConfigured ? "Yes" : "No"}
                    </li>
                    <li className="break-all">
                      <span className="font-semibold">Current webhook URL:</span>{" "}
                      {twilioHealth.checks.webhookUrl || "N/A"}
                    </li>
                    <li className="break-all">
                      <span className="font-semibold">Expected webhook URL:</span>{" "}
                      {twilioHealth.checks.expectedWebhook || "N/A"}
                    </li>
                    <li>
                      <span className="font-semibold">Voice method is POST:</span>{" "}
                      {twilioHealth.checks.voiceMethodCorrect ? "Yes" : "No"}
                    </li>
                  </ul>
                </div>
              )}

              <div className="flex items-center justify-between">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  If the health check fails, you can attempt an automatic fix.
                </p>
                <button
                  onClick={async () => {
                    try {
                      setError(null);
                      const response = await fetch("/api/twilio/fix", {
                        method: "POST",
                      });
                      const data = await response.json().catch(() => null);
                      if (!response.ok || !data?.success) {
                        throw new Error(
                          data?.error || "Failed to fix Twilio configuration."
                        );
                      }
                      await fetchTwilioHealth();
                    } catch (err: any) {
                      setError(err.message);
                    }
                  }}
                  className="px-3 py-1.5 text-xs font-medium rounded-lg bg-brand-accent text-white hover:bg-brand-accent/90"
                >
                  Fix It
                </button>
              </div>
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
                      {t("howToSetUp")}
                    </button>
                  </div>

                  <div className="text-sm">
                    {forwardingConfirmed ? (
                      <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                        <Check size={16} />
                        <span>{t("forwardingMarkedSetup")}</span>
                      </div>
                    ) : (
                      <p className="text-slate-500 dark:text-slate-400">
                        {t("forwardingNotConfirmed")}
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
                {saving ? t("saving") : t("saveVoicemailSettings")}
              </button>
            </div>
          )}
        </section>

        {/* Agent Name Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">{t("agentName")}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-4">
            {t("howShouldAlohaIntroduce")}
          </p>
          <div className="space-y-2">
            <label htmlFor="display-name" className="block text-sm font-medium text-slate-700 dark:text-slate-300">
              {t("displayName")}
            </label>
            <input
              id="display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder={t("displayNamePlaceholder")}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-brand-accent focus:border-transparent dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200"
            />
            <p className="text-xs text-slate-500">
              {t("displayNameExample")}
            </p>
          </div>
        </section>

        {/* Voice Selection Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <h2 className="text-xl font-semibold mb-4">{t("voiceSelection")}</h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 mb-6">
            {t("chooseHowAlohaSounds")}
          </p>
          
          <div className="grid gap-4 md:grid-cols-2">
            {voiceProfiles.map((voiceProfile) => (
              <VoiceProfileCard
                key={voiceProfile.key}
                voiceProfile={voiceProfile}
                isSelected={selectedVoiceKey === voiceProfile.key}
                isPreviewing={previewingVoiceKey === voiceProfile.key}
                isRefreshing={previewGenerationStatus[voiceProfile.key] === "pending"}
                previewScript={getVoicePreviewScript(voiceProfile.key, previewName)}
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
              <h2 className="text-xl font-semibold">{t("conversationIntelligence")}</h2>
              <p className="text-xs text-slate-500">{t("automaticIntentClassification")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{t("alwaysEnabled")}</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">{t("questionTypes")}</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Pricing, Availability, Services, Appointments, Hours, Location, Contact, Policy</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">{t("statementTypes")}</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Complaint, Praise, Confusion, Correction, Information Provided</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">{t("emotionalStates")}</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1">
                <p>Happy, Neutral, Upset, Angry, Stressed, Frustrated, Confused</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-2 text-slate-700 dark:text-slate-300">{t("callFlowIntents")}</p>
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
              <h2 className="text-xl font-semibold">{t("naturalVoiceDynamics")}</h2>
              <p className="text-xs text-slate-500">{t("humanLikeSpeech")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{t("alwaysEnabled")}</span>
          </div>
          
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t("microPauses")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t("contextAwareDisfluencies")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t("softeningPhrases")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t("emotionAwareTone")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
              {t("variesSentenceLengths")}
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
              <h2 className="text-xl font-semibold">{t("emotionalIntelligence")}</h2>
              <p className="text-xs text-slate-500">{t("empatheticResponse")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{t("alwaysEnabled")}</span>
          </div>
          
          <div className="grid gap-4 md:grid-cols-2">
            <div className="p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("upsetCallers")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("upsetCallersDesc")}</p>
            </div>
            <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("angryCallers")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("angryCallersDesc")}</p>
            </div>
            <div className="p-3 rounded-lg bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("stressedCallers")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("stressedCallersDesc")}</p>
            </div>
            <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("confusedCallers")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("confusedCallersDesc")}</p>
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
              <h2 className="text-xl font-semibold">{t("communicationResilience")}</h2>
              <p className="text-xs text-slate-500">{t("handlesConnectionIssues")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{t("alwaysEnabled")}</span>
          </div>
          
          <div className="space-y-3">
            <div>
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("badConnectionDetection")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("badConnectionDesc")}</p>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("silenceHandling")}</p>
              <div className="text-xs text-slate-600 dark:text-slate-400 space-y-1 ml-4">
                <p>{t("silence2to3")}</p>
                <p>{t("silence6to7")}</p>
                <p>{t("silence10Plus")}</p>
              </div>
            </div>
            <div>
              <p className="text-sm font-semibold mb-1 text-slate-700 dark:text-slate-300">{t("talkativeCallerManagement")}</p>
              <p className="text-xs text-slate-600 dark:text-slate-400">{t("talkativeCallerDesc")}</p>
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
              <h2 className="text-xl font-semibold">{t("contactMemory")}</h2>
              <p className="text-xs text-slate-500">{t("lightweightMemory")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{t("alwaysEnabled")}</span>
          </div>
          
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300 mb-4">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              {t("remembersCallerName")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              {t("enforcesDoNotCall")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              {t("adjustsGreetings")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
              {t("tracksCallFrequency")}
            </li>
          </ul>
          
          <Link
            href="/aloha/contacts"
            className="inline-block text-sm text-brand-accent hover:underline font-medium"
          >
            {t("manageContacts")}
          </Link>
        </section>

        {/* End-of-Call Intelligence Section */}
        <section className="rounded-3xl border border-slate-200 bg-white/80 p-6 dark:border-slate-800 dark:bg-slate-900/40">
          <div className="flex items-center gap-2 mb-4">
            <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-lg">
              <Clock className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold">{t("endOfCallIntelligence")}</h2>
              <p className="text-xs text-slate-500">{t("gracefulCallEndings")}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mb-6">
            <div className="w-2 h-2 bg-green-500 rounded-full" />
            <span className="text-sm font-medium text-green-600 dark:text-green-400">{t("alwaysEnabled")}</span>
          </div>
          
          <ul className="space-y-2 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              {t("detectsExitIntent")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              {t("checksAdditionalNeeds")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              {t("contextAwareClosing")}
            </li>
            <li className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full" />
              {t("respectfulEndings")}
            </li>
          </ul>
        </section>

        {/* Save Button */}
        <div className="flex items-center justify-end gap-4">
          <button
            onClick={() => router.back()}
            className="px-4 py-2 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
          >
            {t("cancel")}
          </button>
          <button
            onClick={handleSaveVoiceSettings}
            disabled={saving || !trimmedDisplayName || !selectedVoiceKey}
            className="px-6 py-2 bg-brand-accent text-white rounded-lg hover:bg-brand-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? t("saving") : t("saveSettings")}
          </button>
        </div>
      </div>

      {/* Call Forwarding Modal */}
      {phoneNumber && (
        <CallForwardingModal
          open={showForwardingModal}
          onClose={() => setShowForwardingModal(false)}
          alohaPhoneNumber={phoneNumber}
          onConfirmSetup={handleConfirmForwarding}
        />
      )}

      {/* Change Number Confirmation Modal */}
      <Modal
        title="Change Aloha number?"
        open={showChangeNumberConfirm}
        onClose={() => {
          if (!purchasingNumber) {
            setShowChangeNumberConfirm(false);
            setPendingNumberToChange(null);
          }
        }}
        description="You can only change your Aloha number once per month (UTC). This change will use your number change for the current month."
        size="md"
      >
        <div className="space-y-4">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              You can only change your Aloha number once per calendar month (UTC). Proceeding will use your change for this month.
            </p>
          {pendingNumberToChange && (
            <p className="text-sm">
              <span className="font-medium">New number:</span>{" "}
              <span className="font-mono">{pendingNumberToChange}</span>
            </p>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              onClick={() => {
                if (!purchasingNumber) {
                  setShowChangeNumberConfirm(false);
                  setPendingNumberToChange(null);
                }
              }}
              disabled={!!purchasingNumber}
            >
              Cancel
            </button>
            <button
              type="button"
              className="px-4 py-2 text-sm rounded-lg bg-brand-accent text-white hover:bg-brand-accent/90 disabled:opacity-50"
              onClick={confirmChangeNumber}
              disabled={!!purchasingNumber}
            >
              Yes, change my number
            </button>
          </div>
        </div>
      </Modal>
    </div>

      {previewToast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg">
          {previewToast}
        </div>
      )}
    </>
  );
}

interface VoiceProfileCardProps {
  voiceProfile: AlohaVoiceProfile;
  isSelected: boolean;
  isPreviewing: boolean;
  isRefreshing: boolean;
  previewScript: string;
  onSelect: () => void;
  onPreview: () => void;
}

function VoiceProfileCard({
  voiceProfile,
  isSelected,
  isPreviewing,
  isRefreshing,
  previewScript,
  onSelect,
  onPreview,
}: VoiceProfileCardProps) {
  const t = useTranslation();
  return (
    <div
      className={`rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col h-full min-h-[140px] ${
        isSelected
          ? "border-brand-accent bg-brand-accent/5 dark:bg-brand-accent/10"
          : "border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600"
      }`}
      onClick={onSelect}
    >
      <div className="flex items-start justify-between mb-2 flex-shrink-0">
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-lg leading-tight">{voiceProfile.label}</h3>
          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1 min-h-[40px] line-clamp-2">
            {voiceProfile.description}
          </p>
        </div>
        {isSelected && (
          <div className="ml-2 w-5 h-5 rounded-full bg-brand-accent flex items-center justify-center flex-shrink-0">
            <Check className="w-3 h-3 text-white" />
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 mt-auto pt-3 flex-shrink-0">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onPreview();
          }}
          className="inline-flex items-center justify-center gap-1 text-xs px-3 py-1.5 rounded bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-300 dark:hover:bg-slate-600 transition-colors min-w-[80px] h-[28px]"
        >
          {isPreviewing ? (
            <>
              <Square className="w-3 h-3 fill-current" />
              {t("stop")}
            </>
          ) : (
            <>
              <Play className="w-3 h-3 fill-current" />
              {t("preview")}
            </>
          )}
        </button>
        {isRefreshing && (
          <span className="text-[10px] font-semibold uppercase tracking-widest text-amber-500">
            Updating…
          </span>
        )}
        <span className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 whitespace-nowrap">
          {voiceProfile.tonePreset}
        </span>
      </div>
      <p className="mt-3 text-xs italic text-slate-500 dark:text-slate-400">
        &ldquo;{previewScript}&rdquo;
      </p>
    </div>
  );
}

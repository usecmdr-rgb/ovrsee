"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAppState } from "@/context/AppStateContext";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { CheckCircle, XCircle, Loader2, AlertCircle } from "lucide-react";

type ActivationState =
  | "loading" // Checking auth/token
  | "verifying" // Calling accept-invite API
  | "success" // Successfully activated
  | "error"; // Error occurred

export default function ActivateSeatPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { isAuthenticated, openAuthModal } = useAppState();
  const [state, setState] = useState<ActivationState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    workspaceName: string;
    planName: string;
  } | null>(null);

  const token = searchParams.get("token") || sessionStorage.getItem("activation_token");

  useEffect(() => {
    // Get token from URL or sessionStorage
    const urlToken = searchParams.get("token");
    if (urlToken) {
      sessionStorage.setItem("activation_token", urlToken);
    }

    const currentToken = urlToken || sessionStorage.getItem("activation_token");

    if (!currentToken) {
      setError("Missing activation token");
      setState("error");
      return;
    }

    // Check if user is authenticated
    const checkAuthAndActivate = async () => {
      try {
        const {
          data: { session },
        } = await supabaseBrowserClient.auth.getSession();

        if (!session) {
          // User not authenticated - show message and allow signup/login
          setState("loading"); // Keep loading state while waiting for auth
          return;
        }

        // User is authenticated - proceed with activation
        await activateInvite(currentToken);
      } catch (err: any) {
        console.error("Error checking auth:", err);
        setError(err.message || "An error occurred");
        setState("error");
      }
    };

    checkAuthAndActivate();
  }, [searchParams]);

  // Handle auth state change - when user logs in or signs up, activate the invite
  useEffect(() => {
    const storedToken = sessionStorage.getItem("activation_token") || token;
    if (isAuthenticated && (state === "loading" || state === "verifying") && storedToken) {
      // User just authenticated - activate the invite
      // Use a small delay to ensure session is fully established
      const timer = setTimeout(() => {
        activateInvite(storedToken);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, state, token]);

  const activateInvite = async (inviteToken: string) => {
    setState("verifying");

    try {
      const response = await fetch("/api/workspaces/accept-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ token: inviteToken }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error codes
        if (data.code === "EMAIL_MISMATCH") {
          setError(
            "This invitation was sent to a different email address. Please sign in with the email address that received the invitation."
          );
        } else if (data.code === "ALREADY_ACCEPTED") {
          setError("This invitation has already been accepted.");
        } else {
          setError(data.error || "Failed to activate invitation");
        }
        setState("error");
        return;
      }

      // Success
      setSuccessData({
        workspaceName: data.data?.workspaceName || "the workspace",
        planName: data.data?.planCode
          ? data.data.planCode === "essentials"
            ? "Essentials"
            : data.data.planCode === "professional"
            ? "Professional"
            : "Executive"
          : "your plan",
      });
      setState("success");

      // Clear stored token
      sessionStorage.removeItem("activation_token");

      // Redirect to dashboard after 3 seconds
      setTimeout(() => {
        router.push("/dashboard");
      }, 3000);
    } catch (err: any) {
      console.error("Error activating invite:", err);
      setError(err.message || "Failed to activate invitation");
      setState("error");
    }
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            {!isAuthenticated ? (
              <>
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Activate Your Seat
                </h2>
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  You&apos;ve been invited to join a workspace. Please sign in or create an account to activate your seat.
                </p>
                <div className="mt-2 rounded-lg bg-blue-50 p-3 dark:bg-blue-900/10">
                  <p className="text-xs text-blue-800 dark:text-blue-200 text-center">
                    <strong>Important:</strong> Use the email address that received this invitation when creating your account.
                  </p>
                </div>
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() => {
                      sessionStorage.setItem("activation_token", token || "");
                      openAuthModal("login");
                    }}
                    className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => {
                      sessionStorage.setItem("activation_token", token || "");
                      openAuthModal("signup");
                    }}
                    className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-900 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700"
                  >
                    Create Account
                  </button>
                </div>
              </>
            ) : (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
                <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
                  Verifying invitation...
                </h2>
                <p className="text-center text-sm text-slate-600 dark:text-slate-400">
                  Activating your seat
                </p>
              </>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (state === "verifying") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Activating your seat...
            </h2>
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Please wait while we set up your workspace access
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "success" && successData) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/20">
              <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Successfully Activated!
            </h2>
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              You&apos;re now part of <strong>{successData.workspaceName}</strong> on
              the <strong>{successData.planName}</strong> plan.
            </p>
            <p className="text-center text-xs text-slate-500 dark:text-slate-500">
              Redirecting to dashboard...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-red-100 p-4 dark:bg-red-900/20">
              <XCircle className="h-12 w-12 text-red-600 dark:text-red-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Activation Failed
            </h2>
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
              <p className="text-center text-sm text-red-800 dark:text-red-200">
                {error || "An error occurred while activating your invitation"}
              </p>
            </div>
            {error?.includes("email") && (
              <div className="mt-2 rounded-lg bg-amber-50 p-4 dark:bg-amber-900/10">
                <div className="flex items-start space-x-2">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                  <p className="text-left text-xs text-amber-800 dark:text-amber-200">
                    Make sure you&apos;re signed in with the email address that
                    received the invitation.
                  </p>
                </div>
              </div>
            )}
            <button
              onClick={() => router.push("/")}
              className="mt-4 rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              Go to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}


"use client";

import { useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

type ResetState =
  | "loading" // Verifying token
  | "ready" // Token valid, ready to reset
  | "resetting" // Resetting password
  | "success" // Successfully reset
  | "error"; // Error occurred

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [state, setState] = useState<ResetState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const token = searchParams.get("token");
  const type = searchParams.get("type");

  useEffect(() => {
    // Check for Supabase session (set when user clicks reset link)
    const checkSession = async () => {
      const { data: { session } } = await supabaseBrowserClient.auth.getSession();
      
      if (session) {
        // User has a valid session from the reset link
        setState("ready");
      } else if (token && type === "recovery") {
        // Token in URL, try to verify it
        setState("ready");
      } else {
        // Check URL hash for Supabase tokens
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const typeParam = hashParams.get("type");
        
        if (accessToken && typeParam === "recovery") {
          // Set session from hash
          const { error } = await supabaseBrowserClient.auth.setSession({
            access_token: accessToken,
            refresh_token: hashParams.get("refresh_token") || "",
          });
          
          if (error) {
            setError("Invalid or expired reset link");
            setState("error");
          } else {
            setState("ready");
          }
        } else {
          setError("Invalid or missing reset token");
          setState("error");
        }
      }
    };

    checkSession();
  }, [token, type]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!password || !confirmPassword) {
      setError("Please fill in all fields");
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    if (!token) {
      setError("Invalid reset token");
      return;
    }

    setState("resetting");
    setError(null);

    try {
      // Check if we have a valid session (set by Supabase when user clicks reset link)
      const { data: { session }, error: sessionError } = await supabaseBrowserClient.auth.getSession();
      
      if (!session) {
        throw new Error("Invalid or expired reset link. Please request a new password reset.");
      }

      // Update the password using the current session
      const { error: updateError } = await supabaseBrowserClient.auth.updateUser({
        password: password,
      });

      if (updateError) {
        throw updateError;
      }

      setState("success");

      // Sign out and redirect to login after 3 seconds
      await supabaseBrowserClient.auth.signOut();
      setTimeout(() => {
        router.push("/");
      }, 3000);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(
        err.message ||
          "Failed to reset password. The link may have expired. Please request a new one."
      );
      setState("error");
    }
  };

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin text-emerald-600" />
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Verifying reset link...
            </h2>
          </div>
        </div>
      </div>
    );
  }

  if (state === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
          <div className="flex flex-col items-center justify-center space-y-4">
            <div className="rounded-full bg-emerald-100 p-4 dark:bg-emerald-900/20">
              <CheckCircle className="h-12 w-12 text-emerald-600 dark:text-emerald-400" />
            </div>
            <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">
              Password Reset Successful!
            </h2>
            <p className="text-center text-sm text-slate-600 dark:text-slate-400">
              Your password has been reset. You can now sign in with your new password.
            </p>
            <p className="text-center text-xs text-slate-500 dark:text-slate-500">
              Redirecting to login...
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
              Reset Failed
            </h2>
            <div className="rounded-lg bg-red-50 p-4 dark:bg-red-900/10">
              <p className="text-center text-sm text-red-800 dark:text-red-200">
                {error || "Invalid or expired reset link"}
              </p>
            </div>
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

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl dark:bg-slate-800">
        <h2 className="mb-6 text-xl font-semibold text-slate-900 dark:text-slate-100">
          Reset Your Password
        </h2>
        <form onSubmit={handleReset} className="space-y-4">
          <div>
            <label htmlFor="password" className="text-sm font-medium">
              New Password <span className="text-red-500">*</span>
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
              placeholder="Enter new password (min 8 characters)"
              disabled={state === "resetting"}
            />
          </div>
          <div>
            <label htmlFor="confirm-password" className="text-sm font-medium">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
              placeholder="Confirm new password"
              disabled={state === "resetting"}
            />
          </div>
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400">{error}</p>
            </div>
          )}
          <button
            type="submit"
            disabled={state === "resetting"}
            className="w-full rounded-full bg-slate-900 px-4 py-2 font-semibold text-white shadow-lg hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:focus-visible:outline-white"
          >
            {state === "resetting" ? "Resetting Password..." : "Reset Password"}
          </button>
        </form>
      </div>
    </div>
  );
}


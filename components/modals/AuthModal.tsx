"use client";

import { useRouter } from "next/navigation";
import Modal from "@/components/ui/Modal";
import { useAppState } from "@/context/AppStateContext";
import { Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { supabaseBrowserClient } from "@/lib/supabaseClient";
import { useTranslation } from "@/hooks/useTranslation";

const AuthModal = () => {
  const { authModalMode, closeAuthModal, login } = useAppState();
  const router = useRouter();
  const t = useTranslation();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);

  // Helper function to convert Supabase errors to user-friendly messages
  const getErrorMessage = (error: any, mode: "login" | "signup"): string => {
    // Handle different error object structures
    const errorMessage = (
      error?.message || 
      error?.error_description || 
      error?.error || 
      error?.toString() || 
      ""
    ).toLowerCase();
    const errorCode = error?.status || error?.code || error?.statusCode || "";
    
    // Check for configuration errors first (API key, env vars, etc.)
    if (
      errorMessage.includes("invalid api key") ||
      errorMessage.includes("api key") ||
      errorMessage.includes("configuration") ||
      errorMessage.includes("missing required") ||
      errorMessage.includes("environment variable") ||
      errorMessage.includes("failed to fetch") ||
      errorMessage.includes("network error") ||
      errorMessage.includes("connection") ||
      errorCode === "ECONNREFUSED" ||
      errorCode === "ENOTFOUND"
    ) {
      // Log the actual error for debugging
      console.error("[Auth] Configuration/Connection error:", error);
      return mode === "login" 
        ? "Unable to connect to authentication service. Please check your connection and try again."
        : "Unable to create account. Please check your connection and try again.";
    }

    // Check for authentication errors - wrong email or password
    if (
      errorMessage.includes("invalid login credentials") ||
      errorMessage.includes("invalid email") ||
      errorMessage.includes("invalid password") ||
      errorMessage.includes("email not found") ||
      errorMessage.includes("user not found") ||
      errorMessage.includes("incorrect password") ||
      errorMessage.includes("wrong password") ||
      errorMessage.includes("wrong email") ||
      errorCode === "invalid_credentials" ||
      errorCode === "invalid_grant" ||
      errorCode === 401 ||
      errorCode === "400" ||
      String(errorCode).includes("401")
    ) {
      return mode === "login" 
        ? (t("authInvalidEmailOrPassword") || "Wrong email or password")
        : (t("authFailedToCreateAccount") || "Failed to create account");
    }

    // Check for email verification errors
    if (
      errorMessage.includes("email not confirmed") ||
      errorMessage.includes("email not verified") ||
      errorMessage.includes("confirmation")
    ) {
      return "Please verify your email address before signing in.";
    }

    // Check for rate limiting
    if (
      errorMessage.includes("too many requests") ||
      errorMessage.includes("rate limit") ||
      errorCode === 429 ||
      String(errorCode).includes("429")
    ) {
      return "Too many login attempts. Please wait a moment and try again.";
    }

    // Check for network errors
    if (
      errorMessage.includes("network") ||
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("connection") ||
      errorMessage.includes("failed to fetch")
    ) {
      return "Network error. Please check your connection and try again.";
    }

    // Default error messages - always show user-friendly messages for login
    if (mode === "login") {
      // For login, default to "wrong email or password" to avoid exposing system details
      return t("authInvalidEmailOrPassword") || "Wrong email or password";
    } else {
      return t("authFailedToCreateAccount") || "Failed to create account. Please try again.";
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!authModalMode) return;

    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email") || "").trim();
    const password = String(formData.get("password") || "");
    const companyName = String(formData.get("companyName") || "").trim() || undefined;

    if (!email || !password) {
      setError(t("authEmailPasswordRequired"));
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      if (authModalMode === "signup") {
        // 1) Create Supabase auth user, profile and default subscription via secure server route
        const signupRes = await fetch("/api/auth/signup", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,
            password,
            fullName: "",
            companyName,
          }),
        });

        if (!signupRes.ok) {
          const data = await signupRes.json().catch(() => ({}));
          const errorMsg = getErrorMessage(
            { message: data.error, status: signupRes.status },
            "signup"
          );
          throw new Error(errorMsg);
        }

        // 2) Establish Supabase session in the browser
        const { error: supabaseError } = await supabaseBrowserClient.auth.signInWithPassword({
          email,
          password,
        });
        if (supabaseError) {
          const errorMsg = getErrorMessage(supabaseError, "signup");
          throw new Error(errorMsg);
        }
      } else {
        // Login: create Supabase session in the browser
        const { data: signInData, error: supabaseError } = await supabaseBrowserClient.auth.signInWithPassword({
          email,
          password,
        });
        
        if (supabaseError) {
          // Log detailed error for debugging
          console.error("[Auth] Login error:", {
            message: supabaseError.message,
            status: supabaseError.status,
            code: supabaseError.code,
            name: supabaseError.name,
          });
          const errorMsg = getErrorMessage(supabaseError, "login");
          throw new Error(errorMsg);
        }
        
        if (!signInData.session) {
          console.error("[Auth] Login succeeded but no session returned");
          throw new Error("Login succeeded but session was not created. Please try again.");
        }
      }

      // Notify app state about successful auth (handles business modal for signup)
      login();
      closeAuthModal();
      // Give Supabase/session state a moment to propagate
      await new Promise((resolve) => setTimeout(resolve, 150));
      router.push("/app");
    } catch (err: any) {
      console.error("Authentication error:", err);
      // Errors thrown from our code are already user-friendly messages
      // But if we catch a raw error, convert it to a user-friendly message
      const errorMsg = err.message || err.toString();
      // Check if it's already a user-friendly message (doesn't contain technical terms)
      const isTechnicalError = 
        errorMsg.toLowerCase().includes("api key") ||
        errorMsg.toLowerCase().includes("configuration") ||
        errorMsg.toLowerCase().includes("invalid_credentials") ||
        errorMsg.toLowerCase().includes("invalid_grant");
      
      if (isTechnicalError || !errorMsg) {
        // Convert technical error to user-friendly message
        const friendlyMessage = getErrorMessage(err, authModalMode === "login" ? "login" : "signup");
        setError(friendlyMessage);
      } else {
        // Already a user-friendly message
        setError(errorMsg);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    setError(null);

    try {
      // Use environment-based redirect URL
      // Priority: NEXT_PUBLIC_APP_URL > current origin > localhost:3000
      const isLocalhost = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
      let redirectUrl: string;
      
      // Check environment variable first
      if (process.env.NEXT_PUBLIC_APP_URL) {
        redirectUrl = `${process.env.NEXT_PUBLIC_APP_URL}/app`;
      } else if (isLocalhost) {
        // Development: always use localhost:3000
        redirectUrl = `http://localhost:3000/app`;
      } else {
        // Production: use current origin
        redirectUrl = `${window.location.origin}/app`;
      }
      
      console.log("[OAuth] Initiating Google sign-in");
      console.log("[OAuth] Current origin:", window.location.origin);
      console.log("[OAuth] Redirect URL:", redirectUrl);
      console.log("[OAuth] Is localhost:", isLocalhost);
      
      const { data, error: oauthError } = await supabaseBrowserClient.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectUrl,
          queryParams: {
            access_type: "offline",
            prompt: "consent",
          },
        },
      });

      if (oauthError) {
        console.error("Google OAuth error:", oauthError);
        setError("Failed to sign in with Google. Please try again.");
        setIsGoogleLoading(false);
        return;
      }

      // The OAuth flow will redirect, so we don't need to do anything else here
      // The redirect will happen automatically
    } catch (err: any) {
      console.error("Error initiating Google sign-in:", err);
      setError("Failed to sign in with Google. Please try again.");
      setIsGoogleLoading(false);
    }
  };

  return (
    <Modal
      title={authModalMode === "signup" ? t("createAccount") : t("welcomeBack")}
      description={t("authModalDescription")}
      open={Boolean(authModalMode)}
      onClose={closeAuthModal}
    >
      <div className="space-y-4">
        <button
          type="button"
          onClick={handleGoogleSignIn}
          aria-label={t("continueWithGoogle")}
          className="flex w-full items-center justify-center space-x-2 rounded-full border border-slate-200 px-4 py-2 font-medium shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:hover:bg-slate-900 dark:focus-visible:outline-white disabled:opacity-60 disabled:cursor-not-allowed"
          disabled={isSubmitting || isGoogleLoading}
        >
          <Mail size={18} aria-hidden="true" />
          <span>{isGoogleLoading ? "Connecting..." : t("continueWithGoogle")}</span>
        </button>
        <div className="text-center text-xs uppercase tracking-widest text-slate-400">
          {t("orUseEmail")}
        </div>
        <form className="space-y-3" onSubmit={handleSubmit} noValidate>
          <div>
            <label htmlFor="auth-email" className="text-sm font-medium">
              {t("email")} <span className="text-red-500" aria-label={t("required")}>*</span>
            </label>
            <input
              id="auth-email"
              name="email"
              type="email"
              required
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "auth-error" : undefined}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
              placeholder={t("placeholderEmail")}
              disabled={isSubmitting}
            />
          </div>
          <div>
            <label htmlFor="auth-password" className="text-sm font-medium">
              {t("password")} <span className="text-red-500" aria-label={t("required")}>*</span>
            </label>
            <input
              id="auth-password"
              name="password"
              type="password"
              required
              aria-required="true"
              aria-invalid={error ? "true" : "false"}
              aria-describedby={error ? "auth-error" : undefined}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
              placeholder={t("placeholderPassword")}
              disabled={isSubmitting}
            />
          </div>
          {authModalMode === "signup" && (
            <div>
              <label htmlFor="auth-company-name" className="text-sm font-medium">
                {t("companyName")}
              </label>
              <input
                id="auth-company-name"
                name="companyName"
                type="text"
                aria-invalid={error ? "true" : "false"}
                aria-describedby={error ? "auth-error" : undefined}
                className="mt-1 w-full rounded-xl border border-slate-200 bg-transparent px-3 py-2 focus:border-brand-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent focus-visible:ring-offset-2 dark:border-slate-700"
                placeholder={t("placeholderCompany")}
                disabled={isSubmitting}
              />
            </div>
          )}
          {error && (
            <div 
              id="auth-error"
              role="alert"
              aria-live="assertive"
              className="rounded-xl border border-red-200 bg-red-50 p-3 dark:border-red-800 dark:bg-red-900/20"
            >
              <p className="text-xs text-red-600 dark:text-red-400">
                {error}
              </p>
            </div>
          )}
          <button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
            className="mt-2 w-full rounded-full bg-slate-900 px-4 py-2 font-semibold text-white shadow-lg hover:bg-slate-800 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 disabled:opacity-60 dark:bg-white dark:text-slate-900 dark:focus-visible:outline-white"
          >
            {isSubmitting
              ? authModalMode === "signup"
                ? t("authCreatingAccount")
                : t("authSigningIn")
              : t("continue")}
          </button>
        </form>
      </div>
    </Modal>
  );
};

export default AuthModal;

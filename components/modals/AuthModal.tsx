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
          throw new Error(data.error || t("authFailedToCreateAccount"));
        }

        // 2) Establish Supabase session in the browser
        const { error: supabaseError } = await supabaseBrowserClient.auth.signInWithPassword({
          email,
          password,
        });
        if (supabaseError) {
          throw new Error(supabaseError.message || t("authFailedToSignInAfterSignup"));
        }
      } else {
        // Login: create Supabase session in the browser
        const { error: supabaseError } = await supabaseBrowserClient.auth.signInWithPassword({
          email,
          password,
        });
        if (supabaseError) {
          throw new Error(supabaseError.message || t("authInvalidEmailOrPassword"));
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
      setError(err.message || t("authFailedPleaseTryAgain"));
    } finally {
      setIsSubmitting(false);
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
          aria-label={t("continueWithGoogle")}
          className="flex w-full items-center justify-center space-x-2 rounded-full border border-slate-200 px-4 py-2 font-medium shadow-sm hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:border-slate-700 dark:hover:bg-slate-900 dark:focus-visible:outline-white"
          disabled={isSubmitting}
        >
          <Mail size={18} aria-hidden="true" />
          <span>{t("continueWithGoogle")}</span>
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

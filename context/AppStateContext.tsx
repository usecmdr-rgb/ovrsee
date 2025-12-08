"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { AlertCategory, AgentKey, BusinessInfo } from "@/types";
import { defaultAlertCategories, defaultBusinessInfo } from "@/lib/data";
import { supabaseBrowserClient } from "@/lib/supabaseClient";

type ThemeMode = "light" | "dark" | "system";
type AuthMode = "login" | "signup";
export type LanguageCode = "en" | "es" | "fr" | "de" | "it" | "pt" | "nl" | "ja" | "zh" | "ko";

interface AppState {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  isMounted: boolean;
  language: LanguageCode;
  setLanguage: (lang: LanguageCode) => void;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
  authModalMode: AuthMode | null;
  openAuthModal: (mode: AuthMode) => void;
  closeAuthModal: () => void;
  showBusinessModal: boolean;
  setShowBusinessModal: (open: boolean) => void;
  showBillingModal: boolean;
  setShowBillingModal: (open: boolean) => void;
  showSettingsModal: boolean;
  setShowSettingsModal: (open: boolean) => void;
  showTermsModal: boolean;
  setShowTermsModal: (open: boolean) => void;
  businessInfo: BusinessInfo;
  updateBusinessInfo: (info: Partial<BusinessInfo>) => void;
  subscription: Record<AgentKey, boolean>;
  toggleAgentSubscription: (agent: AgentKey) => void;
  activeAgentCount: number;
  alertCategories: AlertCategory[];
  updateAlertColor: (id: string, color: string) => void;
}

const AppStateContext = createContext<AppState | undefined>(undefined);

export const AppStateProvider = ({ children }: { children: React.ReactNode }) => {
  const [theme, setThemeState] = useState<ThemeMode>("light");
  const [isMounted, setIsMounted] = useState(false);
  const [language, setLanguageState] = useState<LanguageCode>("en");
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<AuthMode | null>(null);
  const [showBusinessModal, setShowBusinessModal] = useState(false);
  const [showBillingModal, setShowBillingModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
  const [businessInfo, setBusinessInfo] = useState<BusinessInfo>(defaultBusinessInfo);
  const [subscription, setSubscription] = useState<Record<AgentKey, boolean>>({
    aloha: true,
    sync: true,
    studio: false,
    insight: true,
  });
  const [alertCategories, setAlertCategories] = useState<AlertCategory[]>(defaultAlertCategories);

  useEffect(() => {
    if (typeof window === "undefined") return;

    // Keep track of the Supabase auth subscription so we can clean it up on unmount
    let authSubscription: { unsubscribe: () => void } | null = null;

    (async () => {
      try {
        // Initialize authentication state from Supabase session
        const {
          data: { session },
        } = await supabaseBrowserClient.auth.getSession();
        setIsAuthenticated(!!session);

        // Load theme from database if authenticated, otherwise from localStorage
        if (session?.user) {
          try {
            const { data: userSettings } = await supabaseBrowserClient
              .from("user_settings")
              .select("theme")
              .eq("user_id", session.user.id)
              .single();

            if (userSettings?.theme) {
              setThemeState(userSettings.theme as ThemeMode);
            } else {
              // Fallback to localStorage or system preference
              const storedTheme = window.localStorage.getItem("cx-theme") as ThemeMode | null;
              if (storedTheme) {
                setThemeState(storedTheme);
              } else {
                setThemeState("system");
              }
            }
          } catch (error) {
            console.error("Error loading theme from database:", error);
            // Fallback to localStorage
            const storedTheme = window.localStorage.getItem("cx-theme") as ThemeMode | null;
            if (storedTheme) {
              setThemeState(storedTheme);
            } else {
              setThemeState("system");
            }
          }
        } else {
          const storedTheme = window.localStorage.getItem("cx-theme") as ThemeMode | null;
          if (storedTheme) {
            setThemeState(storedTheme);
          } else if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
            setThemeState("dark");
          } else {
            setThemeState("system");
          }
        }

        const storedLanguage = window.localStorage.getItem("cx-language") as LanguageCode | null;
        if (storedLanguage) {
          setLanguageState(storedLanguage);
        } else {
          // Try to detect browser language
          const browserLang = navigator.language.split("-")[0] as LanguageCode;
          const supportedLanguages: LanguageCode[] = ["en", "es", "fr", "de", "it", "pt", "nl", "ja", "zh", "ko"];
          if (supportedLanguages.includes(browserLang)) {
            setLanguageState(browserLang);
          }
        }

        // Subscribe to auth state changes so isAuthenticated stays in sync
        const {
          data: { subscription },
        } = supabaseBrowserClient.auth.onAuthStateChange(async (event, sessionUpdate) => {
          console.log("[Auth] Auth state changed:", event, !!sessionUpdate);
          const wasAuthenticated = isAuthenticated;
          setIsAuthenticated(!!sessionUpdate);
          
          // If we just signed in, trigger login and ensure profile exists
          if (event === "SIGNED_IN" && sessionUpdate && !wasAuthenticated) {
            console.log("[Auth] User signed in, calling login()");
            
            // Ensure profile exists (database trigger should create it, but ensure as fallback)
            if (sessionUpdate.access_token) {
              try {
                await fetch("/api/auth/ensure-profile", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${sessionUpdate.access_token}`,
                  },
                });
                console.log("[Auth] Profile ensured after sign-in");
              } catch (profileError) {
                console.error("[Auth] Error ensuring profile:", profileError);
                // Don't block login if profile creation fails
              }
            }
            
            login();
          }
        });
        authSubscription = subscription;
      } catch (error) {
        console.error("Error loading app state:", error);
      } finally {
        setIsMounted(true);
      }
    })();

    return () => {
      // Clean up Supabase auth listener on unmount
      if (authSubscription && typeof authSubscription.unsubscribe === "function") {
        authSubscription.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("cx-theme", theme);
      
      // Apply theme based on mode
      const applyTheme = () => {
        if (theme === "system") {
          const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
          document.documentElement.classList.toggle("dark", prefersDark);
        } else {
          document.documentElement.classList.toggle("dark", theme === "dark");
        }
      };

      applyTheme();

      // Listen for system theme changes when in system mode
      if (theme === "system") {
        const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        const handleChange = () => applyTheme();
        mediaQuery.addEventListener("change", handleChange);
        return () => mediaQuery.removeEventListener("change", handleChange);
      }

      // Save to database if authenticated
      if (isAuthenticated) {
        (async () => {
          try {
            const { data: { user } } = await supabaseBrowserClient.auth.getUser();
            if (user) {
              await supabaseBrowserClient
                .from("user_settings")
                .upsert({
                  user_id: user.id,
                  theme: theme,
                }, {
                  onConflict: "user_id",
                });
            }
          } catch (error) {
            console.error("Error saving theme to database:", error);
          }
        })();
      }
    } catch (error) {
      console.error("Error saving theme:", error);
    }
  }, [theme, isMounted, isAuthenticated]);

  useEffect(() => {
    if (!isMounted || typeof window === "undefined") return;
    try {
      window.localStorage.setItem("cx-language", language);
      document.documentElement.setAttribute("lang", language);
    } catch (error) {
      console.error("Error saving language:", error);
    }
  }, [language, isMounted]);

  const toggleTheme = () => setThemeState((prev) => (prev === "light" ? "dark" : "light"));
  const setTheme = (mode: ThemeMode) => setThemeState(mode);
  const setLanguage = (lang: LanguageCode) => setLanguageState(lang);

  // Check for business modal follow-up on mount and when authenticated
  useEffect(() => {
    if (!isMounted || !isAuthenticated || typeof window === "undefined") return;

    const checkBusinessModalFollowUp = () => {
      const hasSeenBusinessModal = window.localStorage.getItem("cx-business-modal-shown");
      const followUpDate = window.localStorage.getItem("cx-business-modal-followup");
      
      // Check if follow-up period has passed
      let shouldShowFollowUp = false;
      if (followUpDate) {
        const followUp = new Date(followUpDate);
        const now = new Date();
        if (now >= followUp) {
          shouldShowFollowUp = true;
          // Clear the follow-up date since we're showing it now
          window.localStorage.removeItem("cx-business-modal-followup");
        }
      }
      
      // Show modal if never seen before, or if follow-up period has passed
      if (!hasSeenBusinessModal || shouldShowFollowUp) {
        setShowBusinessModal(true);
        // Only mark as permanently shown if user explicitly dismisses (not on follow-up)
        if (!shouldShowFollowUp && !hasSeenBusinessModal) {
          window.localStorage.setItem("cx-business-modal-shown", "true");
        }
      }
    };

    // Small delay to avoid showing modal immediately on page load
    const timer = setTimeout(checkBusinessModalFollowUp, 1000);
    return () => clearTimeout(timer);
  }, [isMounted, isAuthenticated]);

  const login = () => {
    const wasSignup = authModalMode === "signup";
    setAuthModalMode(null);
    // Business modal check is now handled by useEffect above
  };

  const logout = () => {
    // Supabase sign-out will trigger auth listener to update isAuthenticated
    supabaseBrowserClient.auth.signOut().catch((error) => {
      console.error("Error signing out:", error);
    });
  };

  const openAuthModal = (mode: AuthMode) => {
    setAuthModalMode(mode);
  };

  const closeAuthModal = () => setAuthModalMode(null);

  const updateBusinessInfo = (info: Partial<BusinessInfo>) => {
    setBusinessInfo((prev) => ({ ...prev, ...info }));
  };

  const toggleAgentSubscription = (agentKey: AgentKey) => {
    setSubscription((prev) => ({ ...prev, [agentKey]: !prev[agentKey] }));
  };

  const activeAgentCount = useMemo(
    () => Object.values(subscription).filter(Boolean).length,
    [subscription]
  );

  const updateAlertColor = (id: string, color: string) => {
    setAlertCategories((prev) =>
      prev.map((cat) => (cat.id === id ? { ...cat, color } : cat))
    );
  };

  const value: AppState = {
    theme,
    toggleTheme,
    setTheme,
    isMounted,
    language,
    setLanguage,
    isAuthenticated,
    login,
    logout,
    authModalMode,
    openAuthModal,
    closeAuthModal,
    showBusinessModal,
    setShowBusinessModal,
    showBillingModal,
    setShowBillingModal,
    showSettingsModal,
    setShowSettingsModal,
    showTermsModal,
    setShowTermsModal,
    businessInfo,
    updateBusinessInfo,
    subscription,
    toggleAgentSubscription,
    activeAgentCount,
    alertCategories,
    updateAlertColor,
  };

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
};

export const useAppState = () => {
  const ctx = useContext(AppStateContext);
  if (!ctx) {
    throw new Error("useAppState must be used within an AppStateProvider");
  }
  return ctx;
};


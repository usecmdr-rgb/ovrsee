"use client";

import { useEffect, useRef, useState, useMemo, useCallback, memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import LogoIntro from "./LogoIntro";
import Logo from "./Logo";
import LanguageSelector from "./LanguageSelector";
import ThemeToggle from "./ThemeToggle";
import UserMenu from "./UserMenu";
import { useAppState } from "@/context/AppStateContext";
import { useTranslation } from "@/hooks/useTranslation";
import { useDevice } from "@/context/DeviceContext";

// Memoized Desktop Navigation Component
const DesktopNav = memo(({ 
  navItems, 
  pathname, 
  hoveredNav, 
  navSliderStyle, 
  navContainerRef,
  navRefs,
  onItemClick,
  onMouseEnter,
  onMouseLeave 
}: {
  navItems: Array<{ label: string; href: string }>;
  pathname: string;
  hoveredNav: string | null;
  navSliderStyle: { left: number; width: number };
  navContainerRef: React.RefObject<HTMLElement>;
  navRefs: React.MutableRefObject<Record<string, HTMLButtonElement | null>>;
  onItemClick: (href: string) => void;
  onMouseEnter: (href: string) => void;
  onMouseLeave: () => void;
}) => {
  return (
    <nav
      ref={navContainerRef}
      className="hidden lg:flex relative items-center space-x-[5px] text-sm font-medium"
      onMouseLeave={onMouseLeave}
    >
      {hoveredNav && (
        <div
          className="absolute top-0 bottom-0 rounded-full bg-slate-900 dark:bg-white"
          style={{
            left: `${navSliderStyle.left}px`,
            width: `${navSliderStyle.width}px`,
          }}
        />
      )}
      {navItems.map((item) => (
        <button
          key={item.href}
          ref={(el) => {
            navRefs.current[item.href] = el;
          }}
          onClick={() => onItemClick(item.href)}
          onMouseEnter={() => onMouseEnter(item.href)}
          aria-current={pathname === item.href ? "page" : undefined}
          className={`relative z-10 rounded-full px-4 py-2 transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white ${
            hoveredNav === item.href
              ? "text-white dark:text-slate-900"
              : "text-slate-600 dark:text-slate-300"
          }`}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
});

DesktopNav.displayName = "DesktopNav";

// Memoized Mobile Navigation Pills Component
const MobileNavPills = memo(({ 
  navItems, 
  pathname, 
  onItemClick 
}: {
  navItems: Array<{ label: string; href: string }>;
  pathname: string;
  onItemClick: (href: string) => void;
}) => {
  return (
    <div className="lg:hidden border-t border-slate-200 dark:border-slate-800 pb-3 pt-2">
      <nav className="grid grid-cols-2 gap-2 sm:grid-cols-4 sm:gap-3">
        {navItems.map((item) => (
          <button
            key={`mobile-${item.href}`}
            onClick={() => onItemClick(item.href)}
            aria-current={pathname === item.href ? "page" : undefined}
            className={`flex items-center justify-center rounded-xl border px-4 py-3 text-sm font-semibold min-h-[48px] touch-manipulation transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 sm:text-base ${
              pathname === item.href
                ? "bg-slate-900 text-white border-slate-900 shadow-sm dark:bg-white dark:text-slate-900 dark:border-white"
                : "bg-white/90 text-slate-700 border-slate-200 shadow-sm dark:bg-slate-900/80 dark:text-slate-100 dark:border-slate-700"
            }`}
          >
            {item.label}
          </button>
        ))}
      </nav>
    </div>
  );
});

MobileNavPills.displayName = "MobileNavPills";

// Memoized Auth Buttons Component
const AuthButtons = memo(({ 
  hoveredButton, 
  sliderStyle, 
  containerRef,
  signupRef,
  loginRef,
  onSignupClick,
  onLoginClick,
  onMouseEnter,
  onMouseLeave,
  signUpLabel,
  logInLabel
}: {
  hoveredButton: "signup" | "login" | null;
  sliderStyle: { left: number; width: number };
  containerRef: React.RefObject<HTMLDivElement>;
  signupRef: React.RefObject<HTMLButtonElement>;
  loginRef: React.RefObject<HTMLButtonElement>;
  onSignupClick: () => void;
  onLoginClick: () => void;
  onMouseEnter: (button: "signup" | "login") => void;
  onMouseLeave: () => void;
  signUpLabel: string;
  logInLabel: string;
}) => {
  return (
    <div
      ref={containerRef}
      className="hidden sm:flex relative items-center space-x-1.5 text-sm font-medium"
      onMouseLeave={onMouseLeave}
    >
      <div
        className="absolute top-0 bottom-0 rounded-full bg-slate-900 dark:bg-white transition-all duration-200 ease-out"
        style={{
          left: `${sliderStyle.left}px`,
          width: `${sliderStyle.width}px`,
        }}
      />
      <button
        ref={signupRef}
        onClick={onSignupClick}
        onMouseEnter={() => onMouseEnter("signup")}
        className={`relative z-10 rounded-full px-4 py-2 transition ${
          hoveredButton === "signup"
            ? "text-white dark:text-slate-900"
            : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {signUpLabel}
      </button>
      <button
        ref={loginRef}
        onClick={onLoginClick}
        onMouseEnter={() => onMouseEnter("login")}
        className={`relative z-10 rounded-full px-4 py-2 transition ${
          hoveredButton === "login"
            ? "text-white dark:text-slate-900"
            : "text-slate-600 dark:text-slate-300"
        }`}
      >
        {logInLabel}
      </button>
    </div>
  );
});

AuthButtons.displayName = "AuthButtons";

const Header = () => {
  const pathname = usePathname();
  const router = useRouter();
  const { openAuthModal, isAuthenticated } = useAppState();
  const t = useTranslation();
  const { isDesktop } = useDevice();
  const [hoveredButton, setHoveredButton] = useState<"signup" | "login" | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [showIntro, setShowIntro] = useState(false); // Always default to showing logo
  const [mounted, setMounted] = useState(false);
  const signupRef = useRef<HTMLButtonElement>(null);
  const loginRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const navContainerRef = useRef<HTMLDivElement>(null);
  const navRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const mobileMenuRef = useRef<HTMLDivElement>(null);
  const [sliderStyle, setSliderStyle] = useState({ left: 0, width: 0 });
  const [navSliderStyle, setNavSliderStyle] = useState({ left: 0, width: 0 });

  // Memoize navItems to avoid recreating on every render
  const navItems = useMemo(() => [
    { label: t("navHome"), href: "/" },
    { label: t("navPricing"), href: "/pricing" },
    { label: t("navAbout"), href: "/about" },
    { label: t("navDashboard"), href: "/dashboard" },
  ], [t]);

  // Memoize handleAppClick to avoid recreating on every render
  const handleAppClick = useCallback((href: string) => {
    // Allow /dashboard navigation even when unauthenticated (shows preview mode)
    // Only block /app routes when unauthenticated
    if (href.startsWith("/app") && !href.startsWith("/dashboard") && !isAuthenticated) {
      openAuthModal("login");
      setMobileMenuOpen(false);
      return;
    }
    router.push(href as any);
    setMobileMenuOpen(false);
  }, [isAuthenticated, openAuthModal, router]);

  // Memoize auth button handlers
  const handleSignupClick = useCallback(() => {
    openAuthModal("signup");
  }, [openAuthModal]);

  const handleLoginClick = useCallback(() => {
    openAuthModal("login");
  }, [openAuthModal]);

  // Memoize mobile menu handlers
  const handleMobileMenuToggle = useCallback(() => {
    setMobileMenuOpen((prev) => !prev);
  }, []);

  const handleMobileMenuClose = useCallback(() => {
    setMobileMenuOpen(false);
  }, []);

  const handleMobileSignupClick = useCallback(() => {
    openAuthModal("signup");
    setMobileMenuOpen(false);
  }, [openAuthModal]);

  const handleMobileLoginClick = useCallback(() => {
    openAuthModal("login");
    setMobileMenuOpen(false);
  }, [openAuthModal]);

  // Memoize hover handlers
  const handleNavMouseEnter = useCallback((href: string) => {
    setHoveredNav(href);
  }, []);

  const handleNavMouseLeave = useCallback(() => {
    setHoveredNav(null);
  }, []);

  const handleButtonMouseEnter = useCallback((button: "signup" | "login") => {
    setHoveredButton(button);
  }, []);

  const handleButtonMouseLeave = useCallback(() => {
    setHoveredButton(null);
  }, []);

  // Memoize translation strings to avoid re-renders
  const signUpLabel = useMemo(() => t("signUp"), [t]);
  const logInLabel = useMemo(() => t("logIn"), [t]);

  // Close mobile menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        mobileMenuRef.current &&
        !mobileMenuRef.current.contains(event.target as Node) &&
        !(event.target as HTMLElement).closest('button[aria-label="Toggle menu"]')
      ) {
        setMobileMenuOpen(false);
      }
    };

    if (mobileMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      // Prevent body scroll when menu is open
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.body.style.overflow = "";
    };
  }, [mobileMenuOpen]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!containerRef.current) {
      setSliderStyle({ left: 0, width: 0 });
      return;
    }

    if (!hoveredButton) {
      setSliderStyle({ left: 0, width: 0 });
      return;
    }

    const buttonRef = hoveredButton === "signup" ? signupRef : loginRef;
    if (!buttonRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const buttonRect = buttonRef.current.getBoundingClientRect();

    setSliderStyle({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    });
  }, [hoveredButton]);

  useEffect(() => {
    if (!navContainerRef.current) {
      setNavSliderStyle({ left: 0, width: 0 });
      return;
    }

    if (!hoveredNav) {
      setNavSliderStyle({ left: 0, width: 0 });
      return;
    }

    const buttonRef = navRefs.current[hoveredNav];
    if (!buttonRef) return;

    const containerRect = navContainerRef.current.getBoundingClientRect();
    const buttonRect = buttonRef.getBoundingClientRect();

    setNavSliderStyle({
      left: buttonRect.left - containerRect.left,
      width: buttonRect.width,
    });
  }, [hoveredNav]);

  useEffect(() => {
    if (isDesktop) {
      setMobileMenuOpen(false);
    }
  }, [isDesktop]);

  // Check if intro animation should play (once per session)
  useEffect(() => {
    if (typeof window === "undefined") return;
    
    const seen = sessionStorage.getItem("ovrsee_intro_seen");
    if (!seen) {
      setShowIntro(true);
      sessionStorage.setItem("ovrsee_intro_seen", "true");
      // Hide intro after animation completes (1.1 seconds)
      setTimeout(() => setShowIntro(false), 1100);
    } else {
      // Ensure logo shows if intro was already seen
      setShowIntro(false);
    }
  }, []);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-black">
        <div className="mx-auto w-full max-w-6xl px-3 sm:px-6">
          <div className="relative flex h-16 items-center justify-between">
            {/* Mobile menu button */}
            <button
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
              onClick={handleMobileMenuToggle}
              className="lg:hidden p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-slate-100 active:bg-slate-100 dark:active:bg-slate-800 rounded-lg transition-colors relative z-50 flex-shrink-0 touch-manipulation focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 dark:focus-visible:outline-white"
              type="button"
            >
              {mobileMenuOpen ? <X size={24} className="pointer-events-none" aria-hidden="true" /> : <Menu size={24} className="pointer-events-none" aria-hidden="true" />}
            </button>

            {/* Desktop navigation */}
            <DesktopNav
              navItems={navItems}
              pathname={pathname}
              hoveredNav={hoveredNav}
              navSliderStyle={navSliderStyle}
              navContainerRef={navContainerRef}
              navRefs={navRefs}
              onItemClick={handleAppClick}
              onMouseEnter={handleNavMouseEnter}
              onMouseLeave={handleNavMouseLeave}
            />

            {/* Logo - centered on all screen sizes */}
            <div className="absolute left-1/2 -translate-x-1/2 z-10 text-slate-900 dark:text-white">
              {showIntro ? (
                <LogoIntro />
              ) : (
                <Logo />
              )}
            </div>

            {/* Right side controls */}
            <div className="flex items-center space-x-1 h-full flex-shrink-0">
              <div className="flex items-center">
                <ThemeToggle />
              </div>
              <div className="hidden sm:flex items-center">
                <LanguageSelector />
              </div>
              {!isAuthenticated && (
                <AuthButtons
                  hoveredButton={hoveredButton}
                  sliderStyle={sliderStyle}
                  containerRef={containerRef}
                  signupRef={signupRef}
                  loginRef={loginRef}
                  onSignupClick={handleSignupClick}
                  onLoginClick={handleLoginClick}
                  onMouseEnter={handleButtonMouseEnter}
                  onMouseLeave={handleButtonMouseLeave}
                  signUpLabel={signUpLabel}
                  logInLabel={logInLabel}
                />
              )}
              <UserMenu />
            </div>
          </div>

          {/* Mobile navigation pills */}
          <MobileNavPills
            navItems={navItems}
            pathname={pathname}
            onItemClick={handleAppClick}
          />
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-900/50 backdrop-blur-sm lg:hidden"
          onClick={handleMobileMenuClose}
        />
      )}

      {/* Mobile menu drawer */}
      <div
        ref={mobileMenuRef}
        className={`fixed inset-x-0 top-0 z-50 bg-white dark:bg-black border-b border-slate-200 dark:border-slate-800 shadow-xl max-h-[100vh] overflow-y-auto transform transition-transform duration-300 ease-in-out lg:hidden ${
          mobileMenuOpen ? "translate-y-0" : "-translate-y-full"
        }`}
      >
        <nav className="flex flex-col px-4 py-4 space-y-2">
          {navItems.map((item) => (
            <button
              key={item.href}
              onClick={() => handleAppClick(item.href)}
              className={`w-full text-left px-4 py-3.5 min-h-[44px] rounded-lg text-base font-medium transition touch-manipulation active:opacity-80 ${
                pathname === item.href
                  ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                  : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
              }`}
            >
              {item.label}
            </button>
          ))}
          {!isAuthenticated && (
            <>
              <div className="border-t border-slate-200 dark:border-slate-800 my-2" />
              <button
                onClick={handleMobileSignupClick}
                className="w-full text-left px-4 py-3.5 min-h-[44px] rounded-lg text-base font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 touch-manipulation active:opacity-80"
              >
                {signUpLabel}
              </button>
              <button
                onClick={handleMobileLoginClick}
                className="w-full text-left px-4 py-3.5 min-h-[44px] rounded-lg text-base font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 touch-manipulation active:opacity-80"
              >
                {logInLabel}
              </button>
            </>
          )}
          <div className="border-t border-slate-200 dark:border-slate-800 my-2" />
          <div className="px-4 py-2">
            <LanguageSelector />
          </div>
        </nav>
      </div>
    </>
  );
};

export default Header;

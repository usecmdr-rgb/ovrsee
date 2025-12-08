import "./globals.css";

import React from "react";
import type { Metadata, Viewport } from "next";
import { AppStateProvider } from "@/context/AppStateContext";
import { DeviceProvider } from "@/context/DeviceContext";
import Header from "@/components/layout/Header";
import AuthModal from "@/components/modals/AuthModal";
import BusinessInfoModal from "@/components/modals/BusinessInfoModal";
import BillingModal from "@/components/modals/BillingModal";
import SettingsModal from "@/components/modals/SettingsModal";
import TermsModal from "@/components/modals/TermsModal";
import { SupabaseProvider } from "@/components/SupabaseProvider";
import DataRetentionBanner from "@/components/subscription/DataRetentionBanner";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://ovrsee.dev"),
  title: "OVRSEE - AI Agents for Modern Business",
  description: "Delegate calls, inbox, content, and insights to OVRSEE. Four focused AI agents handle communications, media polish, and reporting so you can stay on high-value work.",
  keywords: ["AI agents", "business automation", "call assistant", "email management", "media editing", "business insights"],
  authors: [{ name: "OVRSEE" }],
  creator: "OVRSEE",
  publisher: "OVRSEE",
  icons: {
    icon: [
      { url: "/favicon.ico?v=2", sizes: "any" },
      { url: "/favicon-32x32.png?v=2", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png?v=2", sizes: "16x16", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png?v=2", sizes: "180x180", type: "image/png" },
    ],
    shortcut: [
      { url: "/favicon.ico?v=2" },
    ],
  },
  manifest: "/manifest.json",
  openGraph: {
    title: "OVRSEE - AI Agents for Modern Business",
    description: "Delegate calls, inbox, content, and insights to OVRSEE. Four focused AI agents handle communications, media polish, and reporting.",
    type: "website",
    locale: "en_US",
    siteName: "OVRSEE",
    url: process.env.NEXT_PUBLIC_APP_URL || "https://ovrsee.dev",
    images: [
      {
        url: "/ovrsee_og.png",
        width: 1200,
        height: 630,
        alt: "OVRSEE - AI Agents for Modern Business",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "OVRSEE - AI Agents for Modern Business",
    description: "Delegate calls, inbox, content, and insights to OVRSEE. Four focused AI agents handle communications, media polish, and reporting.",
    images: ["/ovrsee_og.png"],
  },
  other: {
    "facebook-domain-verification": "77oeogvqah5u8h1ar84dzp8h7bxfl1",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" data-device="desktop" className="min-h-full" suppressHydrationWarning>
      <body className="bg-white dark:bg-black transition-colors duration-300 min-h-full">
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
                if (prefersDark) {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              })();
            `,
          }}
        />
        <SupabaseProvider>
          <DeviceProvider>
            <AppStateProvider>
              <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-[100] focus:rounded-lg focus:bg-slate-900 focus:px-4 focus:py-2 focus:text-white focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-slate-900 dark:focus:bg-white dark:focus:text-slate-900 dark:focus:ring-white"
              >
                Skip to main content
              </a>
              <Header />
              <DataRetentionBanner />
              <main
                id="main-content"
                className="site-main mx-auto min-h-screen max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16 overflow-x-hidden"
                style={{ paddingTop: "var(--page-top-padding, 5rem)" }}
              >
                {children}
              </main>
              <AuthModal />
              <BusinessInfoModal />
              <BillingModal />
              <SettingsModal />
              <TermsModal />
            </AppStateProvider>
          </DeviceProvider>
        </SupabaseProvider>
      </body>
    </html>
  );
}

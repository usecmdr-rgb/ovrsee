"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { FileText } from "lucide-react";

export default function TermsPage() {
  const t = useTranslation();

  const statements = [
    t("termsStatement1"),
    t("termsStatement2"),
    t("termsStatement3"),
    t("termsStatement4"),
    t("termsStatement5"),
    t("termsStatement6"),
    t("termsStatement7"),
    t("termsStatement8"),
    t("termsStatement9"),
    t("termsStatement10"),
    t("termsStatement11"),
    t("termsStatement12"),
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-slate-100">
      {/* Hero Section */}
      <div className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="pt-8 sm:pt-12 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                <FileText className="h-6 w-6 text-purple-500" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                {t("termsModalTitle") || "Terms of Service"}
              </h1>
            </div>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-light leading-relaxed">
              {t("termsModalDescription") || "Please review these terms carefully before using OVRSEE."}
            </p>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {t("termsLastUpdated") || "Last updated: December 2024"}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-6">
            <ol className="space-y-4">
              {statements.map((text, index) => (
                <li
                  key={index}
                  className="p-6 sm:p-8 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700/50 transition-all duration-300"
                >
                  <div className="flex items-start gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-sm font-semibold text-purple-600 dark:text-purple-400">
                      {index + 1}
                    </span>
                    <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed flex-1">
                      {text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          {/* Contact Section */}
          <div className="mt-12 p-6 sm:p-8 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-slate-200 dark:border-slate-800/50">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
              {t("termsContactTitle") || "Questions About These Terms?"}
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {t("termsContactDescription") || "If you have questions about these Terms of Service, please contact us:"}
            </p>
            <p className="text-base text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Email:</strong>{" "}
              <a
                href="mailto:legal@ovrsee.dev"
                className="text-purple-600 dark:text-purple-400 hover:underline"
              >
                legal@ovrsee.dev
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


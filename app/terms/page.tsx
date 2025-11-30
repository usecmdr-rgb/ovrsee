"use client";

import { FileText } from "lucide-react";

export default function TermsPage() {
  const statements = [
    "OVRSEE is provided \"as is\" and \"as available\" without any warranties of any kind.",
    "The service uses experimental AI models which may generate incorrect, incomplete, or misleading information. Outputs should not be relied on as professional advice (including but not limited to legal, financial, medical, or HR advice).",
    "Users remain solely responsible for any decisions or actions they take based on the service's outputs.",
    "OVRSEE is not responsible for missed calls, missed emails, calendar errors, or any loss, damage, or liability arising from delays, inaccuracies, or omissions in the service.",
    "Users are responsible for reviewing and verifying any AI-generated drafts, summaries, or suggested actions before sending or acting on them.",
    "Users must ensure they have the necessary rights and permissions to provide any data, media, or content they upload and must not upload illegal or infringing content.",
    "OVRSEE may store and process user data to provide and improve the service, in accordance with a separate Privacy Policy.",
    "Access to the service is subscription-based. Users are responsible for cancelling subscriptions if they no longer wish to be billed. Fees are generally non-refundable except where required by applicable law.",
    "OVRSEE may modify or discontinue features at any time and may update these Terms periodically.",
    "To the maximum extent permitted by law, OVRSEE's total liability for any claims related to the service is limited to the amount the user paid for the service in the 3 months preceding the claim.",
    "Users agree to use the service in compliance with all applicable laws and regulations.",
    "This text is a placeholder and should be replaced or reviewed by a qualified attorney before production use.",
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
                Terms of Service
              </h1>
            </div>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-light leading-relaxed">
              Please review these terms carefully before using OVRSEE.
            </p>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              Last updated: December 2024
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
              Questions About These Terms?
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              If you have questions about these Terms of Service, please contact us:
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


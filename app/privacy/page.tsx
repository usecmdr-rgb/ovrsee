"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { Shield } from "lucide-react";

export default function PrivacyPage() {
  const t = useTranslation();

  const sections = [
    {
      title: t("privacySection1Title") || "Information We Collect",
      content: t("privacySection1Content") || "We collect information that you provide directly to us, such as when you create an account, use our services, or contact us for support. This may include your name, email address, phone number, and any content you upload or create through our services.",
    },
    {
      title: t("privacySection2Title") || "How We Use Your Information",
      content: t("privacySection2Content") || "We use the information we collect to provide, maintain, and improve our services, process transactions, send you technical notices and support messages, and communicate with you about products, services, and promotional offers.",
    },
    {
      title: t("privacySection3Title") || "Data Storage and Security",
      content: t("privacySection3Content") || "We implement appropriate technical and organizational measures to protect your personal information. Your data is stored securely and we use industry-standard encryption to protect data in transit and at rest.",
    },
    {
      title: t("privacySection4Title") || "Third-Party Services",
      content: t("privacySection4Content") || "We may use third-party services (such as Google, Stripe, and Twilio) to provide certain features. These services have their own privacy policies governing the use of your information.",
    },
    {
      title: t("privacySection5Title") || "Your Rights",
      content: t("privacySection5Content") || "You have the right to access, update, or delete your personal information. You can manage your data through your account settings or by contacting us directly.",
    },
    {
      title: t("privacySection6Title") || "Changes to This Policy",
      content: t("privacySection6Content") || "We may update this Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the \"Last updated\" date.",
    },
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-slate-100">
      {/* Hero Section */}
      <div className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="pt-8 sm:pt-12 pb-12 sm:pb-16">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3 mb-5">
              <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <Shield className="h-6 w-6 text-blue-500" />
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                {t("privacyPolicyTitle") || "Privacy Policy"}
              </h1>
            </div>
            <p className="text-lg sm:text-xl text-slate-600 dark:text-slate-300 font-light leading-relaxed">
              {t("privacyPolicyDescription") || "Your privacy is important to us. This policy explains how we collect, use, and protect your personal information."}
            </p>
            <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
              {t("privacyLastUpdated") || "Last updated: December 2024"}
            </p>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <section className="py-12 sm:py-16 lg:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            {sections.map((section, index) => (
              <div
                key={index}
                className="p-6 sm:p-8 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700/50 transition-all duration-300"
              >
                <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
                  {section.title}
                </h2>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {section.content}
                </p>
              </div>
            ))}
          </div>

          {/* Contact Section */}
          <div className="mt-12 p-6 sm:p-8 rounded-xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-slate-200 dark:border-slate-800/50">
            <h2 className="text-xl sm:text-2xl font-semibold mb-4 text-slate-900 dark:text-slate-100">
              {t("privacyContactTitle") || "Contact Us"}
            </h2>
            <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed mb-4">
              {t("privacyContactDescription") || "If you have questions about this Privacy Policy or our data practices, please contact us:"}
            </p>
            <p className="text-base text-slate-600 dark:text-slate-300">
              <strong className="text-slate-900 dark:text-slate-100">Email:</strong>{" "}
              <a
                href="mailto:privacy@ovrsee.dev"
                className="text-blue-600 dark:text-blue-400 hover:underline"
              >
                privacy@ovrsee.dev
              </a>
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}


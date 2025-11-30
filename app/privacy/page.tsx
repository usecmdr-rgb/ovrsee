"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { Shield } from "lucide-react";
import TableOfContents from "@/components/legal/TableOfContents";

export default function PrivacyPage() {
  const t = useTranslation();

  const tocItems = [
    { id: "overview", label: t("privacyTOCOverview") },
    { 
      id: "information-we-collect", 
      label: t("privacyTOCInformation"),
      subItems: [
        { id: "information-you-provide", label: t("privacyTOCInformationYouProvide") },
        { id: "information-collected-automatically", label: t("privacyTOCInformationAuto") },
        { id: "third-party-integrations", label: t("privacyTOCThirdParty") },
      ]
    },
    { id: "how-we-use", label: t("privacyTOCHowWeUse") },
    { id: "how-we-share", label: t("privacyTOCHowWeShare") },
    { id: "data-retention", label: t("privacyTOCDataRetention") },
    { id: "security", label: t("privacyTOCSecurity") },
    { id: "your-rights", label: t("privacyTOCYourRights") },
    { id: "children-privacy", label: t("privacyTOCChildren") },
    { id: "international-transfers", label: t("privacyTOCInternational") },
    { id: "updates", label: t("privacyTOCUpdates") },
    { id: "contact", label: t("privacyTOCContact") },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="pt-8 sm:pt-12 pb-8 sm:pb-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                  <Shield className="h-8 w-8 text-blue-500" />
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                {t("privacyPageTitle")}
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 font-light leading-relaxed max-w-3xl mx-auto">
                {t("privacyPageDescription")}
              </p>
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                {t("privacyLastUpdated")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-8 sm:py-12 lg:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-12">
            {/* Table of Contents */}
            <TableOfContents items={tocItems} />

            {/* Content */}
            <div className="max-w-3xl mx-auto lg:mx-0 space-y-6">
              {/* Overview */}
              <section id="overview" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    1. {t("privacySection1Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacySection1Content")}</p>
                    <p>{t("privacySection1Content2")}</p>
                  </div>
                </div>
              </section>

              {/* Information We Collect */}
              <section id="information-we-collect" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    2. {t("privacySection2Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed space-y-4">
                    <p className="mb-4">{t("privacySection2Content")}</p>
                    
                    <div id="information-you-provide" className="scroll-mt-24">
                      <h3 className="text-lg sm:text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">
                        2.1 {t("privacySection2_1Title")}
                      </h3>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>{t("privacySection2_1Item1")}</li>
                        <li>{t("privacySection2_1Item2")}</li>
                        <li>{t("privacySection2_1Item3")}</li>
                        <li>{t("privacySection2_1Item4")}</li>
                      </ul>
                    </div>

                    <div id="information-collected-automatically" className="scroll-mt-24">
                      <h3 className="text-lg sm:text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">
                        2.2 {t("privacySection2_2Title")}
                      </h3>
                      <ul className="list-disc list-inside space-y-1 ml-4">
                        <li>{t("privacySection2_2Item1")}</li>
                        <li>{t("privacySection2_2Item2")}</li>
                        <li>{t("privacySection2_2Item3")}</li>
                      </ul>
                    </div>

                    <div id="third-party-integrations" className="scroll-mt-24">
                      <h3 className="text-lg sm:text-xl font-semibold mb-3 text-slate-900 dark:text-slate-100">
                        2.3 {t("privacySection2_3Title")}
                      </h3>
                      <p className="mb-4">{t("privacySection2_3Content")}</p>
                      <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                        <li>{t("privacySection2_3Item1")}</li>
                        <li>{t("privacySection2_3Item2")}</li>
                        <li>{t("privacySection2_3Item3")}</li>
                        <li>{t("privacySection2_3Item4")}</li>
                        <li>{t("privacySection2_3Item5")}</li>
                      </ul>
                      <p className="italic">{t("privacySection2_3Note")}</p>
                    </div>
                  </div>
                </div>
              </section>

              {/* How We Use Information */}
              <section id="how-we-use" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    3. {t("privacySection3Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacySection3Content")}</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                      <li>{t("privacySection3Item1")}</li>
                      <li>{t("privacySection3Item2")}</li>
                      <li>{t("privacySection3Item3")}</li>
                      <li>{t("privacySection3Item4")}</li>
                      <li>{t("privacySection3Item5")}</li>
                      <li>{t("privacySection3Item6")}</li>
                      <li>{t("privacySection3Item7")}</li>
                      <li>{t("privacySection3Item8")}</li>
                    </ul>
                    <p className="font-semibold">{t("privacySection3Note")}</p>
                  </div>
                </div>
              </section>

              {/* How We Share Information */}
              <section id="how-we-share" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    4. {t("privacySection4Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacySection4Content")}</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                      <li>{t("privacySection4Item1")}</li>
                      <li>{t("privacySection4Item2")}</li>
                      <li>{t("privacySection4Item3")}</li>
                      <li>{t("privacySection4Item4")}</li>
                    </ul>
                    <p className="font-semibold">{t("privacySection4Note")}</p>
                  </div>
                </div>
              </section>

              {/* Data Retention */}
              <section id="data-retention" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    5. {t("privacySection5Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacySection5Content")}</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                      <li>{t("privacySection5Item1")}</li>
                      <li>{t("privacySection5Item2")}</li>
                      <li>{t("privacySection5Item3")}</li>
                      <li>{t("privacySection5Item4")}</li>
                    </ul>
                    <p>{t("privacySection5Note")}</p>
                  </div>
                </div>
              </section>

              {/* Security */}
              <section id="security" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    6. {t("privacySection6Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacySection6Content")}</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                      <li>{t("privacySection6Item1")}</li>
                      <li>{t("privacySection6Item2")}</li>
                      <li>{t("privacySection6Item3")}</li>
                      <li>{t("privacySection6Item4")}</li>
                      <li>{t("privacySection6Item5")}</li>
                    </ul>
                    <p>{t("privacySection6Note")}</p>
                  </div>
                </div>
              </section>

              {/* Your Rights */}
              <section id="your-rights" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    7. {t("privacySection7Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacySection7Content")}</p>
                    <ul className="list-disc list-inside space-y-1 ml-4 mb-4">
                      <li>{t("privacySection7Item1")}</li>
                      <li>{t("privacySection7Item2")}</li>
                      <li>{t("privacySection7Item3")}</li>
                      <li>{t("privacySection7Item4")}</li>
                      <li>{t("privacySection7Item5")}</li>
                    </ul>
                    <p>{t("privacySection7Note")}</p>
                  </div>
                </div>
              </section>

              {/* Children's Privacy */}
              <section id="children-privacy" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    8. {t("privacySection8Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("privacySection8Content")}</p>
                  </div>
                </div>
              </section>

              {/* International Data Transfers */}
              <section id="international-transfers" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    9. {t("privacySection9Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("privacySection9Content")}</p>
                  </div>
                </div>
              </section>

              {/* Updates to This Policy */}
              <section id="updates" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    10. {t("privacySection10Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("privacySection10Content")}</p>
                  </div>
                </div>
              </section>

              {/* Contact Section */}
              <section id="contact" className="scroll-mt-24">
                <div className="p-5 md:p-8 lg:p-10 rounded-2xl bg-gradient-to-br from-blue-500/10 to-purple-500/10 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-xl sm:text-2xl font-bold mb-4 text-slate-900 dark:text-slate-100">
                    11. {t("privacyContactTitle")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-3">{t("privacyContactDescription")}</p>
                    <p>
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
          </div>
        </div>
      </section>
    </div>
  );
}

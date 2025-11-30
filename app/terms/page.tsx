"use client";

import { useTranslation } from "@/hooks/useTranslation";
import { FileText } from "lucide-react";
import TableOfContents from "@/components/legal/TableOfContents";

export default function TermsPage() {
  const t = useTranslation();

  const tocItems = [
    { id: "agreement", label: t("termsTOCAgreement") },
    { id: "description", label: t("termsTOCDescription") },
    { id: "eligibility", label: t("termsTOCEligibility") },
    { id: "accounts", label: t("termsTOCAccounts") },
    { id: "acceptable-use", label: t("termsTOCAcceptableUse") },
    { id: "user-content", label: t("termsTOCUserContent") },
    { id: "payments", label: t("termsTOCPayments") },
    { id: "termination", label: t("termsTOCTermination") },
    { id: "ai-outputs", label: t("termsTOCAIOutputs") },
    { id: "warranties", label: t("termsTOCWarranties") },
    { id: "liability", label: t("termsTOCLiability") },
    { id: "indemnification", label: t("termsTOCIndemnification") },
    { id: "governing-law", label: t("termsTOCGoverningLaw") },
    { id: "changes", label: t("termsTOCChanges") },
    { id: "contact", label: t("termsTOCContact") },
  ];

  return (
    <div className="min-h-screen bg-white dark:bg-[#0B1120] text-slate-900 dark:text-slate-100">
      {/* Hero Section */}
      <div className="border-b border-slate-200 dark:border-slate-700">
        <div className="pt-12 sm:pt-16 pb-12 sm:pb-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto text-center">
              <div className="flex items-center justify-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                  <FileText className="h-8 w-8 text-purple-500" />
                </div>
              </div>
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-6 bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                {t("termsPageTitle")}
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 font-light leading-relaxed max-w-3xl mx-auto">
                {t("termsPageDescription")}
              </p>
              <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
                {t("termsLastUpdated")}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <section className="py-12 sm:py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-8 lg:gap-12">
            {/* Table of Contents */}
            <TableOfContents items={tocItems} />

            {/* Content */}
            <div className="max-w-3xl mx-auto lg:mx-0 space-y-10">
              {/* Agreement to Terms */}
              <section id="agreement" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    1. {t("termsSection1Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("termsSection1Content")}</p>
                  </div>
                </div>
              </section>

              {/* Description of Service */}
              <section id="description" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    2. {t("termsSection2Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection2Content")}</p>
                    <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                      <li>{t("termsSection2Item1")}</li>
                      <li>{t("termsSection2Item2")}</li>
                      <li>{t("termsSection2Item3")}</li>
                      <li>{t("termsSection2Item4")}</li>
                    </ul>
                    <p>{t("termsSection2Note")}</p>
                  </div>
                </div>
              </section>

              {/* Eligibility */}
              <section id="eligibility" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    3. {t("termsSection3Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("termsSection3Content")}</p>
                  </div>
                </div>
              </section>

              {/* Accounts */}
              <section id="accounts" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    4. {t("termsSection4Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection4Content")}</p>
                    <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                      <li>{t("termsSection4Item1")}</li>
                      <li>{t("termsSection4Item2")}</li>
                      <li>{t("termsSection4Item3")}</li>
                    </ul>
                    <p>{t("termsSection4Note")}</p>
                  </div>
                </div>
              </section>

              {/* Acceptable Use */}
              <section id="acceptable-use" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    5. {t("termsSection5Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection5Content")}</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>{t("termsSection5Item1")}</li>
                      <li>{t("termsSection5Item2")}</li>
                      <li>{t("termsSection5Item3")}</li>
                      <li>{t("termsSection5Item4")}</li>
                      <li>{t("termsSection5Item5")}</li>
                      <li>{t("termsSection5Item6")}</li>
                      <li>{t("termsSection5Item7")}</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* User Content */}
              <section id="user-content" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    6. {t("termsSection6Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection6Content1")}</p>
                    <p className="mb-4">{t("termsSection6Content2")}</p>
                    <p className="font-semibold">{t("termsSection6Note")}</p>
                  </div>
                </div>
              </section>

              {/* Payments & Billing */}
              <section id="payments" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    7. {t("termsSection7Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection7Content")}</p>
                    <p className="font-semibold">{t("termsSection7Note")}</p>
                  </div>
                </div>
              </section>

              {/* Termination */}
              <section id="termination" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    8. {t("termsSection8Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection8Content1")}</p>
                    <p className="mb-4">{t("termsSection8Content2")}</p>
                    <ul className="list-disc list-inside space-y-2 ml-4 mb-4">
                      <li>{t("termsSection8Item1")}</li>
                      <li>{t("termsSection8Item2")}</li>
                      <li>{t("termsSection8Item3")}</li>
                      <li>{t("termsSection8Item4")}</li>
                    </ul>
                    <p>{t("termsSection8Note")}</p>
                  </div>
                </div>
              </section>

              {/* AI-Generated Outputs */}
              <section id="ai-outputs" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    9. {t("termsSection9Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection9Content1")}</p>
                    <p>{t("termsSection9Content2")}</p>
                  </div>
                </div>
              </section>

              {/* Warranties & Disclaimers */}
              <section id="warranties" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    10. {t("termsSection10Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection10Content1")}</p>
                    <p>{t("termsSection10Content2")}</p>
                  </div>
                </div>
              </section>

              {/* Limitation of Liability */}
              <section id="liability" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    11. {t("termsSection11Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection11Content")}</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>{t("termsSection11Item1")}</li>
                      <li>{t("termsSection11Item2")}</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Indemnification */}
              <section id="indemnification" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    12. {t("termsSection12Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsSection12Content")}</p>
                    <ul className="list-disc list-inside space-y-2 ml-4">
                      <li>{t("termsSection12Item1")}</li>
                      <li>{t("termsSection12Item2")}</li>
                      <li>{t("termsSection12Item3")}</li>
                      <li>{t("termsSection12Item4")}</li>
                    </ul>
                  </div>
                </div>
              </section>

              {/* Governing Law */}
              <section id="governing-law" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    13. {t("termsSection13Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("termsSection13Content")}</p>
                  </div>
                </div>
              </section>

              {/* Changes to Terms */}
              <section id="changes" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    14. {t("termsSection14Title")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p>{t("termsSection14Content")}</p>
                  </div>
                </div>
              </section>

              {/* Contact Section */}
              <section id="contact" className="scroll-mt-24">
                <div className="p-6 md:p-12 lg:p-24 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-slate-200 dark:border-slate-700 shadow-sm">
                  <h2 className="text-2xl sm:text-3xl font-bold mb-6 text-slate-900 dark:text-slate-100">
                    15. {t("termsContactTitle")}
                  </h2>
                  <div className="prose prose-slate dark:prose-invert max-w-none text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    <p className="mb-4">{t("termsContactDescription")}</p>
                    <p>
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
          </div>
        </div>
      </section>
    </div>
  );
}

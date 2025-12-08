"use client";

import { Phone, Mail, Image, BarChart3, Brain, Users, Target } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

export default function AboutPage() {
  const t = useTranslation();

  const memoryItems = [
    t("memoryItem1"),
    t("memoryItem2"),
    t("memoryItem3"),
    t("memoryItem4"),
    t("memoryItem5"),
  ];

  const targetAudience = [
    t("targetAudience1"),
    t("targetAudience2"),
    t("targetAudience3"),
    t("targetAudience4"),
  ];

  const philosophyPoints = [
    t("philosophyPoint1"),
    t("philosophyPoint2"),
    t("philosophyPoint3"),
    t("philosophyPoint4"),
  ];
  
  const aiTeamRoles = [
    {
      role: t("aiTeamRoleSync"),
      description: t("aiTeamRoleSyncDescription"),
      icon: Mail,
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
    },
    {
      role: t("aiTeamRoleAloha"),
      description: t("aiTeamRoleAlohaDescription"),
      icon: Phone,
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      role: t("aiTeamRoleStudio"),
      description: t("aiTeamRoleStudioDescription"),
      icon: Image,
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
    },
    {
      role: t("aiTeamRoleInsight"),
      description: t("aiTeamRoleInsightDescription"),
      icon: BarChart3,
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
  ];
  
  const whereOvrseeGoingPoints = [
    t("whereOvrseeGoingPoint1"),
    t("whereOvrseeGoingPoint2"),
    t("whereOvrseeGoingPoint3"),
    t("whereOvrseeGoingPoint4"),
  ];

  return (
    <div className="min-h-screen bg-white text-slate-900 dark:bg-black dark:text-slate-100">
      {/* Hero Section */}
      <div className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="pt-8 sm:pt-12 pb-12 sm:pb-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold tracking-tight mb-5 bg-gradient-to-br from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                {t("aboutTitle")}
              </h1>
              <p className="text-lg sm:text-xl lg:text-2xl text-slate-600 dark:text-slate-300 font-light leading-relaxed max-w-3xl mb-4">
                {t("aboutSubtitle")}
              </p>
              <div className="flex flex-wrap gap-3 text-sm sm:text-base text-slate-500 dark:text-slate-400">
                <span>• {t("aboutSubtitleSupport1")}</span>
                <span>• {t("aboutSubtitleSupport2")}</span>
                <span>• {t("aboutSubtitleSupport3")}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* What OVRSEE is Section */}
      <section className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left: What it does */}
              <div className="space-y-6">
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold">{t("whatItDoes")}</h3>
                <div className="space-y-4">
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t("whatItDoesDescription1")}
                  </p>
                  <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t("whatItDoesDescription2")}
                  </p>
                </div>
                <div className="relative pt-6">
                  <div className="aspect-square max-w-xs mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-slate-200 dark:border-slate-800/50 backdrop-blur-sm flex items-center justify-center">
                    <Brain className="h-16 w-16 sm:h-20 sm:w-20 text-slate-400 dark:text-slate-700 opacity-50" />
                  </div>
                </div>
              </div>

              {/* Right: A shared brain */}
              <div className="space-y-6">
                <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold">{t("sharedBrain")}</h3>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("sharedBrainDescription")}
                </p>
                <div className="space-y-2.5">
                  {memoryItems.map((item, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3 p-3 sm:p-4 rounded-lg bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/30 hover:border-slate-300 dark:hover:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-all duration-200"
                    >
                      <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{item}</p>
                    </div>
                  ))}
                </div>
                <div className="p-5 sm:p-6 rounded-xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-slate-200 dark:border-slate-800/50">
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t("sharedMemoryNote")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Your AI Team, Modeled After Real Roles Section */}
      <section className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-8 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-3">{t("aiTeamRolesTitle")}</h2>
              <p className="text-base sm:text-lg text-slate-500 dark:text-slate-400 max-w-3xl">
                {t("aiTeamRolesDescription")}
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
              {aiTeamRoles.map((item, index) => {
                const Icon = item.icon;
                return (
                  <div
                    key={index}
                    className="p-5 sm:p-6 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-all duration-300"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${item.bgColor} border ${item.borderColor} flex-shrink-0`}>
                        <Icon className={`h-5 w-5 ${item.color}`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg sm:text-xl font-semibold mb-2 text-slate-900 dark:text-slate-100">{item.role}</h3>
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Why We Built OVRSEE Section */}
      <section className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-6 sm:mb-8">{t("whyWeBuiltTitle")}</h2>
              <div className="space-y-6">
                <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("whyWeBuiltDescription1")}
                </p>
                <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("whyWeBuiltDescription2")}
                </p>
                <p className="text-base sm:text-lg lg:text-xl text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("whyWeBuiltDescription3")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who It's For & Our Philosophy Section */}
      <section className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-12">
              {/* Left: Who It's For */}
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("whoItsFor")}</h2>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("whoItsForDescription")}
                </p>
                <div className="space-y-3">
                  {targetAudience.map((item, index) => (
                    <div
                      key={index}
                      className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-all duration-200"
                    >
                      <div className="flex items-center gap-3">
                        <Users className="h-4 w-4 sm:h-5 sm:w-5 text-emerald-500 dark:text-emerald-400 opacity-60 flex-shrink-0" />
                        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{item}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="p-5 sm:p-6 rounded-xl bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-800/50">
                  <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed">
                    {t("whoItsForCloser")}
                  </p>
                </div>
              </div>

              {/* Right: Our Philosophy */}
              <div className="space-y-6">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">{t("ourPhilosophy")}</h2>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("philosophyDescription1")}
                </p>
                <div className="space-y-3">
                  {philosophyPoints.map((point, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-3 sm:p-4 rounded-lg bg-slate-100 dark:bg-slate-800/30 border border-slate-200 dark:border-slate-700/30 hover:border-slate-300 dark:hover:border-slate-600/50 transition-all duration-200"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-500 dark:bg-blue-400 mt-2 flex-shrink-0" />
                      <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{point}</p>
                    </div>
                  ))}
                </div>
                <p className="text-base sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t("philosophyClosing")}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Where OVRSEE Is Going Section */}
      <section className="border-b border-slate-200 dark:border-slate-800/50">
        <div className="py-12 sm:py-16 lg:py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-100 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-800/50 text-sm text-slate-600 dark:text-slate-400 mb-6">
                <Target className="h-4 w-4" />
                <span>{t("whereOvrseeGoingTitle")}</span>
              </div>
              <h3 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 dark:text-slate-100 mb-6">
                {t("whereOvrseeGoingDescription")}
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                {whereOvrseeGoingPoints.map((point, index) => (
                  <div
                    key={index}
                    className="p-4 sm:p-5 rounded-xl bg-slate-50 dark:bg-slate-900/30 border border-slate-200 dark:border-slate-800/50 hover:border-slate-300 dark:hover:border-slate-700/50 hover:bg-slate-100 dark:hover:bg-slate-900/40 transition-all duration-200"
                  >
                    <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300">{point}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

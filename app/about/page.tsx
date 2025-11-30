"use client";

import { Phone, Mail, Palette, BarChart3, Brain, Users, Sparkles } from "lucide-react";

export default function AboutPage() {
  const agents = [
    {
      name: "Aloha",
      tagline: "Voice & Calls",
      icon: Phone,
      description: "Aloha handles calls and call intelligence. It answers, routes, and summarizes calls, tracks missed opportunities, surfaces important callers, and suggests who to follow up with first.",
      color: "text-blue-400",
      bgColor: "bg-blue-500/10",
      borderColor: "border-blue-500/20",
    },
    {
      name: "Sync",
      tagline: "Inbox & Calendar",
      icon: Mail,
      description: "Sync is your email and calendar brain. It prioritizes important senders, flags follow-ups, detects stale threads, and helps you respond faster while staying ahead of what's on your schedule.",
      color: "text-orange-400",
      bgColor: "bg-orange-500/10",
      borderColor: "border-orange-500/20",
    },
    {
      name: "Studio",
      tagline: "Media & Branding",
      icon: Palette,
      description: "Studio learns your brand tone, style, and audience. It helps you craft on-brand copy and content for posts, campaigns, and creative assets, using the same shared memory.",
      color: "text-purple-400",
      bgColor: "bg-purple-500/10",
      borderColor: "border-purple-500/20",
    },
    {
      name: "Insight",
      tagline: "Business Intelligence",
      icon: BarChart3,
      description: "Insight is the strategic layer. It rolls up all the signals—calls, emails, activity, results—into daily, weekly, and monthly briefs, health scores, and recommendations so you always know what's really happening across your business.",
      color: "text-emerald-400",
      bgColor: "bg-emerald-500/10",
      borderColor: "border-emerald-500/20",
    },
  ];

  const capabilities = [
    "Turns raw activity (calls, emails, content, metrics) into clear insights.",
    "Learns your habits, priorities, and important relationships over time.",
    "Suggests and runs actions: draft emails, schedule calls, create tasks, or trigger workflows.",
    "Keeps your team aligned around the same workspace memory and intelligence.",
  ];

  const memoryItems = [
    "your key contacts and relationships",
    "your working hours and patterns",
    "your goals and priorities",
    "recurring risks and bottlenecks",
    "how you like to work",
  ];

  const targetAudience = [
    "handle a lot of calls and emails",
    "rely on client relationships",
    "create content or run campaigns",
    "don't have time to babysit a dozen tools",
  ];

  const philosophyPoints = [
    "aware of what's happening",
    "aligned with what you care about",
    "proactive in what it suggests",
    "trusted to help you execute",
  ];

  return (
    <div className="min-h-screen bg-black text-slate-100">
      {/* Hero Section */}
      <div className="border-b border-slate-800/50">
        <div className="pt-8 sm:pt-12 pb-12 sm:pb-16">
          <div className="max-w-4xl">
            <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight mb-5 bg-gradient-to-br from-white to-slate-400 bg-clip-text text-transparent">
              About OVRSEE
            </h1>
            <p className="text-xl sm:text-2xl text-slate-300 font-light leading-relaxed max-w-3xl">
              An AI Chief of Staff for modern operators, founders, and teams.
            </p>
          </div>
        </div>
      </div>

      {/* Intro Section - Two Column */}
      <section className="border-b border-slate-800/50">
        <div className="py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900/50 border border-slate-800/50 text-sm text-slate-400">
                <Sparkles className="h-4 w-4" />
                <span>Mission</span>
              </div>
              <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-lg">
                Instead of a single chatbot, it's a network of four specialized agents—Aloha, Sync, Studio, and Insight—all sharing one workspace memory and one brain that learns how you actually work.
              </p>
            </div>
            <div className="relative">
              <div className="aspect-square max-w-xs mx-auto rounded-2xl bg-gradient-to-br from-blue-500/10 via-purple-500/10 to-emerald-500/10 border border-slate-800/50 backdrop-blur-sm flex items-center justify-center">
                <Brain className="h-20 w-20 text-slate-700 opacity-50" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* What it does Section */}
      <section className="border-b border-slate-800/50">
        <div className="py-16 sm:py-20">
          <div className="max-w-4xl space-y-8">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">What it does</h2>
              <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl">
                It connects your calls, inbox, calendar, content, and business signals into a single intelligent system.
              </p>
              <p className="text-lg sm:text-xl text-slate-300 leading-relaxed max-w-3xl mt-4">
                It doesn't just answer questions—it monitors what's happening, surfaces what matters, and helps you take the next step with one click.
              </p>
            </div>

            <div className="pt-8">
              <h3 className="text-xl sm:text-2xl font-semibold mb-5 text-slate-200">Key capabilities</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {capabilities.map((capability, index) => (
                  <div
                    key={index}
                    className="group relative p-6 rounded-xl bg-slate-900/30 border border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-900/40 transition-all duration-300 hover:shadow-lg hover:shadow-blue-500/5 hover:-translate-y-0.5"
                  >
                    <div className="absolute top-6 left-6 w-1.5 h-1.5 rounded-full bg-blue-500 opacity-60 group-hover:opacity-100 transition-opacity" />
                    <p className="text-slate-300 leading-relaxed pl-6">{capability}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Agents Section */}
      <section className="border-b border-slate-800/50">
        <div className="py-16 sm:py-20">
          <div className="mb-10">
            <h2 className="text-3xl sm:text-4xl font-bold mb-3">The agents</h2>
            <p className="text-lg text-slate-400 max-w-2xl">
              Four specialized agents working in harmony with shared intelligence
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {agents.map((agent, index) => {
              const Icon = agent.icon;
              return (
                <div
                  key={index}
                  className="group relative p-8 rounded-2xl bg-slate-900/30 border border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-900/40 transition-all duration-300 hover:shadow-xl hover:shadow-black/20 hover:-translate-y-1"
                >
                  <div className="flex items-start gap-4 mb-4">
                    <div className={`p-3 rounded-xl ${agent.bgColor} border ${agent.borderColor}`}>
                      <Icon className={`h-6 w-6 ${agent.color}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-semibold mb-1">{agent.name}</h3>
                      <p className="text-sm text-slate-400">{agent.tagline}</p>
                    </div>
                  </div>
                  <p className="text-slate-300 leading-relaxed">{agent.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Shared Brain Section - Two Column */}
      <section className="border-b border-slate-800/50">
        <div className="py-16 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-start">
            <div>
              <h2 className="text-3xl sm:text-4xl font-bold mb-5">A shared brain for your workspace</h2>
              <p className="text-lg text-slate-300 leading-relaxed mb-6">
                It maintains a long-term memory of:
              </p>
              <div className="space-y-3">
                {memoryItems.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-4 p-4 rounded-lg bg-slate-900/30 border border-slate-800/30 hover:border-slate-700/50 hover:bg-slate-900/40 transition-all duration-200"
                  >
                    <div className="w-2 h-2 rounded-full bg-purple-500 flex-shrink-0" />
                    <p className="text-slate-300">{item}</p>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-6">
              <div className="p-8 rounded-2xl bg-gradient-to-br from-purple-500/10 to-blue-500/10 border border-slate-800/50">
                <p className="text-lg text-slate-300 leading-relaxed">
                  This memory is shared across the agents, so every suggestion gets more personalized over time, and every teammate benefits from the same context.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Who it's for Section */}
      <section className="border-b border-slate-800/50">
        <div className="py-16 sm:py-20">
          <div className="max-w-4xl">
            <div className="mb-10">
              <h2 className="text-3xl sm:text-4xl font-bold mb-3">Who it's for</h2>
              <p className="text-lg text-slate-300 leading-relaxed max-w-2xl">
                Built for small and midsize teams that:
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              {targetAudience.map((item, index) => (
                <div
                  key={index}
                  className="p-5 rounded-xl bg-slate-900/30 border border-slate-800/50 hover:border-slate-700/50 hover:bg-slate-900/40 transition-all duration-200"
                >
                  <div className="flex items-center gap-3">
                    <Users className="h-5 w-5 text-emerald-400 opacity-60" />
                    <p className="text-slate-300">{item}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800/50">
              <p className="text-lg text-slate-300 leading-relaxed">
                If you're a founder, operator, agency, or lean team trying to do more with less, it acts like a Chief of Staff that never sleeps—watching, organizing, and nudging the right actions.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Philosophy Section */}
      <section className="border-b border-slate-800/50">
        <div className="py-16 sm:py-20">
          <div className="max-w-4xl">
            <div className="relative p-8 sm:p-12 rounded-3xl bg-gradient-to-br from-slate-900 via-slate-900/90 to-slate-900 border border-slate-800/50 overflow-hidden">
              <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
              <div className="absolute bottom-0 left-0 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
              
              <div className="relative z-10">
                <h2 className="text-3xl sm:text-4xl font-bold mb-5">Our philosophy</h2>
                <p className="text-lg sm:text-xl text-slate-300 leading-relaxed mb-5">
                  We believe AI shouldn't be a toy bolted onto your tools.
                </p>
                <p className="text-lg text-slate-300 leading-relaxed mb-6">
                  It should be the nervous system of your workflow:
                </p>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
                  {philosophyPoints.map((point, index) => (
                    <div
                      key={index}
                      className="flex items-start gap-3 p-4 rounded-lg bg-slate-800/30 border border-slate-700/30 hover:border-slate-600/50 transition-all duration-200"
                    >
                      <div className="w-1.5 h-1.5 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                      <p className="text-slate-300">{point}</p>
                    </div>
                  ))}
                </div>
                
                <p className="text-lg text-slate-300 leading-relaxed">
                  This is our attempt to build that system.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

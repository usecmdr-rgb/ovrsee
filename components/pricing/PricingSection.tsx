"use client";

import { Check, X } from "lucide-react";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/hooks/useTranslation";

// This component is now using PricingTable which has full translations
// Keeping this file for reference but it's not actively used
const tiers: any[] = [];
const agentMatrix: any[] = [];

function InclusionIcon({ included }: { included: boolean }) {
  if (included) {
    return (
      <div className="flex items-center justify-center">
        <Check className="h-4 w-4" aria-hidden="true" />
      </div>
    );
  }
  return (
    <div className="flex items-center justify-center opacity-40">
      <X className="h-4 w-4" aria-hidden="true" />
    </div>
  );
}

export default function PricingSection() {
  const t = useTranslation();
  
  // Build tiers dynamically using translations
  const tiers = [
    {
      name: t("basic"),
      price: "€29.99",
      subtitle: t("pricingTierBasicSubtitle"),
      badge: t("pricingTierBasicBadge"),
      features: [
        t("pricingTierBasicFeature1"),
        t("pricingTierBasicFeature2"),
        t("pricingTierBasicFeature3"),
        t("pricingTierBasicFeature4"),
        t("pricingTierBasicFeature5"),
        t("pricingTierBasicFeature6"),
      ],
      highlight: false,
    },
    {
      name: t("advanced"),
      price: "€79.99",
      subtitle: t("pricingTierAdvancedSubtitle"),
      badge: t("mostPopular"),
      features: [
        t("pricingTierAdvancedFeature1"),
        t("pricingTierAdvancedFeature2"),
        t("pricingTierAdvancedFeature3"),
        t("pricingTierAdvancedFeature4"),
        t("pricingTierAdvancedFeature5"),
        t("pricingTierAdvancedFeature6"),
      ],
      highlight: true,
    },
    {
      name: t("elite"),
      price: "€129.99",
      subtitle: t("pricingTierEliteSubtitle"),
      badge: t("pricingTierEliteBadge"),
      features: [
        t("pricingTierEliteFeature1"),
        t("pricingTierEliteFeature2"),
        t("pricingTierEliteFeature3"),
        t("pricingTierEliteFeature4"),
        t("pricingTierEliteFeature5"),
        t("pricingTierEliteFeature6"),
      ],
      highlight: false,
    },
  ];

  const agentMatrix = [
    {
      agent: t("agentSync"),
      description: t("pricingSyncDescription"),
      basic: true,
      advanced: true,
      elite: true,
    },
    {
      agent: t("agentAloha"),
      description: t("pricingAlohaDescription"),
      basic: false,
      advanced: true,
      elite: true,
    },
    {
      agent: t("agentStudio"),
      description: t("pricingStudioDescription"),
      basic: false,
      advanced: true,
      elite: true,
    },
    {
      agent: t("agentInsight"),
      description: t("pricingInsightDescription"),
      basic: false,
      advanced: false,
      elite: true,
    },
  ];

  return (
    <section className="w-full max-w-6xl mx-auto px-4 py-16 space-y-12">
      {/* Header */}
      <div className="text-center space-y-3">
        <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
          {t("pricingThatGrowsTitle")}
        </h2>
        <p className="text-sm md:text-base text-muted-foreground max-w-2xl mx-auto">
          {t("pricingThatGrowsDescription")}
        </p>
      </div>

      {/* Tier cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => (
          <Card
            key={tier.name}
            className={`flex flex-col h-full border ${
              tier.highlight ? "border-primary shadow-lg shadow-black/5" : ""
            }`}
          >
            <CardHeader className="space-y-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                {tier.badge && (
                  <span className="rounded-full border px-2.5 py-0.5 text-xs uppercase tracking-wide">
                    {tier.badge}
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-3xl font-semibold">{tier.price}</span>
                <span className="text-xs text-muted-foreground">/ month</span>
              </div>
              <CardDescription className="text-xs md:text-sm">
                {tier.subtitle}
              </CardDescription>
            </CardHeader>

            <CardContent className="flex flex-col flex-1 justify-between gap-6">
              <ul className="space-y-2 text-sm">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-4 w-4 mt-0.5" aria-hidden="true" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                className={`w-full mt-4 ${
                  tier.highlight
                    ? ""
                    : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
                }`}
                variant={tier.highlight ? "default" : "secondary"}
              >
                {t("pricingChooseTier").replace("{tier}", tier.name)}
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Agent access chart */}
      <div className="mt-10 space-y-4">
        <h3 className="text-lg md:text-xl font-semibold text-center">
          {t("pricingAgentAccessChart")}
        </h3>
        <p className="text-xs md:text-sm text-muted-foreground text-center max-w-3xl mx-auto">
          {t("pricingAgentAccessDescription")}
        </p>

        <div className="overflow-x-auto rounded-2xl border bg-background">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40">
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  {t("pricingAgentColumn")}
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wide">
                  {t("pricingDescriptionColumn")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide">
                  {t("pricingBasicColumn")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide">
                  {t("pricingAdvancedColumn")}
                </th>
                <th className="px-4 py-3 text-center text-xs font-medium uppercase tracking-wide">
                  {t("pricingEliteColumn")}
                </th>
              </tr>
            </thead>
            <tbody>
              {agentMatrix.map((row, idx) => (
                <tr
                  key={row.agent}
                  className={idx % 2 === 0 ? "border-b" : "border-b bg-muted/20"}
                >
                  <td className="px-4 py-3 font-medium whitespace-nowrap">{row.agent}</td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {row.description}
                  </td>
                  <td className="px-4 py-3">
                    <InclusionIcon included={row.basic} />
                  </td>
                  <td className="px-4 py-3">
                    <InclusionIcon included={row.advanced} />
                  </td>
                  <td className="px-4 py-3">
                    <InclusionIcon included={row.elite} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}

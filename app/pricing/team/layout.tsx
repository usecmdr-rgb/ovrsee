import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team Pricing | OVRSEE",
  description: "Configure your team plan with custom per-seat pricing. Mix and match Essentials, Professional, and Executive tiers. Automatic discounts for 5+ seats.",
};

export default function TeamPricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}




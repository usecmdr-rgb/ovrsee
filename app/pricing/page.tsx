import type { Metadata } from "next";
import PricingTable from "@/components/pricing/PricingTable";
import PlanAdvisor from "@/components/pricing/PlanAdvisor";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Choose your OVRSEE tier: Basic ($39.99/mo), Advanced ($99.99/mo), or Elite ($159.99/mo). Start your 3-day free trial today.",
};

export default function PricingPage() {
  return (
    <div className="w-full max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight font-sans mb-2">
          Pricing
        </h1>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="lg:sticky lg:top-8 flex">
          <PlanAdvisor mode="anonymous" />
        </div>
        <div className="flex">
          <PricingTable />
        </div>
      </div>
    </div>
  );
}

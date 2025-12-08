"use client";

import StudioIntelligence from "@/components/studio/StudioIntelligence";

export default function StudioChatPage() {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100">
          Studio Agent
        </h1>
        <p className="text-slate-600 dark:text-slate-400 mt-1">
          Your AI social operator. Create posts, schedule content, repurpose, run experiments, and generate weekly plans—just ask.
        </p>
      </div>
      <StudioIntelligence />
    </div>
  );
}


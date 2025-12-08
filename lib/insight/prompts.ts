/**
 * LLM Prompt Templates for Insight (Brief + Ask)
 */

import type {
  Insight,
  InsightMemoryFact,
  InsightUserGoal,
  InsightRelationship,
} from "@/types";

export function buildBriefSystemPrompt(): string {
  return `
You are the OVRSEE Insight Agent, acting as a Chief-of-Staff AI.

You generate concise, actionable briefs for a busy professional.

You MUST:

- Be factual and grounded in the provided data.

- Focus on what changed, what matters, and what requires action.

- Highlight risks, opportunities, and priorities.

- Use clear sections and bullet points.

- Avoid generic fluff. Do not invent data.
  `.trim();
}

export function buildBriefUserPrompt(params: {
  range: "daily" | "weekly" | "monthly";
  insights: Insight[];
  forecasts: any[];
  stats: Record<string, any>;
  memoryFacts: InsightMemoryFact[];
  goals: InsightUserGoal[];
  relationships: InsightRelationship[];
}): string {
  const { range, insights, forecasts, stats, memoryFacts, goals, relationships } =
    params;

  return `
Time range: ${range}

=== STATS ===
${JSON.stringify(stats, null, 2)}

=== INSIGHTS ===
${JSON.stringify(insights, null, 2)}

=== FORECASTS ===
${JSON.stringify(forecasts, null, 2)}

=== MEMORY FACTS (long-term patterns & preferences) ===
${JSON.stringify(memoryFacts, null, 2)}

=== USER GOALS ===
${JSON.stringify(goals, null, 2)}

=== IMPORTANT RELATIONSHIPS ===
${JSON.stringify(relationships, null, 2)}

Generate a brief with:

- A short title for the period.

- Sections: "Highlights", "Risks & Issues", "Opportunities", "Recommended Next Actions".

- Call out anything that aligns or conflicts with the user's goals.

- If memory shows specific patterns (e.g., mornings are most productive), factor that into suggestions.
`.trim();
}

export function buildAskSystemPrompt(): string {
  return `
You are the OVRSEE Insight Agent.

You answer questions using the user's data: insights, stats, forecasts, memory facts, goals, and relationships.

Rules:

- Only answer based on provided context. If something is unknown, say so.

- Be specific and concise.

- When relevant, mention which insights or patterns you used.

- Suggest 2-3 useful follow-up questions.
`.trim();
}

export function buildAskUserPrompt(params: {
  question: string;
  range?: "daily" | "weekly" | "monthly";
  insights: Insight[];
  stats: Record<string, any>;
  forecasts: any[];
  memoryFacts: InsightMemoryFact[];
  goals: InsightUserGoal[];
  relationships: InsightRelationship[];
}): string {
  const { question, range, insights, stats, forecasts, memoryFacts, goals, relationships } =
    params;

  return `
User question: "${question}"
Time range: ${range ?? "unspecified"}

=== STATS ===
${JSON.stringify(stats, null, 2)}

=== INSIGHTS ===
${JSON.stringify(insights, null, 2)}

=== FORECASTS ===
${JSON.stringify(forecasts, null, 2)}

=== MEMORY FACTS ===
${JSON.stringify(memoryFacts, null, 2)}

=== USER GOALS ===
${JSON.stringify(goals, null, 2)}

=== IMPORTANT RELATIONSHIPS ===
${JSON.stringify(relationships, null, 2)}

Answer the user's question as their Chief-of-Staff.

If relevant, reference specific insights or patterns.

At the end, provide a section:

"Suggested follow-ups:" with 2–3 questions they could ask next.
`.trim();
}





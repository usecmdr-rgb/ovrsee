/**
 * Studio Insights OpenAI Helper
 * Generates insights from social media summary using OpenAI
 */

import { openai } from "@/lib/openai";
import { AGENT_CONFIG } from "@/lib/agents/config";
import type { SocialSummary } from "@/app/api/studio/social/summary/route";

const MAX_SUMMARY_TOKENS = 4000; // Limit context size

/**
 * Truncate summary JSON to fit within token limits
 */
function truncateSummary(summary: SocialSummary): SocialSummary {
  // Simple truncation: limit top_posts to 5 per platform
  const truncated: SocialSummary = {};

  if (summary.instagram) {
    truncated.instagram = {
      ...summary.instagram,
      top_posts: summary.instagram.top_posts.slice(0, 5),
    };
  }

  if (summary.tiktok) {
    truncated.tiktok = {
      ...summary.tiktok,
      top_posts: summary.tiktok.top_posts.slice(0, 5),
    };
  }

  return truncated;
}

/**
 * Generate Studio insights from social media summary
 */
export async function generateStudioInsights(
  question: string,
  summary: SocialSummary
): Promise<string> {
  // Truncate summary if needed to fit token limits
  const truncatedSummary = truncateSummary(summary);

  const systemPrompt = `You are the OVRSEE Studio branding assistant. You analyze cross-platform social media performance data and provide clear, actionable insights about what's working and what's not.

Your responses should:
- Be concise and easy to understand
- Focus on concrete patterns and trends
- Provide specific recommendations
- Use plain language, avoiding jargon
- Reference specific metrics when relevant
- Format responses in markdown for readability`;

  const userPrompt = `User question: ${question}

Social Media Performance Summary:
${JSON.stringify(truncatedSummary, null, 2)}

Please analyze this data and answer the user's question. Focus on:
1. What content types/formats are performing best
2. What engagement patterns you notice
3. Specific recommendations for improvement
4. Any trends or anomalies worth noting`;

  try {
    const completion = await openai.chat.completions.create({
      model: AGENT_CONFIG.studio.primaryModel, // gpt-4o
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.7, // Balanced creativity/consistency
      max_tokens: 1000, // Reasonable response length
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("No content from OpenAI");
    }

    return content;
  } catch (error: any) {
    console.error("Error generating Studio insights:", error);
    throw new Error(
      `Failed to generate insights: ${error.message || "Unknown error"}`
    );
  }
}



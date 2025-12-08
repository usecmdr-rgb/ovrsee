/**
 * Email Classification Helper
 * Uses OpenAI to categorize emails into one of 6 fixed categories
 */

import { openai } from "@/lib/openai";

export type EmailCategory = 
  | "important"
  | "missed_unread"
  | "payment_bill"
  | "invoice"
  | "marketing"
  | "updates"
  | "other";

const VALID_CATEGORIES: EmailCategory[] = [
  "important",
  "missed_unread",
  "payment_bill",
  "invoice",
  "marketing",
  "updates",
  "other",
];

export interface ClassificationResult {
  category: EmailCategory;
  rawResponse?: any;
}

const SYSTEM_PROMPT = `You are an email classification assistant. Your task is to categorize emails into exactly ONE of these 7 categories:

1. **important**: Personal, urgent, security alerts, account notifications, or high-priority work messages that require attention.

2. **missed_unread**: Direct messages or conversations that clearly expect a reply and may have been missed. These are typically personal communications that need a response.

3. **payment_bill**: Bills, charges, bank notifications, payment reminders, upcoming payments, or financial account updates.

4. **invoice**: Invoices, receipts for business or services, payment confirmations, or billing documents.

5. **marketing**: Newsletters, promotional emails, marketing campaigns, sales announcements, or marketing blasts.

6. **updates**: Product updates, service notifications, system updates, feature announcements, or informational updates from services you use.

7. **other**: Everything else that doesn't clearly fit into the above categories.

You MUST return ONLY valid JSON with this exact structure:
{
  "category": "important" | "missed_unread" | "payment_bill" | "invoice" | "marketing" | "updates" | "other"
}

Choose the category that best fits the email content. Be consistent and accurate.`;

/**
 * Classify an email into one of the 6 fixed categories
 * 
 * @param fromAddress - Email sender address
 * @param subject - Email subject line
 * @param bodyText - Plain text body of the email (optional, but recommended)
 * @returns Classification result with category and raw response
 */
export async function classifyEmail(
  fromAddress: string,
  subject: string,
  bodyText?: string | null
): Promise<ClassificationResult> {
  try {
    // Build the user prompt with email content
    const emailContent = [
      `From: ${fromAddress}`,
      `Subject: ${subject}`,
      bodyText ? `Body: ${bodyText.substring(0, 2000)}` : "", // Limit body to 2000 chars
    ]
      .filter(Boolean)
      .join("\n\n");

    const userPrompt = `Classify this email:\n\n${emailContent}`;

    // Call OpenAI with JSON mode
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", // Use mini for cost efficiency
      messages: [
        {
          role: "system",
          content: SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: userPrompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1, // Low temperature for consistency
      max_tokens: 50, // Small response, just JSON
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[ClassifyEmail] Empty response from OpenAI");
      return { category: "other", rawResponse: response };
    }

    // Parse JSON response
    let parsed: { category?: string };
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[ClassifyEmail] Failed to parse JSON response:", content);
      return { category: "other", rawResponse: { content, error: "parse_error" } };
    }

    // Validate category
    const category = parsed.category;
    if (!category || !VALID_CATEGORIES.includes(category as EmailCategory)) {
      console.warn(
        `[ClassifyEmail] Invalid category "${category}", defaulting to "other"`
      );
      return {
        category: "other",
        rawResponse: { parsed, original: content },
      };
    }

    return {
      category: category as EmailCategory,
      rawResponse: response,
    };
  } catch (error: any) {
    console.error("[ClassifyEmail] Error classifying email:", error);
    // Return "other" as safe default on any error
    return {
      category: "other",
      rawResponse: { error: error.message || "unknown_error" },
    };
  }
}


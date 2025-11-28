import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { openai } from "@/lib/openai";

interface EmailToCategorize {
  id: string;
  subject: string;
  sender: string;
  snippet: string;
  body?: string;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.match(/^Bearer\s+(.*)$/i)?.[1]?.trim();
    const isDevUser = request.headers.get("x-dev-user") === "true";

    // In development, allow proceeding without auth token
    let userId: string;
    if ((!accessToken || accessToken === "dev-token" || isDevUser) && process.env.NODE_ENV !== "production") {
      console.warn("[/api/gmail/categorize] No access token found, using dev fallback user in development.");
      userId = "dev-user";
    } else if (accessToken && accessToken !== "dev-token") {
      const { data: userResult, error: userError } = await supabase.auth.getUser(accessToken);
      if (userError || !userResult?.user) {
        // In production, return Unauthorized. In dev, use fallback.
        if (process.env.NODE_ENV === "production") {
          return NextResponse.json(
            { error: "Unauthorized" },
            { status: 401 }
          );
        } else {
          console.warn("[/api/gmail/categorize] User auth failed, using dev fallback user in development.");
          userId = "dev-user";
        }
      } else {
        userId = userResult.user.id;
      }
    } else {
      // No access token and in production - return Unauthorized
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { emails }: { emails: EmailToCategorize[] } = body;

    if (!emails || !Array.isArray(emails)) {
      return NextResponse.json(
        { error: "Emails array is required" },
        { status: 400 }
      );
    }

    // Categorize emails using the sync agent
    const categorizedEmails = await Promise.all(
      emails.map(async (email) => {
        try {
          // Use OpenAI to categorize the email
          const prompt = `You are SYNC, the OVRSEE email + calendar agent. Analyze this email and categorize it.

Email from: ${email.sender}
Subject: ${email.subject}
Content: ${email.snippet}${email.body ? `\n\nFull body: ${email.body.substring(0, 1000)}` : ""}

Categorize this email into one of these categories:
- "important" - Urgent or high-priority emails requiring immediate attention
- "payments" - Payment requests, invoices, bills, or financial transactions
- "invoices" - Invoices specifically
- "missed" - Emails that need a reply but haven't been responded to
- "appointments" - Calendar invites, meeting requests, scheduling
- "other" - Everything else

Respond with ONLY the category name (one word, lowercase).`;

          const response = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
              {
                role: "system",
                content: "You are SYNC, an email categorization assistant. Respond with only the category name.",
              },
              {
                role: "user",
                content: prompt,
              },
            ],
            max_tokens: 10,
            temperature: 0.3,
          });

          const category = response.choices[0]?.message?.content?.trim().toLowerCase() || "other";
          
          // Validate category
          const validCategories = ["important", "payments", "invoices", "missed", "appointments", "other"];
          const finalCategory = validCategories.includes(category) ? category : "other";

          // Determine status
          let status: "drafted" | "needs_reply" | "archived" = "needs_reply";
          if (finalCategory === "missed") {
            status = "needs_reply";
          } else if (finalCategory === "other") {
            status = "archived";
          }

          return {
            ...email,
            categoryId: finalCategory,
            status,
          };
        } catch (error) {
          console.error(`Error categorizing email ${email.id}:`, error);
          return {
            ...email,
            categoryId: "other",
            status: "archived" as const,
          };
        }
      })
    );

    // Store categorized emails in database
    const emailSummaries = categorizedEmails.map((email) => ({
      user_id: userId,
      email_id: email.id,
      subject: email.subject,
      from_address: email.sender,
      importance: email.categoryId === "important" ? "high" : email.categoryId === "missed" ? "normal" : "low",
      summary: email.snippet,
      category: email.categoryId,
      status: email.status,
    }));

    // Upsert email summaries
    const { error: insertError } = await supabase
      .from("email_summaries")
      .upsert(emailSummaries, {
        onConflict: "email_id,user_id",
      });

    if (insertError) {
      console.error("Error storing email summaries:", insertError);
      // Continue anyway - return categorized emails
    }

    return NextResponse.json({
      ok: true,
      emails: categorizedEmails,
    });
  } catch (error: any) {
    console.error("Error categorizing emails:", error);
    return NextResponse.json(
      { error: "Failed to categorize emails" },
      { status: 500 }
    );
  }
}


/**
 * POST /api/sync/chat
 * 
 * Chat with Sync agent - understands commands, views current email,
 * fetches previous emails from recipient, extracts dates/appointments,
 * and creates calendar events
 */

import { NextRequest, NextResponse } from "next/server";
import { getSupabaseServerClient } from "@/lib/supabaseServerClient";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { openai } from "@/lib/openai";
import { getBusinessContext } from "@/lib/business-context";

const SYSTEM_PROMPT = `You are OVRSEE Sync, an AI assistant that helps users manage their emails and calendar. Your role is to:

1. **Understand User Commands**: 
   - Help edit drafts ("make it more professional", "add a thank you", etc.)
   - Answer questions about the current email
   - Provide context about the email thread
   - Extract and schedule appointments mentioned in emails

2. **Email Context Awareness**:
   - You have access to the current email being viewed
   - You can see previous emails from the same recipient
   - Use this context to provide informed responses

3. **Business Information Usage**:
   - You have access to the user's business information (name, business name, services, location, hours, etc.)
   - Use this information to personalize responses and draft emails
   - Pre-fill details like business name, services, contact info when relevant
   - Reference business context when answering questions

4. **Date/Appointment Extraction**:
   - When users mention dates, times, or appointments in drafts or emails
   - Extract: date, time, title, description, location (if mentioned)
   - Format as JSON for calendar event creation

5. **Response Format**:
   - Provide helpful, conversational responses
   - Use business information to personalize your responses
   - If extracting an appointment, include structured data
   - Be concise but complete

IMPORTANT: When you detect an appointment or date in the conversation, respond with:
- A natural language response
- PLUS a JSON object with appointment details (if applicable):
  {
    "hasAppointment": true,
    "appointment": {
      "title": "Meeting with John",
      "description": "Discussion about project",
      "date": "2025-01-25",
      "time": "14:00",
      "location": "Office" (optional)
    }
  }

If no appointment is detected, just respond naturally without the JSON.`;

/**
 * Extract dates and appointment info from text using AI
 */
async function extractAppointmentInfo(
  text: string,
  emailContext: string
): Promise<{
  hasAppointment: boolean;
  appointment?: {
    title: string;
    description: string;
    date: string;
    time: string;
    location?: string;
  };
} | null> {
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: `You are a date and appointment extraction assistant. Analyze the text and extract any mentioned appointments, meetings, or scheduled events.

Return ONLY valid JSON in this format:
{
  "hasAppointment": true/false,
  "appointment": {
    "title": "Meeting title or subject",
    "description": "What the meeting is about",
    "date": "YYYY-MM-DD",
    "time": "HH:MM in 24-hour format",
    "location": "location if mentioned" (optional)
  }
}

If no appointment is found, return: {"hasAppointment": false}

Current date: ${new Date().toISOString().split('T')[0]}`,
        },
        {
          role: "user",
          content: `Extract appointment information from this text:\n\n${text}\n\nEmail context:\n${emailContext}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) return null;

    const parsed = JSON.parse(content);
    return parsed;
  } catch (error) {
    console.error("[Sync Chat] Error extracting appointment:", error);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuthFromRequest(request);
    const userId = user.id;
    const body = await request.json();
    const { message, emailId, conversationHistory = [] } = body;

    if (!message || !emailId) {
      return NextResponse.json(
        { error: "Message and emailId are required" },
        { status: 400 }
      );
    }

    const supabase = getSupabaseServerClient();

    // Fetch current email (include thread_id for context)
    const { data: currentEmail, error: emailError } = await supabase
      .from("email_queue")
      .select("*, gmail_thread_id")
      .eq("id", emailId)
      .eq("user_id", userId)
      .single();

    if (emailError || !currentEmail) {
      return NextResponse.json(
        { error: "Email not found" },
        { status: 404 }
      );
    }

    // Fetch previous emails from same recipient (for context)
    const recipientEmail = currentEmail.from_address;
    const { data: previousEmails } = await supabase
      .from("email_queue")
      .select("subject, snippet, body_text, internal_date")
      .eq("user_id", userId)
      .eq("from_address", recipientEmail)
      .neq("id", emailId)
      .order("internal_date", { ascending: false })
      .limit(5);

    // Get business context
    const businessContext = await getBusinessContext(userId);

    // Build context for AI with full business info
    const businessInfo = businessContext ? `
Business Information:
- Your Name: ${businessContext.profile.fullName || "Not set"}
- Business Name: ${businessContext.profile.businessName || "N/A"}
- Industry: ${businessContext.profile.industry || "N/A"}
- Services: ${Array.isArray(businessContext.profile.services) ? businessContext.profile.services.join(", ") : businessContext.profile.services || "N/A"}
- Location: ${businessContext.profile.location || "N/A"}
- Operating Hours: ${businessContext.profile.hours || "N/A"}
- Contact Email: ${businessContext.profile.contactEmail || "N/A"}
- Contact Phone: ${businessContext.profile.contactPhone || "N/A"}
- Website: ${businessContext.profile.website || "N/A"}
- Notes: ${businessContext.profile.notes || "N/A"}
` : "No business context available";

    const emailContext = `
Current Email:
- From: ${currentEmail.from_name || currentEmail.from_address}
- Subject: ${currentEmail.subject}
- Body: ${currentEmail.body_text || currentEmail.snippet || ""}
- Draft: ${currentEmail.ai_draft || "No draft yet"}

Previous Emails from ${recipientEmail}:
${previousEmails?.map((e, i) => `${i + 1}. ${e.subject} (${e.internal_date}): ${e.snippet || e.body_text?.substring(0, 200) || ""}`).join("\n") || "No previous emails"}

${businessInfo}
`.trim();

    // Build conversation messages
    const messages: any[] = [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: `Email Context:\n${emailContext}\n\nUser Message: ${message}` },
    ];

    // Add conversation history
    conversationHistory.forEach((msg: { role: string; content: string }) => {
      messages.push({ role: msg.role, content: msg.content });
    });

    // Call OpenAI
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    const aiResponse = response.choices[0]?.message?.content || "I'm here to help!";

    // Try to extract appointment info from the response, user message, and draft
    const draftText = currentEmail.ai_draft || "";
    const appointmentInfo = await extractAppointmentInfo(
      `${message}\n\n${aiResponse}\n\nDraft: ${draftText}`,
      emailContext
    );

    // Parse response to check for appointment JSON and draft updates
    let parsedResponse = aiResponse;
    let appointmentData = null;
    let draftUpdate = null;

    try {
      // Check if response contains JSON
      const jsonMatch = aiResponse.match(/\{[\s\S]*"hasAppointment"[\s\S]*\}/);
      if (jsonMatch) {
        const jsonStr = jsonMatch[0];
        appointmentData = JSON.parse(jsonStr);
        // Remove JSON from response text
        parsedResponse = aiResponse.replace(jsonMatch[0], "").trim();
      } else if (appointmentInfo?.hasAppointment) {
        appointmentData = appointmentInfo;
      }

      // Check if user wants to update the draft
      const draftUpdateKeywords = ["update draft", "change draft", "edit draft", "modify draft", "rewrite", "make it", "add", "remove"];
      const wantsDraftUpdate = draftUpdateKeywords.some(keyword => 
        message.toLowerCase().includes(keyword)
      );

      if (wantsDraftUpdate && currentEmail.ai_draft) {
        // Get thread context if enabled
        let threadContextText = "";
        const { isThreadContextForDraftsEnabled } = await import("@/lib/sync/featureFlags");
        const { getThreadContext } = await import("@/lib/sync/getThreadContext");
        
        if (isThreadContextForDraftsEnabled() && currentEmail.gmail_thread_id) {
          try {
            const threadContext = await getThreadContext(
              userId,
              currentEmail.gmail_thread_id,
              emailId
            );
            
            if (threadContext.recentMessages.length > 0 || threadContext.threadSummary) {
              threadContextText = "\n\n--- THREAD CONTEXT ---\n";
              if (threadContext.threadSummary) {
                threadContextText += `Previous conversation: ${threadContext.threadSummary}\n`;
              }
              if (threadContext.recentMessages.length > 0) {
                threadContextText += "Recent messages:\n";
                threadContext.recentMessages.slice(-3).forEach((msg) => {
                  threadContextText += `- ${msg.isFromUser ? "You" : msg.sender}: ${msg.bodyText.substring(0, 200)}\n`;
                });
              }
              threadContextText += "--- END THREAD CONTEXT ---\n";
            }
          } catch (error) {
            // Continue without thread context on error
            console.warn("[Sync Chat] Could not load thread context for draft update:", error);
          }
        }

        // Ask AI to generate updated draft
        const draftUpdateResponse = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            {
              role: "system",
              content: `You are a professional email draft editor. Update the draft based on the user's request. Consider the thread context if provided. Return ONLY the updated draft text, no explanations.`,
            },
            {
              role: "user",
              content: `Current draft:\n${currentEmail.ai_draft}\n\nUser request: ${message}\n\nEmail context:\nFrom: ${currentEmail.from_name || currentEmail.from_address}\nSubject: ${currentEmail.subject}\nOriginal email: ${currentEmail.body_text || currentEmail.snippet || ""}${threadContextText}\n\nGenerate the updated draft:`,
            },
          ],
          temperature: 0.7,
          max_tokens: 500,
        });

        const updatedDraft = draftUpdateResponse.choices[0]?.message?.content?.trim();
        if (updatedDraft) {
          draftUpdate = updatedDraft;
          
          // Save updated draft to database
          try {
            await supabase
              .from("email_queue")
              .update({
                ai_draft: updatedDraft,
                ai_draft_generated_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              })
              .eq("id", emailId)
              .eq("user_id", userId);
          } catch (error) {
            console.error("[Sync Chat] Error saving draft update:", error);
          }
        }
      }
    } catch (e) {
      // Not JSON, continue with text response
      console.error("[Sync Chat] Error parsing response:", e);
    }

    // If appointment detected, create calendar event
    let calendarEventId = null;
    if (appointmentData?.hasAppointment && appointmentData.appointment) {
      try {
        const { title, description, date, time, location } = appointmentData.appointment;
        
        // Combine date and time
        const dateTime = new Date(`${date}T${time}:00`);
        
        // Build memo/description with email context
        const memo = `Appointment extracted from email conversation with ${currentEmail.from_name || currentEmail.from_address}.\n\nEmail Subject: ${currentEmail.subject}\n\n${description || "Appointment details from email"}`;
        
        // Create calendar event via API
        const calendarRes = await fetch(
          new URL("/api/calendar/events/create", request.url),
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: request.headers.get("authorization") || "",
            },
            body: JSON.stringify({
              summary: title,
              description: description || `Appointment extracted from email conversation`,
              start: {
                dateTime: dateTime.toISOString(),
                timeZone: businessContext?.profile.timezone || "America/New_York",
              },
              end: {
                dateTime: new Date(dateTime.getTime() + 60 * 60 * 1000).toISOString(), // 1 hour default
                timeZone: businessContext?.profile.timezone || "America/New_York",
              },
              location: location || undefined,
              memo: memo, // Store memo with email context
            }),
          }
        );

        if (calendarRes.ok) {
          const calendarData = await calendarRes.json();
          calendarEventId = calendarData.event?.id;
        }
      } catch (error) {
        console.error("[Sync Chat] Error creating calendar event:", error);
        // Don't fail the request if calendar creation fails
      }
    }

    return NextResponse.json({
      reply: parsedResponse,
      appointmentCreated: !!calendarEventId,
      calendarEventId,
      draftUpdated: !!draftUpdate,
      updatedDraft: draftUpdate || null,
    });
  } catch (error: any) {
    console.error("[Sync Chat] Error:", error);
    return NextResponse.json(
      { error: error.message || "Failed to process chat message" },
      { status: 500 }
    );
  }
}


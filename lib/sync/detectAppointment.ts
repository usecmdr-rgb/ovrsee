/**
 * Appointment Detection Helper
 * Uses OpenAI to detect and extract appointment/meeting information from emails
 */

import { openai } from "@/lib/openai";

export interface AppointmentDetectionResult {
  hasAppointment: boolean;
  appointmentType?: "request" | "proposal" | "confirmation" | "invitation";
  appointment?: {
    title: string;
    description: string;
    date: string; // YYYY-MM-DD
    time: string; // HH:MM in 24-hour format
    timezone?: string;
    location?: string;
    duration_minutes?: number;
    attendees?: string[];
  };
  confidence?: number; // 0.0 to 1.0
  rawResponse?: any;
}

const SYSTEM_PROMPT = `You are an appointment extraction assistant. Analyze the email and determine if it contains:
1. A request to schedule a meeting/appointment
2. A proposed meeting time/date
3. A confirmed meeting time/date
4. A calendar invitation (iCal attachment reference)

Return ONLY valid JSON with this exact structure:
{
  "hasAppointment": true/false,
  "appointmentType": "request" | "proposal" | "confirmation" | "invitation" | null,
  "appointment": {
    "title": "Meeting title or subject",
    "description": "What the meeting is about",
    "date": "YYYY-MM-DD",
    "time": "HH:MM in 24-hour format",
    "timezone": "America/New_York" (if mentioned, else null),
    "location": "location if mentioned" (optional),
    "duration_minutes": 60 (default, or extracted if mentioned),
    "attendees": ["email1@example.com"] (from email headers, optional)
  },
  "confidence": 0.0-1.0 (how confident the extraction is)
}

If no appointment is found, return: {"hasAppointment": false}

Current date: ${new Date().toISOString().split('T')[0]}`;

/**
 * Detect appointment information from email content
 * 
 * @param fromAddress - Email sender address
 * @param subject - Email subject line
 * @param bodyText - Plain text body of the email
 * @param toAddresses - Array of recipient email addresses (for attendees)
 * @param internalDate - Email internal date (for resolving relative dates)
 * @returns Appointment detection result
 */
export async function detectAppointment(
  fromAddress: string,
  subject: string,
  bodyText?: string | null,
  toAddresses?: string[],
  internalDate?: string
): Promise<AppointmentDetectionResult> {
  try {
    // Build the user prompt with email content
    const emailContent = [
      `From: ${fromAddress}`,
      `Subject: ${subject}`,
      bodyText ? `Body: ${bodyText.substring(0, 3000)}` : "", // Limit body to 3000 chars
      toAddresses && toAddresses.length > 0 ? `To: ${toAddresses.join(", ")}` : "",
      internalDate ? `Email Date: ${internalDate}` : "",
    ]
      .filter(Boolean)
      .join("\n\n");

    const userPrompt = `Extract appointment information from this email:\n\n${emailContent}`;

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
      max_tokens: 500,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      console.warn("[DetectAppointment] Empty response from OpenAI");
      return { hasAppointment: false, rawResponse: response };
    }

    // Parse JSON response
    let parsed: any;
    try {
      parsed = JSON.parse(content);
    } catch (parseError) {
      console.error("[DetectAppointment] Failed to parse JSON response:", content);
      return { hasAppointment: false, rawResponse: { content, error: "parse_error" } };
    }

    // Validate response structure
    if (!parsed.hasAppointment) {
      return {
        hasAppointment: false,
        rawResponse: response,
      };
    }

    // Validate appointment data
    if (!parsed.appointment || !parsed.appointment.date || !parsed.appointment.time) {
      console.warn("[DetectAppointment] Invalid appointment data, missing date or time");
      return { hasAppointment: false, rawResponse: parsed };
    }

    // Validate date format (YYYY-MM-DD)
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(parsed.appointment.date)) {
      console.warn("[DetectAppointment] Invalid date format:", parsed.appointment.date);
      return { hasAppointment: false, rawResponse: parsed };
    }

    // Validate time format (HH:MM)
    const timeRegex = /^\d{2}:\d{2}$/;
    if (!timeRegex.test(parsed.appointment.time)) {
      console.warn("[DetectAppointment] Invalid time format:", parsed.appointment.time);
      return { hasAppointment: false, rawResponse: parsed };
    }

    // Validate date is not in distant past (more than 1 year ago)
    const appointmentDate = new Date(parsed.appointment.date);
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    if (appointmentDate < oneYearAgo) {
      console.warn("[DetectAppointment] Appointment date is too far in the past:", parsed.appointment.date);
      return { hasAppointment: false, rawResponse: parsed };
    }

    return {
      hasAppointment: true,
      appointmentType: parsed.appointmentType || "proposal",
      appointment: {
        title: parsed.appointment.title || subject,
        description: parsed.appointment.description || "",
        date: parsed.appointment.date,
        time: parsed.appointment.time,
        timezone: parsed.appointment.timezone || null,
        location: parsed.appointment.location || null,
        duration_minutes: parsed.appointment.duration_minutes || 60,
        attendees: parsed.appointment.attendees || [],
      },
      confidence: parsed.confidence || 0.5,
      rawResponse: response,
    };
  } catch (error: any) {
    console.error("[DetectAppointment] Error detecting appointment:", error);
    // Return no appointment as safe default on any error
    return {
      hasAppointment: false,
      rawResponse: { error: error.message || "unknown_error" },
    };
  }
}



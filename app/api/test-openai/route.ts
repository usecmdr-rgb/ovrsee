import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(_req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "Missing OPENAI_API_KEY environment variable on the server",
      },
      { status: 500 }
    );
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content:
            "You are a simple health-check assistant for the OVRSEE backend.",
        },
        {
          role: "user",
          content:
            "Reply with a short confirmation sentence that the OpenAI API key works.",
        },
      ],
      max_tokens: 32,
      temperature: 0.2,
    });

    const reply =
      response.choices[0]?.message?.content?.trim() ||
      "OpenAI responded, but no text content was returned.";

    return NextResponse.json({
      ok: true,
      reply,
    });
  } catch (error: any) {
    console.error("/api/test-openai error:", error);

    const message =
      error?.message ||
      error?.response?.data?.error?.message ||
      "Unknown error from OpenAI";

    return NextResponse.json(
      {
        ok: false,
        error: "Failed to call OpenAI. The API key may be missing or invalid.",
        details: message,
      },
      { status: 500 }
    );
  }
}










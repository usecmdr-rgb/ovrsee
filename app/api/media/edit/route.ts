import { NextRequest, NextResponse } from "next/server";

import { openai } from "@/lib/openai";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const userPrompt = (formData.get("prompt") as string | null) ?? "";

    if (!file) {
      return NextResponse.json(
        { ok: false, error: "Missing file" },
        { status: 400 }
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const base64 = Buffer.from(arrayBuffer).toString("base64");
    const dataUrl = `data:${file.type};base64,${base64}`;

    const muResponse = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "You are Studio, the OVRSEE media agent. Given a user request and an image, reply with ONE concise edit prompt for an image model.",
        },
        {
          role: "user",
          content: [
            {
              type: "text",
              text:
                "User request: " +
                (userPrompt ||
                  "Improve this image for a clean, professional look."),
            },
            {
              type: "image_url",
              image_url: { url: dataUrl },
            },
          ],
        },
      ],
    });

    const muText = muResponse.choices[0]?.message?.content?.trim();
    const editPrompt = muText || userPrompt || "Improve this image.";

    // Note: OpenAI's image generation API doesn't support editing existing images
    // This endpoint would need to use a different image editing service
    // For now, we'll return an error indicating this feature is not yet implemented
    return NextResponse.json(
      { ok: false, error: "Image editing not yet implemented. OpenAI images.generate doesn't support editing existing images." },
      { status: 501 }
    );
  } catch (err: any) {
    console.error("Error in /api/media/edit:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Unknown error" },
      { status: 500 }
    );
  }
}


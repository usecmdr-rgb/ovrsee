import { NextRequest, NextResponse } from "next/server";
import { openai } from "@/lib/openai";
import {
  getVoiceProfileByKey,
  getVoicePreviewScript,
  type AlohaVoiceKey,
} from "@/lib/aloha/voice-profiles";
import { requireAuthFromRequest } from "@/lib/auth-helpers";

/**
 * POST /api/aloha/voice-preview
 * 
 * Generates a voice preview audio file dynamically using the user's display name.
 * 
 * Request body:
 * - voiceKey: AlohaVoiceKey
 * - displayName: string
 */
export async function POST(request: NextRequest) {
  try {
    // Check authentication
    await requireAuthFromRequest(request);
  } catch (authError: any) {
    // Return 401 for authentication errors
    return NextResponse.json(
      { ok: false, error: authError.message || "Unauthorized" },
      { status: 401 }
    );
  }

  try {
    const body = await request.json();
    const { voiceKey, displayName } = body;

    if (!voiceKey) {
      return NextResponse.json(
        { ok: false, error: "voiceKey is required" },
        { status: 400 }
      );
    }

    if (!displayName || !displayName.trim()) {
      return NextResponse.json(
        { ok: false, error: "displayName is required" },
        { status: 400 }
      );
    }

    // Get voice profile
    const voiceProfile = getVoiceProfileByKey(voiceKey as AlohaVoiceKey);
    
    // Get preview text with display name
    const previewText = getVoicePreviewScript(
      voiceKey as AlohaVoiceKey,
      displayName
    );

    // Generate audio using OpenAI TTS
    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: voiceProfile.openaiVoiceId as "alloy" | "echo" | "fable" | "onyx" | "nova" | "shimmer",
      response_format: "mp3",
      input: previewText,
    });
    const audioBuffer = Buffer.from(await ttsResponse.arrayBuffer());

    return new NextResponse(audioBuffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Accept-Ranges": "bytes",
      },
    });
  } catch (error: any) {
    console.error("Error generating voice preview:", error);
    return NextResponse.json(
      { ok: false, error: error.message || "Failed to generate voice preview" },
      { status: 500 }
    );
  }
}
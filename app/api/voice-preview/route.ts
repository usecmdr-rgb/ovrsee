import { NextRequest, NextResponse } from "next/server";
import { createHash } from "crypto";
import { requireAuthFromRequest } from "@/lib/auth-helpers";
import { openai } from "@/lib/openai";
import {
  getVoiceProfileByKey,
  type AlohaVoiceKey,
} from "@/lib/aloha/voice-profiles";

const CACHE_TTL_MS = 1000 * 60 * 10; // 10 minutes
const MAX_CACHE_ENTRIES = 50;

type VoicePreviewCacheEntry = {
  buffer: Buffer;
  contentType: string;
  expiresAt: number;
  generatedAt: number;
};

const voicePreviewCache = new Map<string, VoicePreviewCacheEntry>();

function buildCacheKey(voiceKey: string, sampleText: string) {
  return createHash("sha256").update(`${voiceKey}:${sampleText}`).digest("hex");
}

function upsertCacheEntry(key: string, entry: VoicePreviewCacheEntry) {
  if (voicePreviewCache.size >= MAX_CACHE_ENTRIES) {
    const firstKey = voicePreviewCache.keys().next().value;
    if (firstKey) {
      voicePreviewCache.delete(firstKey);
    }
  }
  voicePreviewCache.set(key, entry);
}

export async function POST(request: NextRequest) {
  try {
    await requireAuthFromRequest(request);
  } catch (authError: any) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "UNAUTHORIZED",
          messageKey: "error.unauthorized",
          defaultMessage: "Unauthorized",
        },
      },
      { status: 401 }
    );
  }

  try {
    const { voiceKey, sampleText } = (await request.json()) as {
      voiceKey?: string;
      sampleText?: string;
    };

    if (!voiceKey) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "VOICE_KEY_REQUIRED",
            messageKey: "error.voiceKeyRequired",
            defaultMessage: "voiceKey is required",
          },
        },
        { status: 400 }
      );
    }

    if (!sampleText || !sampleText.trim()) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            code: "SAMPLE_TEXT_REQUIRED",
            messageKey: "error.sampleTextRequired",
            defaultMessage: "sampleText is required",
          },
        },
        { status: 400 }
      );
    }

    const normalizedSampleText = sampleText.trim();
    const voiceProfile = getVoiceProfileByKey(voiceKey as AlohaVoiceKey);

    const cacheKey = buildCacheKey(voiceProfile.key, normalizedSampleText);
    const now = Date.now();
    const cached = voicePreviewCache.get(cacheKey);

    if (cached && cached.expiresAt > now) {
      return NextResponse.json(
        {
          ok: true,
          audioBase64: cached.buffer.toString("base64"),
          contentType: cached.contentType,
          cacheKey,
          generatedAt: cached.generatedAt,
          cached: true,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }

    const ttsResponse = await openai.audio.speech.create({
      model: "tts-1",
      voice: voiceProfile.openaiVoiceId as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer",
      response_format: "mp3",
      input: normalizedSampleText,
    });

    const buffer = Buffer.from(await ttsResponse.arrayBuffer());
    const contentType = "audio/mpeg";
    const cacheEntry: VoicePreviewCacheEntry = {
      buffer,
      contentType,
      generatedAt: now,
      expiresAt: now + CACHE_TTL_MS,
    };

    upsertCacheEntry(cacheKey, cacheEntry);

    return NextResponse.json(
      {
        ok: true,
        audioBase64: buffer.toString("base64"),
        contentType,
        cacheKey,
        generatedAt: now,
        cached: false,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  } catch (error: any) {
    console.error("Error generating voice preview:", error);
    return NextResponse.json(
      {
        ok: false,
        error: {
          code: "VOICE_PREVIEW_FAILED",
          messageKey: "error.voicePreviewFailed",
          defaultMessage: "Failed to generate voice preview",
        },
      },
      { status: 500 }
    );
  }
}



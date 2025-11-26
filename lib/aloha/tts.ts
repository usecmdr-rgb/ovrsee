/**
 * TTS (Text-to-Speech) Service Abstraction
 * 
 * This module provides an abstraction layer for TTS providers.
 * Currently supports OpenAI TTS, but can be extended to support:
 * - ElevenLabs
 * - Google Cloud TTS
 * - Amazon Polly
 * - Azure Cognitive Services
 * 
 * For real-time streaming, use the streaming methods.
 */

import { getVoiceById, type AlohaVoice } from "./voices";
import {
  getVoiceProfileByKey,
  type AlohaVoiceProfile,
} from "./voice-profiles";
import { getTonePreset, getTTSSettingsFromPreset } from "./tone-presets";

export interface TTSOptions {
  voice?: AlohaVoice; // Legacy: use voiceProfile instead
  voiceProfile?: AlohaVoiceProfile; // New: voice profile with OpenAI voice ID and tone
  text: string;
  streaming?: boolean;
  speed?: number; // Override speaking rate
  pitch?: number; // Override pitch
}

export interface TTSResponse {
  audioUrl?: string; // URL to generated audio file
  audioBuffer?: Buffer; // Raw audio buffer
  stream?: ReadableStream; // Streaming audio (for real-time)
  duration?: number; // Audio duration in seconds
}

/**
 * Generate speech using OpenAI TTS
 * 
 * Uses the voice profile's OpenAI voice ID and applies tone-based settings.
 */
export async function generateSpeech(options: TTSOptions): Promise<TTSResponse> {
  const { voice, voiceProfile, text, streaming = false, speed, pitch } = options;

  // Prefer voiceProfile over legacy voice
  let openaiVoiceId: string;
  let speakingRate: number;
  let voicePitch: number;

  if (voiceProfile) {
    // Use voice profile (new system)
    openaiVoiceId = voiceProfile.openaiVoiceId;
    
    // Get tone preset settings
    const tonePreset = getTonePreset(voiceProfile.tonePreset);
    const toneSettings = getTTSSettingsFromPreset(tonePreset);
    
    // Apply tone settings, with overrides
    speakingRate = speed !== undefined ? speed : (toneSettings.rate || 1.0);
    voicePitch = pitch !== undefined ? pitch : (toneSettings.pitch || 0);
  } else if (voice) {
    // Legacy: use voice configuration
    const ttsSettings = voice.ttsSettings;
    openaiVoiceId = ttsSettings.voiceName || "nova";
    speakingRate = speed || ttsSettings.speakingRate || 1.0;
    voicePitch = pitch !== undefined ? pitch : (ttsSettings.pitch || 0);
  } else {
    throw new Error("Either voiceProfile or voice must be provided");
  }

  // Generate speech using OpenAI TTS
  try {
    const { openai } = await import("@/lib/openai");
    
    const response = await openai.audio.speech.create({
      model: "tts-1", // or "tts-1-hd" for higher quality
      voice: openaiVoiceId as
        | "alloy"
        | "echo"
        | "fable"
        | "onyx"
        | "nova"
        | "shimmer",
      input: text,
      speed: speakingRate,
    });

    if (streaming) {
      return { stream: response.body as unknown as ReadableStream };
    } else {
      const buffer = Buffer.from(await response.arrayBuffer());
      return { audioBuffer: buffer };
    }
  } catch (error: any) {
    console.error("Error generating TTS:", error);
    throw new Error(`TTS generation failed: ${error.message}`);
  }
}

/**
 * Stream speech in real-time (for low-latency calls)
 * 
 * Uses voice profile for OpenAI voice selection and tone settings.
 */
export async function streamSpeech(
  text: string,
  voiceProfile: AlohaVoiceProfile,
  onChunk?: (chunk: Buffer) => void
): Promise<ReadableStream> {
  // Get tone preset settings
  const tonePreset = getTonePreset(voiceProfile.tonePreset);
  const toneSettings = getTTSSettingsFromPreset(tonePreset);
  
  const openaiVoiceId = voiceProfile.openaiVoiceId;
  const speakingRate = toneSettings.rate || 1.0;
  
  let cancelled = false;
  
  return new ReadableStream({
    async start(controller) {
      try {
        const { openai } = await import("@/lib/openai");
        
        // Generate speech using OpenAI TTS
        const response = await openai.audio.speech.create({
          model: "tts-1", // or "tts-1-hd" for higher quality
          voice: openaiVoiceId as
            | "alloy"
            | "echo"
            | "fable"
            | "onyx"
            | "nova"
            | "shimmer",
          input: text,
          speed: speakingRate,
        });

        // Stream the response
        if (!response.body) {
          throw new Error("Response body is null");
        }
        const reader = response.body.getReader();
        
        while (true) {
          if (cancelled) {
            reader.cancel();
            break;
          }
          
          const { done, value } = await reader.read();
          
          if (done) {
            controller.close();
            break;
          }
          
          if (cancelled) {
            reader.cancel();
            controller.close();
            break;
          }
          
          controller.enqueue(value);
          if (onChunk) {
            onChunk(Buffer.from(value));
          }
        }
      } catch (error: any) {
        if (!cancelled) {
          console.error("Error streaming TTS:", error);
          controller.error(error);
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}

/**
 * Get TTS provider voice name from Aloha voice (legacy)
 */
export function getTTSVoiceName(voice: AlohaVoice): string {
  return voice.ttsSettings.voiceName || "nova";
}

/**
 * Get TTS provider settings for a voice (legacy)
 */
export function getTTSSettings(voice: AlohaVoice) {
  return {
    provider: voice.ttsSettings.provider || "openai",
    voiceName: voice.ttsSettings.voiceName || "nova",
    pitch: voice.ttsSettings.pitch || 0,
    speakingRate: voice.ttsSettings.speakingRate || 1.0,
    stability: voice.ttsSettings.stability,
    similarityBoost: voice.ttsSettings.similarityBoost,
  };
}

/**
 * Get TTS provider settings from voice profile (new system)
 */
export function getTTSSettingsFromVoiceProfile(voiceProfile: AlohaVoiceProfile) {
  const tonePreset = getTonePreset(voiceProfile.tonePreset);
  const toneSettings = getTTSSettingsFromPreset(tonePreset);
  
  return {
    provider: "openai",
    voiceName: voiceProfile.openaiVoiceId,
    pitch: toneSettings.pitch || 0,
    speakingRate: toneSettings.rate || 1.0,
  };
}


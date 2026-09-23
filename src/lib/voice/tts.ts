import "server-only";
import { PERSONAS } from "@/lib/ai/personas";

/**
 * Natural interviewer voices via ElevenLabs. The API key stays on the server
 * (ELEVENLABS_API_KEY); the browser only ever receives audio. Without a key the
 * room falls back to the browser's built-in speech synthesis.
 */

/** Default ElevenLabs premade voices per persona — override with ELEVENLABS_VOICE_<PERSONA>. */
const DEFAULT_VOICES: Record<string, string> = {
  ava: "EXAVITQu4vr4xnSDxMaL", // Sarah — warm, conversational American
  marcus: "nPczCjzI2devNBz1zQrb", // Brian — deep, measured American
  elena: "XrExE9yKIg1WjnnlVkGX", // Matilda — clear, professional American
};

export const TTS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_flash_v2_5";

export function isTtsConfigured() {
  return Boolean(process.env.ELEVENLABS_API_KEY);
}

export function voiceIdFor(personaKey: string) {
  const key = PERSONAS[personaKey] ? personaKey : "ava";
  return process.env[`ELEVENLABS_VOICE_${key.toUpperCase()}`] || DEFAULT_VOICES[key];
}

/** Short reactions the interviewer can say instantly while thinking. Fixed list, so the endpoint can't be used as a general TTS proxy. */
export const BACKCHANNELS = {
  mhm: "Mm-hm.",
  okay: "Okay.",
  gotit: "Got it.",
  right: "Right.",
  sure: "Sure.",
} as const;
export type Backchannel = keyof typeof BACKCHANNELS;

export class TtsError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

/** Start an ElevenLabs stream and return the upstream body (MP3) for piping straight to the browser. */
export async function synthesize(text: string, personaKey: string, signal?: AbortSignal) {
  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) throw new TtsError("ElevenLabs is not configured.", 503);
  const res = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceIdFor(personaKey)}/stream?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "xi-api-key": key, "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({
      text,
      model_id: TTS_MODEL,
      voice_settings: { stability: 0.45, similarity_boost: 0.8, style: 0.15, use_speaker_boost: true },
    }),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("[tts] ElevenLabs request failed", res.status, detail.slice(0, 300));
    throw new TtsError(res.status === 401 ? "The ElevenLabs API key was rejected." : "Voice generation failed.", 502);
  }
  return res.body;
}

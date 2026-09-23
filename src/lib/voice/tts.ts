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

/** eleven_multilingual_v2 is ElevenLabs' most lifelike stable model; eleven_flash_v2_5 is faster and cheaper but flatter. */
export const TTS_MODEL = process.env.ELEVENLABS_MODEL || "eleven_multilingual_v2";

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
      // Lower stability = more natural variation in pitch and pacing, like a real person.
      voice_settings: { stability: 0.38, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true },
    }),
    signal,
  }).catch((err) => {
    if (signal?.aborted) throw err;
    console.error("[tts] couldn't reach ElevenLabs", err);
    throw new TtsError("Couldn't reach ElevenLabs from the server — check your internet connection.", 502);
  });
  if (!res.ok || !res.body) {
    const detail = await res.text().catch(() => "");
    console.error("[tts] ElevenLabs request failed", res.status, detail.slice(0, 500));
    throw new TtsError(explainFailure(res.status, detail), 502);
  }
  return res.body;
}

/** Turn an ElevenLabs error into something the candidate / developer can act on (never includes the key). */
function explainFailure(status: number, body: string) {
  let code = "";
  let message = "";
  try {
    const d = JSON.parse(body)?.detail;
    code = String(d?.status ?? d?.code ?? "");
    message = String(d?.message ?? (typeof d === "string" ? d : ""));
  } catch {
    /* not JSON */
  }
  if (code.includes("quota") || /quota|credits/i.test(message)) return "ElevenLabs credits are used up (or the key's credit limit was reached).";
  if (code.includes("permission") || /permission/i.test(message)) return "The ElevenLabs key doesn't have Text to Speech access — edit the key and allow it.";
  if (code.includes("unusual_activity") || /unusual activity/i.test(message)) return "ElevenLabs blocked free-tier API use from this network — a paid plan fixes this.";
  if (code.includes("voice_not_found") || /voice/i.test(code)) return "That ElevenLabs voice isn't available on your account — check the ELEVENLABS_VOICE_* settings.";
  if (status === 401) return "The ElevenLabs API key was rejected — check ELEVENLABS_API_KEY in .env.";
  if (status === 429) return "ElevenLabs is rate-limiting requests right now.";
  return `ElevenLabs voice generation failed (HTTP ${status}${message ? `: ${message.slice(0, 120)}` : ""}).`;
}

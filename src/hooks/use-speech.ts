"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API (not in lib.dom for all TS versions). */
type SpeechRecognitionResultLike = { isFinal: boolean; 0: { transcript: string } };
type SpeechRecognitionEventLike = { resultIndex: number; results: ArrayLike<SpeechRecognitionResultLike> };
type SpeechRecognitionLike = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
};

function getCtor(): (new () => SpeechRecognitionLike) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => SpeechRecognitionLike; webkitSpeechRecognition?: new () => SpeechRecognitionLike };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Live transcription using the browser's built-in speech recognition (Chrome,
 * Edge, Safari). Where it's unsupported, `supported` is false and the UI offers
 * typed answers instead — we never fabricate a transcript.
 */
export function useSpeechRecognition(onFinal: (text: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<SpeechRecognitionLike | null>(null);
  const want = useRef(false);
  const cb = useRef(onFinal);
  cb.current = onFinal;

  useEffect(() => {
    setSupported(Boolean(getCtor()));
  }, []);

  const start = useCallback(() => {
    const Ctor = getCtor();
    if (!Ctor) return;
    want.current = true;
    if (rec.current) return;
    const r = new Ctor();
    r.continuous = true;
    r.interimResults = true;
    r.lang = "en-US";
    r.onresult = (e) => {
      let interimText = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) {
          const t = res[0].transcript.trim();
          if (t) cb.current(t);
        } else interimText += res[0].transcript;
      }
      setInterim(interimText);
    };
    r.onerror = (e) => {
      if (e.error === "not-allowed" || e.error === "service-not-allowed") {
        want.current = false;
        setError("Microphone permission was denied for speech-to-text. You can type your answers instead.");
      } else if (e.error === "audio-capture") {
        want.current = false;
        setError("No microphone is available for speech-to-text. You can type your answers instead.");
      } else if (e.error === "network") {
        setError("The browser's speech service is unreachable right now — keep talking or type your answer; we'll retry automatically.");
      } else if (e.error !== "no-speech" && e.error !== "aborted") setError("Speech-to-text hit a problem. You can type your answers instead.");
    };
    r.onend = () => {
      rec.current = null;
      setInterim("");
      // Browsers stop recognition after silence — restart while the user still wants it.
      if (want.current) setTimeout(() => want.current && start(), 250);
      else setListening(false);
    };
    try {
      r.start();
      rec.current = r;
      setListening(true);
      setError(null);
    } catch {
      /* already started */
    }
  }, []);

  const stop = useCallback(() => {
    want.current = false;
    rec.current?.stop();
    setListening(false);
  }, []);

  useEffect(() => () => { want.current = false; rec.current?.abort(); }, []);
  return { supported, listening, interim, error, start, stop };
}

/** Pick the best available voice for a persona (voices load asynchronously in some browsers). */
function pickVoice(hints: string[], gender?: "female" | "male") {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  for (const h of hints) {
    const v = voices.find((x) => x.name.toLowerCase().includes(h.toLowerCase()));
    if (v) return v;
  }
  if (gender) {
    const v = voices.find((x) => x.name.toLowerCase().includes(gender));
    if (v) return v;
  }
  return voices.find((v) => /en-US/i.test(v.lang)) ?? voices[0];
}

export type SpeakOptions = {
  voiceHints?: string[];
  gender?: "female" | "male";
  onStart?: () => void;
  onEnd?: () => void;
  /** Fires on each spoken word (where the browser supports it) — used for lip-sync. */
  onWord?: () => void;
};

/**
 * Text-to-speech for the AI interviewer's voice (browser speechSynthesis).
 * When muted or unsupported, onStart/onEnd still fire over an estimated
 * duration so the on-screen interviewer keeps "talking" with captions.
 */
export function speak(text: string, enabled: boolean, opts: SpeakOptions = {}) {
  const estimateMs = Math.min(25000, 500 + text.split(/\s+/).length * 340);
  const silent = () => {
    opts.onStart?.();
    const t = setTimeout(() => opts.onEnd?.(), estimateMs);
    return () => clearTimeout(t);
  };
  if (typeof window === "undefined") return () => {};
  if (!enabled || !("speechSynthesis" in window)) return silent();

  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = opts.gender === "male" ? 0.95 : 1.02;
  const voice = pickVoice(opts.voiceHints ?? [], opts.gender);
  if (voice) u.voice = voice;
  let ended = false;
  const finish = () => {
    if (ended) return;
    ended = true;
    clearTimeout(safety);
    opts.onEnd?.();
  };
  u.onstart = () => opts.onStart?.();
  u.onend = finish;
  u.onerror = finish;
  u.onboundary = (e) => {
    if (e.name === "word" || e.name === undefined) opts.onWord?.();
  };
  // Some browsers never fire onend (e.g. tab backgrounded) — don't leave the mouth moving.
  const safety = setTimeout(finish, estimateMs * 2 + 4000);
  opts.onStart?.();
  window.speechSynthesis.speak(u);
  return () => {
    clearTimeout(safety);
    window.speechSynthesis.cancel();
    finish();
  };
}

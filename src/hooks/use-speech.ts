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

  useEffect(() => setSupported(Boolean(getCtor())), []);

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
      } else if (e.error !== "no-speech" && e.error !== "aborted") setError(`Speech recognition error: ${e.error}`);
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

/** Text-to-speech for the AI interviewer's voice (browser speechSynthesis). */
export function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1;
  u.pitch = 1;
  const voice = window.speechSynthesis.getVoices().find((v) => /en-(US|GB)/.test(v.lang) && /Google|Samantha|Natural|Aria|Jenny/i.test(v.name));
  if (voice) u.voice = voice;
  window.speechSynthesis.speak(u);
}

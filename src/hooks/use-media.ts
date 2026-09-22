"use client";
import { useCallback, useEffect, useRef, useState } from "react";

/** Camera + microphone with toggles, error reporting and a live mic level (0–1). */
export function useLocalMedia({ video = true, audio = true, auto = true }: { video?: boolean; audio?: boolean; auto?: boolean } = {}) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [camOn, setCamOn] = useState(video);
  const [micOn, setMicOn] = useState(audio);
  const [level, setLevel] = useState(0);
  const raf = useRef<number | null>(null);
  const ctx = useRef<AudioContext | null>(null);

  const start = useCallback(async () => {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser doesn't support camera/microphone access.");
      return null;
    }
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: video ? { width: { ideal: 1280 }, height: { ideal: 720 } } : false, audio: audio ? { echoCancellation: true, noiseSuppression: true } : false });
      setStream(s);
      return s;
    } catch (e) {
      const name = (e as DOMException).name;
      setError(
        name === "NotAllowedError"
          ? "Camera/microphone permission was denied. Allow access in your browser's site settings, then retry."
          : name === "NotFoundError"
            ? "No camera or microphone was found."
            : "We couldn't access your camera or microphone.",
      );
      return null;
    }
  }, [video, audio]);

  useEffect(() => {
    if (auto) start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Mic level meter
  useEffect(() => {
    if (!stream || !stream.getAudioTracks().length) return;
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC();
    ctx.current = ac;
    const src = ac.createMediaStreamSource(stream);
    const analyser = ac.createAnalyser();
    analyser.fftSize = 512;
    src.connect(analyser);
    const buf = new Uint8Array(analyser.frequencyBinCount);
    const tick = () => {
      analyser.getByteTimeDomainData(buf);
      let sum = 0;
      for (const v of buf) sum += ((v - 128) / 128) ** 2;
      setLevel(Math.min(1, Math.sqrt(sum / buf.length) * 4));
      raf.current = requestAnimationFrame(tick);
    };
    tick();
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      ac.close().catch(() => {});
    };
  }, [stream]);

  useEffect(() => () => stream?.getTracks().forEach((t) => t.stop()), [stream]);

  const toggleCam = useCallback(() => {
    stream?.getVideoTracks().forEach((t) => (t.enabled = !t.enabled));
    setCamOn((c) => !c);
  }, [stream]);
  const toggleMic = useCallback(() => {
    stream?.getAudioTracks().forEach((t) => (t.enabled = !t.enabled));
    setMicOn((m) => !m);
  }, [stream]);

  return { stream, error, camOn, micOn, level, start, toggleCam, toggleMic, hasVideo: Boolean(stream?.getVideoTracks().length), hasAudio: Boolean(stream?.getAudioTracks().length) };
}

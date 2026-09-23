"use client";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight, Camera, CheckCircle2, Clock, Loader2, Mic, RefreshCw, Subtitles, Wifi, XCircle } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { LABELS } from "@/lib/constants";
import { useLocalMedia } from "@/hooks/use-media";
import { useRoomState } from "@/hooks/use-room-state";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { Logo } from "@/components/layout/logo";
import { VideoTile } from "./video-tile";

type Net = { status: "checking" | "good" | "fair" | "poor"; ms?: number };

function Check({ ok, label, detail, icon: Icon, pending }: { ok: boolean | null; label: string; detail: string; icon: React.ElementType; pending?: boolean }) {
  return (
    <li className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-600"><Icon className="h-4 w-4" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-ink-900">{label}</p>
        <p className="text-xs text-ink-500">{detail}</p>
      </div>
      {pending ? <Loader2 className="h-4 w-4 animate-spin text-ink-400" aria-label="Checking" /> : ok ? <CheckCircle2 className="h-5 w-5 text-emerald-600" aria-label="Passed" /> : <XCircle className="h-5 w-5 text-amber-600" aria-label="Needs attention" />}
    </li>
  );
}

export function Lobby({ id }: { id: string }) {
  const router = useRouter();
  const { state, error } = useRoomState(id, 2000);
  const media = useLocalMedia();
  const [net, setNet] = useState<Net>({ status: "checking" });
  const [speechOk, setSpeechOk] = useState<boolean | null>(null);
  const [consent, setConsent] = useState(false);
  const [joined, setJoined] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>();

  useEffect(() => {
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    setSpeechOk(Boolean(w.SpeechRecognition || w.webkitSpeechRecognition));
    (async () => {
      const times: number[] = [];
      for (let i = 0; i < 3; i++) {
        const t0 = performance.now();
        const ok = await fetch("/api/rtc-config", { cache: "no-store" }).then((r) => r.ok).catch(() => false);
        if (!ok) return setNet({ status: "poor" });
        times.push(performance.now() - t0);
      }
      const ms = Math.round(times.sort((a, b) => a - b)[1]);
      setNet({ status: ms < 250 ? "good" : ms < 700 ? "fair" : "poor", ms });
    })();
  }, []);

  useEffect(() => {
    if (!state) return;
    if (state.mode === "ai") router.replace(`/interviews/${id}/room`);
    else if (state.status === "active") router.replace(`/interviews/${id}/room`);
    else if (["completed", "reported", "cancelled", "no_show"].includes(state.status)) router.replace(`/interviews/${id}`);
    if (state && (state.me.role === "candidate" ? state.candidate.presence?.ready : state.interviewer?.presence?.ready)) setJoined(true);
  }, [state, id, router]);

  async function enter() {
    setBusy(true);
    setErr(undefined);
    try {
      await api(`/api/interviews/${id}/ready`, { body: { deviceCheck: { camera: media.hasVideo, mic: media.hasAudio, network: net.status, speech: Boolean(speechOk) }, recordingConsent: consent } });
      setJoined(true);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (error) return <div className="mx-auto max-w-md p-8"><Alert tone="danger" title="Can't open this interview">{error}</Alert></div>;
  if (!state) return <div className="flex min-h-screen items-center justify-center"><Spinner label="Loading" /></div>;
  const isCandidate = state.me.role === "candidate";
  const other = isCandidate ? state.interviewer : state.candidate;
  const otherReady = other?.presence?.ready;

  return (
    <div className="min-h-screen bg-paper">
      <header className="container-page flex h-16 items-center justify-between"><Logo /><ButtonLink href={`/interviews/${id}`} variant="ghost" size="sm">Back</ButtonLink></header>
      <main id="main" className="container-page grid gap-8 pb-16 pt-4 lg:grid-cols-[1.3fr_1fr]">
        <section>
          <p className="eyebrow">Before you begin</p>
          <h1 className="mt-2 text-3xl font-semibold text-ink-950">Camera &amp; microphone check</h1>
          <VideoTile stream={media.stream} muted mirrored label="Camera preview" camOn={media.camOn} micOn={media.micOn} initials="You" className="mt-6 aspect-video" />
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button variant="secondary" size="sm" onClick={media.toggleCam} disabled={!media.hasVideo}>{media.camOn ? "Turn camera off" : "Turn camera on"}</Button>
            <Button variant="secondary" size="sm" onClick={media.toggleMic} disabled={!media.hasAudio}>{media.micOn ? "Mute" : "Unmute"}</Button>
            {media.error && <Button variant="ghost" size="sm" onClick={() => media.start()}><RefreshCw className="h-4 w-4" /> Retry devices</Button>}
          </div>
          {media.error && <Alert tone="warning" className="mt-4" title="Device access">{media.error} You can still join. Technical issues are never counted against you.</Alert>}
          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            <Check icon={Camera} ok={media.hasVideo} pending={!media.stream && !media.error} label="Camera preview" detail={media.hasVideo ? "Camera is working" : "No camera. You can join audio-only"} />
            <li className="flex items-start gap-3 rounded-xl border border-ink-200 bg-white p-3.5">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-50 text-ink-600"><Mic className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-ink-900">Microphone test</p>
                <p className="text-xs text-ink-500">{media.hasAudio ? "Say something and the bar should move" : "No microphone detected"}</p>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-100" role="meter" aria-label="Microphone level" aria-valuenow={Math.round(media.level * 100)} aria-valuemin={0} aria-valuemax={100}>
                  <div className="h-full rounded-full bg-olive-600 transition-all duration-75" style={{ width: `${Math.round(media.level * 100)}%` }} />
                </div>
              </div>
            </li>
            <Check icon={Wifi} ok={net.status === "good" || net.status === "fair"} pending={net.status === "checking"} label="Internet connection" detail={net.status === "checking" ? "Measuring…" : `${net.status[0].toUpperCase()}${net.status.slice(1)}${net.ms ? ` · ${net.ms} ms` : ""}`} />
            <Check icon={Subtitles} ok={speechOk} pending={speechOk === null} label="Live transcription" detail={speechOk ? "Supported in this browser" : "Not supported. Typed answers available"} />
          </ul>
        </section>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
            <p className="eyebrow">Interview details</p>
            <h2 className="mt-2 text-xl font-semibold">{state.targetRole}</h2>
            <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
              <div><dt className="text-xs text-ink-500">Interview type</dt><dd className="font-medium">{LABELS.type[state.type]}</dd></div>
              <div><dt className="text-xs text-ink-500">Duration</dt><dd className="flex items-center gap-1 font-medium"><Clock className="h-3.5 w-3.5" />{state.duration} minutes</dd></div>
              <div><dt className="text-xs text-ink-500">Target role</dt><dd className="font-medium">{state.targetRole}</dd></div>
              <div><dt className="text-xs text-ink-500">{isCandidate ? "Interviewer" : "Candidate"}</dt><dd className="font-medium">{other?.name ?? "N/A"}</dd></div>
            </dl>
            <div className={cn("mt-5 flex items-center gap-2 rounded-lg px-3 py-2 text-xs", otherReady ? "bg-emerald-50 text-emerald-800" : "bg-ink-50 text-ink-600")} role="status">
              {otherReady ? <CheckCircle2 className="h-4 w-4" /> : <Loader2 className="h-4 w-4 animate-spin" />}
              {otherReady ? `${other?.name} is ready` : `Waiting for ${other?.name ?? "the other participant"}…`}
            </div>
          </div>
          <div className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card">
            <p className="text-sm font-medium text-ink-900">Recording &amp; transcript</p>
            <p className="mt-1 text-sm text-ink-600">Video and audio are <strong>not recorded</strong>. {isCandidate ? "Your spoken answers are transcribed in your browser and saved as text so AI can grade the interview." : "Questions you ask are saved to the transcript for grading."}</p>
            <label className="mt-4 flex items-start gap-3 text-sm text-ink-700">
              <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-ink-300 text-olive-600 focus:ring-olive-500" />
              I understand a text transcript will be captured for AI grading, and I agree to Interview Connect&apos;s conduct standards.
            </label>
          </div>
          {err && <Alert tone="danger">{err}</Alert>}
          {joined ? (
            <div className="flex items-center gap-3 rounded-2xl bg-ink-950 p-5 text-sm text-white" role="status">
              <Spinner className="text-olive-300" />
              <div>
                <p className="font-medium">You&apos;re ready.</p>
                <p className="text-ink-300">{state.questionStatus !== "ready" ? "Finishing the interview guide…" : `The interview starts as soon as ${other?.name ?? "the other participant"} is ready.`}</p>
              </div>
            </div>
          ) : (
            <Button size="lg" variant="olive" className="w-full" onClick={enter} loading={busy} disabled={!consent}>Enter Interview <ArrowRight className="h-4 w-4" /></Button>
          )}
          <p className="text-center text-xs text-ink-400">The interview begins only when both participants are ready.</p>
        </aside>
      </main>
    </div>
  );
}

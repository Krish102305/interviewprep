"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Bot, CheckCircle2, Keyboard, LogOut, Mic, MicOff, Pause, Play, Send, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { useElapsed, useRoomState, type ClientRoomState } from "@/hooks/use-room-state";
import { speak, useSpeechRecognition } from "@/hooks/use-speech";
import { useLocalMedia } from "@/hooks/use-media";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { RoomTopBar, ControlButton } from "./room-bar";
import { VideoTile } from "./video-tile";
import { TranscriptView } from "./transcript-view";
import { ConductWarningModal } from "./conduct-warning";
import { ConnectionOverlay } from "./connection-overlay";

const INACTIVITY_MS = 3 * 60_000; // generous: thinking time is never penalised

function AiAvatar({ speaking, thinking }: { speaking: boolean; thinking: boolean }) {
  return (
    <div className="relative flex h-28 w-28 items-center justify-center sm:h-36 sm:w-36" aria-hidden>
      {(speaking || thinking) && <span className="absolute inset-0 animate-pulse-ring rounded-full bg-olive-400/40" />}
      <span className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-olive-500 to-olive-800 shadow-2xl ring-4 ring-white/10">
        {speaking ? (
          <span className="flex h-10 items-end gap-1">
            {[0, 1, 2, 3, 4].map((i) => <span key={i} className="w-1.5 origin-bottom animate-bar rounded-full bg-white" style={{ height: "100%", animationDelay: `${i * 0.12}s` }} />)}
          </span>
        ) : (
          <Bot className="h-12 w-12 text-white sm:h-14 sm:w-14" />
        )}
      </span>
    </div>
  );
}

export function AiRoom({ id, candidateName, candidateInitials }: { id: string; candidateName: string; candidateInitials: string }) {
  const router = useRouter();
  const toast = useToast();
  const { state, setState, refresh, error, offline, serverNow } = useRoomState(id, 2500);
  const media = useLocalMedia({ video: true, audio: true });
  const [draft, setDraft] = useState("");
  const [usedSpeech, setUsedSpeech] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [starting, setStarting] = useState(false);
  const [voiceOn, setVoiceOn] = useState(true);
  const [speaking, setSpeaking] = useState(false);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [showTranscript, setShowTranscript] = useState(true);
  const answerStart = useRef<number>(Date.now());
  const lastActivity = useRef(Date.now());
  const inactivitySent = useRef(false);
  const spokenIds = useRef<Set<string>>(new Set());
  const bump = () => { lastActivity.current = Date.now(); inactivitySent.current = false; };

  const speech = useSpeechRecognition((t) => {
    setDraft((d) => (d ? `${d} ${t}` : t));
    setUsedSpeech(true);
    bump();
  });

  const elapsed = useElapsed(state?.startedAt ?? null, state?.pausedAt ?? null, serverNow);

  // Speak each new interviewer line once.
  useEffect(() => {
    if (!state) return;
    const lines = state.transcript.filter((t) => t.speaker === "interviewer" && !spokenIds.current.has(t.id));
    if (!lines.length) return;
    const first = spokenIds.current.size === 0 && state.transcript.length > 3; // don't replay history on refresh
    lines.forEach((l) => spokenIds.current.add(l.id));
    if (first || !voiceOn) return;
    const text = lines.map((l) => l.text).join(" ");
    speak(text, true);
    setSpeaking(true);
    const t = setTimeout(() => setSpeaking(false), Math.min(20000, 600 + text.split(/\s+/).length * 330));
    return () => clearTimeout(t);
  }, [state, voiceOn]);

  // Inactivity + tab-visibility signals (potential events only).
  const hasWarning = Boolean(state?.pendingWarning);
  useEffect(() => {
    if (state?.status !== "active" || state.pausedAt) return;
    let hiddenAt: number | null = null;
    const onVis = () => {
      if (document.visibilityState === "hidden") hiddenAt = Date.now();
      else if (hiddenAt) {
        const secs = Math.round((Date.now() - hiddenAt) / 1000);
        if (secs > 120) fetch(`/api/interviews/${id}/conduct`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "tab_hidden", details: `Interview tab hidden for ${secs}s` }) }).catch(() => {});
        hiddenAt = null;
        bump();
      }
    };
    const onAct = () => bump();
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("keydown", onAct);
    window.addEventListener("pointermove", onAct);
    const t = setInterval(() => {
      if (submitting || hasWarning || inactivitySent.current) return;
      if (Date.now() - lastActivity.current > INACTIVITY_MS) {
        inactivitySent.current = true;
        fetch(`/api/interviews/${id}/conduct`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ type: "inactivity", details: "No interaction for 3+ minutes during an active question" }) }).then(() => refresh());
      }
    }, 15_000);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("keydown", onAct);
      window.removeEventListener("pointermove", onAct);
      clearInterval(t);
    };
  }, [state?.status, state?.pausedAt, hasWarning, submitting, id, refresh]);

  // Reset composer when a new question arrives.
  const qid = state?.activeQuestion?.id;
  useEffect(() => {
    setDraft("");
    setUsedSpeech(false);
    answerStart.current = Date.now();
    bump();
  }, [qid]);

  // Head to results once grading starts.
  useEffect(() => {
    if (state && ["completed", "reported"].includes(state.status)) {
      speech.stop();
      const t = setTimeout(() => router.push(`/interviews/${id}/results`), 3500);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.status]);

  const begin = useCallback(async () => {
    setStarting(true);
    try {
      const s = await api<ClientRoomState>(`/api/interviews/${id}/ai/start`, { body: {} });
      setState(s);
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setStarting(false);
    }
  }, [id, setState, toast]);

  async function submit() {
    if (!state?.activeQuestion || !draft.trim()) return;
    speech.stop();
    setSubmitting(true);
    try {
      const s = await api<ClientRoomState>(`/api/interviews/${id}/ai/answer`, {
        body: { questionId: state.activeQuestion.id, text: draft.trim(), source: usedSpeech ? "speech" : "typed", durationSec: Math.round((Date.now() - answerStart.current) / 1000) },
      });
      setState(s);
    } catch (e) {
      toast.error((e as Error).message);
      refresh();
    } finally {
      setSubmitting(false);
    }
  }

  async function pause() {
    try {
      await api(`/api/interviews/${id}/pause`, { body: {} });
      speech.stop();
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function end() {
    setEnding(true);
    try {
      await api(`/api/interviews/${id}/end`, { body: {} });
      router.push(`/interviews/${id}/results`);
    } catch (e) {
      toast.error((e as Error).message);
      setEnding(false);
    }
  }

  if (error) return <Shell><div className="mx-auto max-w-md p-8"><Alert tone="danger" title="Can't open this interview">{error}</Alert><ButtonLink href="/dashboard" variant="secondary" className="mt-4">Back to dashboard</ButtonLink></div></Shell>;
  if (!state) return <Shell><div className="flex flex-1 items-center justify-center text-ink-300"><Spinner label="Loading interview" /></div></Shell>;

  if (state.questionStatus === "generating" || state.questionStatus === "not_started")
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-white">
          <AiAvatar speaking={false} thinking />
          <h1 className="mt-8 text-2xl font-semibold">Generating your customized interview…</h1>
          <p className="mt-2 max-w-md text-sm text-ink-300">Tailoring questions to {state.targetRole}{state.company ? ` at ${state.company}` : ""}, your profile and difficulty level.</p>
          <Spinner className="mt-6 text-olive-300" />
        </div>
      </Shell>
    );
  if (state.questionStatus === "failed")
    return (
      <Shell>
        <div className="mx-auto max-w-md p-8">
          <Alert tone="danger" title="We couldn't generate this interview" action={<Button size="sm" onClick={async () => { await api(`/api/interviews/${id}/regenerate`, { body: {} }).catch(() => {}); refresh(); }}>Retry</Button>}>Your setup is saved. Try again.</Alert>
        </div>
      </Shell>
    );

  if (["completed", "reported"].includes(state.status))
    return (
      <Shell>
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center text-white">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-olive-600"><CheckCircle2 className="h-8 w-8" /></span>
          <h1 className="mt-6 text-2xl font-semibold">Interview complete</h1>
          <p className="mt-2 text-sm text-ink-300">Your feedback is being generated…</p>
          <ButtonLink href={`/interviews/${id}/results`} variant="olive" className="mt-6">View results</ButtonLink>
        </div>
      </Shell>
    );
  if (["cancelled", "no_show"].includes(state.status))
    return <Shell><div className="mx-auto max-w-md p-8"><Alert tone="info" title="This interview is closed" /><ButtonLink href="/dashboard" variant="secondary" className="mt-4">Back to dashboard</ButtonLink></div></Shell>;

  const subtitle = `AI Interview · ${state.typeLabel} · ${state.difficulty[0].toUpperCase()}${state.difficulty.slice(1)}`;
  const paused = Boolean(state.pausedAt);

  if (state.status !== "active")
    return (
      <Shell>
        <RoomTopBar title={state.targetRole + (state.company ? ` · ${state.company}` : "")} subtitle={subtitle} elapsed={0} duration={state.duration} current={0} total={state.progress.total} />
        <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-8 p-6 lg:grid-cols-2">
          <VideoTile stream={media.stream} muted mirrored label="You" camOn={media.camOn} micOn={media.micOn} initials={candidateInitials} className="aspect-video" />
          <div className="text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive-300">Ready when you are</p>
            <h1 className="mt-2 text-3xl font-semibold">Your AI interviewer is ready.</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">{state.progress.total} questions · about {state.duration} minutes. Questions appear one at a time, with follow-ups based on your answers. Answer out loud (live speech-to-text) or type.</p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", media.hasVideo ? "bg-emerald-400" : "bg-amber-400")} />Camera {media.hasVideo ? "ready" : "unavailable (optional)"}</li>
              <li className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", media.hasAudio ? "bg-emerald-400" : "bg-amber-400")} />Microphone {media.hasAudio ? "ready" : "unavailable"}
                {media.hasAudio && <span className="ml-2 inline-block h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-olive-400 transition-all" style={{ width: `${media.level * 100}%` }} /></span>}
              </li>
              <li className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", speech.supported ? "bg-emerald-400" : "bg-amber-400")} />{speech.supported ? "Live speech-to-text available" : "Speech-to-text not supported in this browser — you'll type answers"}</li>
            </ul>
            {media.error && <p className="mt-3 text-xs text-amber-300">{media.error}</p>}
            <Button variant="olive" size="lg" className="mt-8" onClick={begin} loading={starting}><Play className="h-4 w-4" /> Begin interview</Button>
            <p className="mt-3 text-xs text-ink-400">Nothing is recorded. Only the text transcript is saved, for grading.</p>
          </div>
        </div>
      </Shell>
    );

  const lastInterviewerLine = [...state.transcript].reverse().find((t) => t.speaker === "interviewer");
  const preamble = lastInterviewerLine && state.activeQuestion && lastInterviewerLine.text !== state.activeQuestion.text ? lastInterviewerLine.text.replace(state.activeQuestion.text, "").trim() : "";

  return (
    <Shell>
      <ConnectionOverlay show={offline} />
      <ConductWarningModal interviewId={id} warning={state.pendingWarning} onResolved={() => { bump(); refresh(); }} />
      <RoomTopBar title={state.targetRole + (state.company ? ` · ${state.company}` : "")} subtitle={subtitle} elapsed={elapsed} duration={state.duration} current={state.progress.current} total={state.progress.total} paused={paused} live />
      <div className="grid min-h-0 flex-1 gap-4 p-4 lg:grid-cols-[1fr_360px] lg:p-6">
        <section className="flex min-h-0 flex-col rounded-3xl bg-gradient-to-b from-ink-800 to-ink-900 p-6 sm:p-10" aria-label="AI interviewer">
          <div className="flex flex-col items-center text-center">
            <AiAvatar speaking={speaking} thinking={submitting} />
            <p className="mt-4 text-sm font-medium text-white">Ava <span className="text-ink-400">· AI Interviewer</span></p>
            <p className="h-5 text-xs text-ink-400" aria-live="polite">{submitting ? "Ava is considering your answer…" : speaking ? "Speaking…" : paused ? "Paused" : ""}</p>
          </div>
          <div className="mx-auto mt-6 w-full max-w-3xl flex-1">
            {paused ? (
              <div className="rounded-2xl bg-white/5 p-6 text-center text-ink-200">
                <p className="text-lg font-semibold text-white">Interview paused</p>
                <p className="mt-1 text-sm">The timer is stopped. Resume when you&apos;re ready.</p>
                <Button variant="olive" className="mt-4" onClick={pause}><Play className="h-4 w-4" /> Resume</Button>
              </div>
            ) : state.activeQuestion ? (
              <div className="rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive-700">{state.activeQuestion.isFollowUp ? "Follow-up question" : `Question ${state.progress.current} of ${state.progress.total}`}</p>
                {preamble && <p className="mt-2 text-sm text-ink-500">{preamble}</p>}
                <p className="mt-2 text-lg font-medium leading-relaxed text-ink-950 sm:text-xl">{state.activeQuestion.text}</p>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/5 p-6 text-ink-200"><Spinner /> Preparing the next question…</div>
            )}
          </div>

          {!paused && state.activeQuestion && (
            <div className="mx-auto mt-6 w-full max-w-3xl">
              {speech.error && <p className="mb-2 text-xs text-amber-300">{speech.error}</p>}
              <div className="rounded-2xl border border-white/10 bg-ink-950/60 p-3">
                <label htmlFor="answer" className="sr-only">Your answer</label>
                <textarea
                  id="answer"
                  value={draft + (speech.interim ? (draft ? " " : "") + speech.interim : "")}
                  onChange={(e) => { setDraft(e.target.value); bump(); }}
                  placeholder={speech.supported ? "Press the microphone and answer out loud — your words appear here. You can edit before submitting." : "Type your answer…"}
                  className="min-h-[96px] w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-white placeholder:text-ink-500 focus:outline-none"
                  onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
                  disabled={submitting}
                />
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-3">
                  <div className="flex items-center gap-2">
                    {speech.supported ? (
                      <button type="button" onClick={() => (speech.listening ? speech.stop() : speech.start())} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium", speech.listening ? "bg-red-600 text-white" : "bg-white/10 text-white hover:bg-white/20")} aria-pressed={speech.listening}>
                        {speech.listening ? <><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Listening — tap to stop</> : <><Mic className="h-4 w-4" /> Answer out loud</>}
                      </button>
                    ) : (
                      <span className="flex items-center gap-2 text-xs text-ink-400"><Keyboard className="h-4 w-4" /> Typing mode</span>
                    )}
                    <span className="hidden text-xs text-ink-500 sm:inline">{draft.trim() ? `${draft.trim().split(/\s+/).length} words` : ""}</span>
                  </div>
                  <Button variant="olive" onClick={submit} loading={submitting} disabled={!draft.trim()}>
                    Submit answer <Send className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col gap-4">
          <VideoTile stream={media.stream} muted mirrored label={candidateName} sublabel="You" camOn={media.camOn} micOn={media.micOn} initials={candidateInitials} className="aspect-video shrink-0" />
          <div className="flex min-h-0 flex-1 flex-col rounded-2xl bg-white">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Transcript</p>
              <button onClick={() => setShowTranscript((s) => !s)} className="text-xs text-ink-500 hover:text-ink-900" aria-expanded={showTranscript}>{showTranscript ? "Hide" : "Show"}</button>
            </div>
            {showTranscript && <TranscriptView entries={state.transcript} interviewerName="Ava (AI)" candidateName="You" className="max-h-[40vh] flex-1 p-4 lg:max-h-none" />}
          </div>
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <ControlButton onClick={media.toggleMic} active={media.micOn} label={media.micOn ? "Mute microphone" : "Unmute microphone"}>{media.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={media.toggleCam} active={media.camOn} label={media.camOn ? "Turn camera off" : "Turn camera on"}>{media.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={() => { setVoiceOn((v) => !v); if (voiceOn) window.speechSynthesis?.cancel(); }} active={voiceOn} label={voiceOn ? "Mute interviewer voice" : "Unmute interviewer voice"}>{voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={pause} label={paused ? "Resume interview" : "Pause interview"}>{paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={() => setConfirmEnd(true)} danger label="End interview"><LogOut className="h-5 w-5" /><span className="hidden sm:inline">End interview</span></ControlButton>
      </footer>

      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={end} loading={ending} title="End the interview now?" description="Your answers so far will be graded by AI. Unanswered questions lower your score." confirmLabel="End and get feedback" tone="primary" />
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-ink-950 lg:h-screen">
      {children}
      <Link href="/dashboard" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:rounded focus:bg-white focus:px-3 focus:py-1">Exit to dashboard</Link>
    </div>
  );
}

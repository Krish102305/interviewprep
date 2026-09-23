"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { Captions, CheckCircle2, Keyboard, LogOut, Mic, MicOff, Pause, Play, ScrollText, Send, SignalHigh, Video, VideoOff, Volume2, VolumeX } from "lucide-react";
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
import { InterviewerScene } from "./interviewer-scene";
import { PERSONAS, type Persona } from "@/lib/ai/personas";

const INACTIVITY_MS = 3 * 60_000; // generous: thinking time is never penalised

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
  const [showTranscript, setShowTranscript] = useState(false);
  const [captionsOn, setCaptionsOn] = useState(true);
  const [pulse, setPulse] = useState(0);
  const [chunks, setChunks] = useState<string[]>([]);
  const [chunkIdx, setChunkIdx] = useState(0);
  const wordsSpoken = useRef({ boundary: 0, startedAt: 0 });
  const stopSpeech = useRef<(() => void) | null>(null);
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

  const personaKey = (state?.interviewer as { persona?: string } | null | undefined)?.persona;
  const persona: Persona = (personaKey && PERSONAS[personaKey]) || PERSONAS.ava;

  // Speak each new interviewer line once, lip-synced to the browser's voice.
  useEffect(() => {
    if (!state) return;
    const lines = state.transcript.filter((t) => t.speaker === "interviewer" && !spokenIds.current.has(t.id));
    if (!lines.length) return;
    const replay = spokenIds.current.size === 0 && state.transcript.length > 3; // don't replay history after a refresh
    lines.forEach((l) => spokenIds.current.add(l.id));
    const text = lines.map((l) => l.text).join(" ");
    if (replay) return;
    setChunks(captionChunks(text));
    setChunkIdx(0);
    wordsSpoken.current = { boundary: 0, startedAt: Date.now() };
    stopSpeech.current?.();
    stopSpeech.current = speak(text, voiceOn, {
      voiceHints: persona.voiceHints,
      gender: persona.gender,
      onStart: () => setSpeaking(true),
      onEnd: () => setSpeaking(false),
      onWord: () => {
        wordsSpoken.current.boundary += 1;
        setPulse((p) => p + 1);
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state?.transcript.length, voiceOn]);
  useEffect(() => () => stopSpeech.current?.(), []);

  // Advance the caption sentence-by-sentence in step with the voice (word boundaries
  // when the browser reports them, otherwise an estimated speaking rate).
  useEffect(() => {
    if (!speaking || chunks.length < 2) return;
    const ends = chunks.reduce<number[]>((acc, c) => [...acc, (acc.at(-1) ?? 0) + c.split(/\s+/).length], []);
    const t = setInterval(() => {
      const w = wordsSpoken.current;
      const spoken = w.boundary > 0 ? w.boundary : ((Date.now() - w.startedAt) / 1000) * 2.7;
      const idx = ends.findIndex((e) => spoken < e);
      setChunkIdx(idx === -1 ? chunks.length - 1 : idx);
    }, 200);
    return () => clearInterval(t);
  }, [speaking, chunks]);

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
        <div className="flex flex-1 items-center justify-center p-4 lg:p-8">
          <Stage persona={persona} speaking={false} className="w-full max-w-5xl">
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/55 px-6 text-center text-white backdrop-blur-[2px]">
              <Spinner className="text-olive-300" />
              <h1 className="mt-5 text-2xl font-semibold">{persona.firstName} is preparing your interview…</h1>
              <p className="mt-2 max-w-md text-sm text-ink-200">Tailoring questions to {state.targetRole}{state.company ? ` at ${state.company}` : ""}, your profile and difficulty level.</p>
            </div>
          </Stage>
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
        <div className="mx-auto grid w-full max-w-6xl flex-1 items-center gap-8 p-4 lg:grid-cols-[1.6fr_1fr] lg:p-8">
          <Stage persona={persona} speaking={false} listening={media.level > 0.12}>
            <NameTag persona={persona} />
            <div className="absolute bottom-3 right-3 w-[26%] min-w-[130px] overflow-hidden rounded-xl shadow-2xl ring-2 ring-white/20">
              <VideoTile stream={media.stream} muted mirrored label={candidateName.split(" ")[0] || "You"} sublabel="You" camOn={media.camOn} micOn={media.micOn} initials={candidateInitials} className="aspect-video rounded-none" />
            </div>
          </Stage>
          <div className="text-white">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive-300">Waiting room</p>
            <h1 className="mt-2 text-3xl font-semibold">{persona.firstName} is ready when you are.</h1>
            <p className="mt-3 text-sm leading-relaxed text-ink-300">{state.progress.total} questions · about {state.duration} minutes with {persona.name}, your AI interviewer ({persona.title}). Questions come one at a time, with follow-ups based on your answers. Answer out loud or type.</p>
            <ul className="mt-5 space-y-2 text-sm">
              <li className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", media.hasVideo ? "bg-emerald-400" : "bg-amber-400")} />Camera {media.hasVideo ? "ready" : "unavailable (optional)"}</li>
              <li className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", media.hasAudio ? "bg-emerald-400" : "bg-amber-400")} />Microphone {media.hasAudio ? "ready" : "unavailable"}
                {media.hasAudio && <span className="ml-2 inline-block h-1.5 w-24 overflow-hidden rounded-full bg-white/10"><span className="block h-full bg-olive-400 transition-all" style={{ width: `${media.level * 100}%` }} /></span>}
              </li>
              <li className="flex items-center gap-2"><span className={cn("h-2 w-2 rounded-full", speech.supported ? "bg-emerald-400" : "bg-amber-400")} />{speech.supported ? "Live speech-to-text available" : "Speech-to-text not supported in this browser — you'll type answers"}</li>
              <li className="flex items-center gap-2"><Volume2 className="h-3.5 w-3.5 text-ink-400" />Turn your volume up — {persona.firstName} speaks out loud.</li>
            </ul>
            {media.error && <p className="mt-3 text-xs text-amber-300">{media.error}</p>}
            <Button variant="olive" size="lg" className="mt-8" onClick={begin} loading={starting}><Play className="h-4 w-4" /> Join interview</Button>
            <p className="mt-3 text-xs text-ink-400">Nothing is recorded. Only the text transcript is saved, for grading.</p>
          </div>
        </div>
      </Shell>
    );

  const candidateTalking = media.level > 0.12 || Boolean(speech.interim);
  const statusLine = submitting ? `${persona.firstName} is considering your answer…` : speaking ? `${persona.firstName} is speaking` : state.activeQuestion ? "Your turn to answer" : "";

  return (
    <Shell>
      <ConnectionOverlay show={offline} />
      <ConductWarningModal interviewId={id} warning={state.pendingWarning} onResolved={() => { bump(); refresh(); }} />
      <RoomTopBar title={state.targetRole + (state.company ? ` · ${state.company}` : "")} subtitle={subtitle} elapsed={elapsed} duration={state.duration} current={state.progress.current} total={state.progress.total} paused={paused} live />
      <div className="flex min-h-0 flex-1 gap-4 p-3 sm:p-4 lg:p-6">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col items-center gap-3 overflow-y-auto" aria-label="Interview">
          <Stage persona={persona} speaking={speaking} pulse={pulse} listening={candidateTalking && !speaking} thinking={submitting} className="w-full max-w-[min(100%,calc((100vh-420px)*16/9))]">
            <NameTag persona={persona} />
            <div className="absolute right-3 top-3 flex items-center gap-2">
              {state.activeQuestion && (
                <span className="rounded-lg bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur">
                  {state.activeQuestion.isFollowUp ? "Follow-up" : `Question ${state.progress.current} of ${state.progress.total}`}
                </span>
              )}
              <span className="rounded-lg bg-black/55 p-1.5 text-emerald-300 backdrop-blur" title="Connection good"><SignalHigh className="h-3.5 w-3.5" aria-hidden /></span>
            </div>

            {captionsOn && !paused && (speaking ? chunks[chunkIdx] : state.activeQuestion?.text) && (
              <div className="absolute inset-x-0 bottom-0 hidden justify-center px-4 pb-4 sm:flex sm:px-[26%] sm:pb-5">
                <p className="max-w-3xl rounded-lg bg-black/70 px-4 py-2 text-center text-sm leading-relaxed text-white backdrop-blur sm:text-[15px]" aria-live="polite">{speaking ? chunks[chunkIdx] : state.activeQuestion?.text}</p>
              </div>
            )}

            <div className={cn("absolute bottom-2 right-2 w-[28%] min-w-[96px] sm:bottom-3 sm:right-3 sm:w-[22%] sm:min-w-[120px] overflow-hidden rounded-xl shadow-2xl ring-2 transition", candidateTalking && !speaking ? "ring-emerald-400" : "ring-white/20")}>
              <VideoTile stream={media.stream} muted mirrored label={candidateName.split(" ")[0] || "You"} sublabel="You" camOn={media.camOn} micOn={media.micOn} initials={candidateInitials} className="aspect-video rounded-none" />
            </div>

            {paused && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/70 text-center text-white backdrop-blur-sm">
                <p className="text-xl font-semibold">Interview paused</p>
                <p className="mt-1 text-sm text-ink-300">The timer is stopped. Resume when you&apos;re ready.</p>
                <Button variant="olive" className="mt-4" onClick={pause}><Play className="h-4 w-4" /> Resume</Button>
              </div>
            )}
          </Stage>

          {captionsOn && !paused && (speaking ? chunks[chunkIdx] : state.activeQuestion?.text) && (
            <p className="w-full rounded-xl bg-white/5 px-4 py-3 text-center text-[15px] leading-relaxed text-white sm:hidden" aria-hidden>
              {speaking ? chunks[chunkIdx] : state.activeQuestion?.text}
            </p>
          )}

          {!paused && (
            <div className="w-full max-w-3xl">
              <p className="mb-2 flex h-5 items-center justify-center gap-2 text-xs text-ink-300" aria-live="polite">
                {submitting && <Spinner className="h-3.5 w-3.5" />}
                {statusLine}
              </p>
              {state.activeQuestion ? (
                <>
                  {speech.error && <p className="mb-2 text-xs text-amber-300">{speech.error}</p>}
                  <div className="rounded-2xl border border-white/10 bg-ink-900/80 p-3">
                    <label htmlFor="answer" className="sr-only">Your answer</label>
                    <textarea
                      id="answer"
                      value={draft + (speech.interim ? (draft ? " " : "") + speech.interim : "")}
                      onChange={(e) => { setDraft(e.target.value); bump(); }}
                      placeholder={speech.supported ? "Tap “Answer out loud” and speak — your words appear here. You can edit before submitting." : "Type your answer…"}
                      className="min-h-[76px] w-full resize-none bg-transparent px-2 py-1.5 text-[15px] leading-relaxed text-white placeholder:text-ink-500 focus:outline-none"
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
                </>
              ) : (
                <div className="flex items-center justify-center gap-3 rounded-2xl bg-white/5 p-5 text-sm text-ink-200"><Spinner className="h-4 w-4" /> One moment…</div>
              )}
            </div>
          )}
        </section>

        {showTranscript && (
          <aside className="fixed inset-x-3 bottom-24 top-20 z-40 flex min-h-0 flex-col rounded-2xl bg-white shadow-2xl lg:static lg:inset-auto lg:z-auto lg:w-[340px] lg:shadow-none">
            <div className="flex items-center justify-between border-b border-ink-100 px-4 py-3">
              <p className="text-sm font-semibold text-ink-900">Transcript</p>
              <button onClick={() => setShowTranscript(false)} className="text-xs text-ink-500 hover:text-ink-900">Close</button>
            </div>
            <TranscriptView entries={state.transcript} interviewerName={`${persona.firstName} (AI)`} candidateName="You" className="flex-1 p-4" />
          </aside>
        )}
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <ControlButton onClick={media.toggleMic} active={media.micOn} label={media.micOn ? "Mute microphone" : "Unmute microphone"}>{media.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={media.toggleCam} active={media.camOn} label={media.camOn ? "Turn camera off" : "Turn camera on"}>{media.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={() => { if (voiceOn) window.speechSynthesis?.cancel(); setVoiceOn((v) => !v); }} active={voiceOn} label={voiceOn ? `Mute ${persona.firstName}'s voice` : `Unmute ${persona.firstName}'s voice`}>{voiceOn ? <Volume2 className="h-5 w-5" /> : <VolumeX className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={() => setCaptionsOn((c) => !c)} active={captionsOn} label={captionsOn ? "Hide captions" : "Show captions"}><Captions className="h-5 w-5" /></ControlButton>
        <ControlButton onClick={() => setShowTranscript((t) => !t)} active={!showTranscript} label={showTranscript ? "Hide transcript" : "Show transcript"}><ScrollText className="h-5 w-5" /></ControlButton>
        <ControlButton onClick={pause} label={paused ? "Resume interview" : "Pause interview"}>{paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={() => setConfirmEnd(true)} danger label="End interview"><LogOut className="h-5 w-5" /><span className="hidden sm:inline">End interview</span></ControlButton>
      </footer>

      <ConfirmDialog open={confirmEnd} onClose={() => setConfirmEnd(false)} onConfirm={end} loading={ending} title="End the interview now?" description="Your answers so far will be graded by AI. Unanswered questions lower your score." confirmLabel="End and get feedback" tone="primary" />
    </Shell>
  );
}

/** Split spoken text into short caption chunks (sentences, max ~24 words each). */
function captionChunks(text: string) {
  const sentences = text.match(/[^.!?]+[.!?]+["”’)]*|[^.!?]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [text];
  const out: string[] = [];
  for (const sentence of sentences) {
    const prev = out.at(-1);
    if (prev && prev.split(/\s+/).length + sentence.split(/\s+/).length <= 14) out[out.length - 1] = `${prev} ${sentence}`;
    else if (sentence.split(/\s+/).length > 24) {
      const words = sentence.split(/\s+/);
      for (let i = 0; i < words.length; i += 20) out.push(words.slice(i, i + 20).join(" "));
    } else out.push(sentence);
  }
  return out;
}

/** The interviewer's "video feed": the animated scene plus overlays passed as children. */
function Stage({ persona, speaking, pulse, listening, thinking, className, children }: { persona: Persona; speaking: boolean; pulse?: number; listening?: boolean; thinking?: boolean; className?: string; children?: React.ReactNode }) {
  return (
    <div className={cn("relative aspect-video w-full shrink-0 overflow-hidden rounded-2xl bg-ink-900 shadow-2xl ring-2 transition-shadow", speaking ? "ring-olive-400" : "ring-white/10", className)}>
      <InterviewerScene persona={persona} speaking={speaking} pulse={pulse} listening={listening} thinking={thinking} className="absolute inset-0" />
      {children}
    </div>
  );
}

function NameTag({ persona }: { persona: Persona }) {
  return (
    <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg bg-black/55 px-2.5 py-1.5 text-white backdrop-blur">
      <span className="rounded bg-olive-500 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide">AI</span>
      <span className="text-sm font-medium">{persona.name}</span>
      <span className="hidden text-xs text-white/70 md:inline">· {persona.title}</span>
    </div>
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

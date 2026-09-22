"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  CheckCircle2, ChevronDown, CornerDownRight, Flag, LogOut, MessageSquarePlus, Mic, MicOff, MonitorUp, NotebookPen, Pause, Play, ShieldAlert, SkipForward, Sparkles, Subtitles, Video, VideoOff,
} from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { useElapsed, useRoomState, type ClientRoomState } from "@/hooks/use-room-state";
import { useSpeechRecognition } from "@/hooks/use-speech";
import { useLocalMedia } from "@/hooks/use-media";
import { useWebRTC } from "@/hooks/use-webrtc";
import { Button, ButtonLink } from "@/components/ui/button";
import { Alert, Spinner } from "@/components/ui/feedback";
import { ConfirmDialog, Modal } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { RoomTopBar, ControlButton } from "./room-bar";
import { VideoTile } from "./video-tile";
import { TranscriptView } from "./transcript-view";
import { ConductWarningModal } from "./conduct-warning";
import { ConnectionOverlay } from "./connection-overlay";
import { ReportDialog } from "./report-dialog";

type Guide = NonNullable<ClientRoomState["guide"]>;
const initialsOf = (name: string) => name.split(/\s+/).map((p) => p[0]).join("").slice(0, 2).toUpperCase();

export function HumanRoom({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { state, refresh, error, offline, serverNow } = useRoomState(id, 1500);
  const media = useLocalMedia();
  const isInterviewer = state?.me.role === "interviewer";
  const active = state?.status === "active";
  const rtc = useWebRTC({ interviewId: id, localStream: media.stream, polite: state?.me.role === "candidate", enabled: Boolean(state && active && media.stream) });
  const elapsed = useElapsed(state?.startedAt ?? null, state?.pausedAt ?? null, serverNow);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [ending, setEnding] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [captions, setCaptions] = useState(true);
  const [typed, setTyped] = useState("");

  // Candidate: live speech-to-text segments go straight into the transcript.
  const speech = useSpeechRecognition((text) => {
    api(`/api/interviews/${id}/segment`, { body: { text, source: "speech" } }).catch(() => {});
  });
  const shouldListen = !isInterviewer && active && !state?.pausedAt && media.micOn && captions && speech.supported;
  useEffect(() => {
    if (shouldListen) speech.start();
    else speech.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldListen]);

  useEffect(() => {
    if (!state) return;
    if (["completed", "reported"].includes(state.status)) router.replace(isInterviewer ? `/interviews/${id}/wrap-up` : `/interviews/${id}/results`);
    else if (["scheduled", "waiting"].includes(state.status)) router.replace(`/interviews/${id}/lobby`);
  }, [state, id, isInterviewer, router]);

  useEffect(() => {
    if (media.error) api(`/api/interviews/${id}/technical`, { body: { type: "media_denied", details: media.error } }).catch(() => {});
  }, [media.error, id]);

  async function end() {
    setEnding(true);
    try {
      await api(`/api/interviews/${id}/end`, { body: {} });
      speech.stop();
      router.replace(isInterviewer ? `/interviews/${id}/wrap-up` : `/interviews/${id}/results`);
    } catch (e) {
      toast.error((e as Error).message);
      setEnding(false);
    }
  }

  async function pause() {
    try {
      await api(`/api/interviews/${id}/pause`, { body: {} });
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  async function sendTyped() {
    if (!typed.trim()) return;
    try {
      await api(`/api/interviews/${id}/segment`, { body: { text: typed.trim(), source: "typed" } });
      setTyped("");
      refresh();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  if (error) return <Dark><div className="mx-auto max-w-md p-8"><Alert tone="danger" title="Can't open this interview">{error}</Alert><ButtonLink href="/dashboard" variant="secondary" className="mt-4">Back</ButtonLink></div></Dark>;
  if (!state || !active) return <Dark><div className="flex flex-1 items-center justify-center text-ink-300"><Spinner label="Joining interview" /></div></Dark>;

  const me = isInterviewer ? state.interviewer! : state.candidate;
  const other = isInterviewer ? state.candidate : state.interviewer!;
  const otherOnline = other.presence?.online ?? false;
  const paused = Boolean(state.pausedAt);
  const peerIssue = rtc.peerState === "reconnecting" || (!otherOnline && rtc.peerState !== "connected");
  const localTile = (
    <VideoTile stream={media.stream} muted mirrored={!rtc.sharing} label={me.name} sublabel="You" camOn={media.camOn || rtc.sharing} micOn={media.micOn} initials={initialsOf(me.name)} className="aspect-video" />
  );
  const remoteTile = (
    <VideoTile
      stream={rtc.remoteStream}
      label={other.name}
      sublabel={isInterviewer ? "Candidate" : "Interviewer"}
      initials={initialsOf(other.name)}
      className="aspect-video"
      overlay={
        peerIssue ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-ink-950/70 text-center text-sm text-white" role="status">
            <Spinner />
            <p className="mt-3 font-medium">{otherOnline ? "Connection interrupted" : `Waiting for ${other.name} to reconnect…`}</p>
            <p className="text-xs text-ink-300">{otherOnline ? "Trying to reconnect…" : "Technical issues are never counted as misconduct."}</p>
          </div>
        ) : null
      }
    />
  );

  return (
    <Dark>
      <ConnectionOverlay show={offline} />
      {!isInterviewer && <ConductWarningModal interviewId={id} warning={state.pendingWarning} onResolved={refresh} />}
      <RoomTopBar title={`${state.targetRole}${state.company ? ` · ${state.company}` : ""}`} subtitle={`Human Interview · ${state.typeLabel}`} elapsed={elapsed} duration={state.duration} current={state.progress.current} total={state.progress.total} paused={paused} live />

      <div className={cn("grid min-h-0 flex-1 gap-4 p-4 lg:p-6", isInterviewer ? "lg:grid-cols-[1fr_420px]" : "lg:grid-cols-[1fr_360px]")}>
        <section className="flex min-h-0 flex-col gap-4" aria-label="Interview">
          {/* Left: candidate · Right: interviewer */}
          <div className="grid gap-4 sm:grid-cols-2">
            {isInterviewer ? <>{remoteTile}{localTile}</> : <>{localTile}{remoteTile}</>}
          </div>

          <div className="rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
            {paused ? (
              <div className="text-center">
                <p className="text-lg font-semibold text-ink-900">Interview paused</p>
                <p className="mt-1 text-sm text-ink-500">{isInterviewer ? "Resume whenever you're both ready." : "Your interviewer paused the interview."}</p>
                {isInterviewer && <Button className="mt-4" onClick={pause}><Play className="h-4 w-4" /> Resume</Button>}
              </div>
            ) : state.activeQuestion ? (
              <>
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive-700">{state.activeQuestion.isFollowUp ? "Follow-up question" : `Question ${state.progress.current} of ${state.progress.total}`}</p>
                <p className="mt-2 text-lg font-medium leading-relaxed text-ink-950 sm:text-xl">{state.activeQuestion.text}</p>
              </>
            ) : (
              <div className="text-center">
                <p className="font-semibold text-ink-900">{isInterviewer ? "Introduce yourself, then ask the first question from your guide." : "Your interviewer will begin shortly."}</p>
                <p className="mt-1 text-sm text-ink-500">{isInterviewer ? "Questions appear on the candidate's screen only when you ask them." : "Questions will appear here as they're asked."}</p>
              </div>
            )}
            {isInterviewer && !paused && <InterviewerQuickActions id={id} state={state} onChange={refresh} />}
          </div>

          {!isInterviewer && (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-ink-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-2">
                  <Subtitles className="h-4 w-4" />
                  {!speech.supported ? "Speech-to-text isn't supported in this browser — type key points of your answers below so they can be graded." : speech.listening ? <>Live transcription on <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /></> : media.micOn ? "Live transcription paused" : "Unmute to transcribe your answers"}
                </p>
                {speech.supported && <button onClick={() => setCaptions((c) => !c)} className="text-xs underline-offset-2 hover:underline">{captions ? "Turn off transcription" : "Turn on transcription"}</button>}
              </div>
              {speech.error && <p className="mt-2 text-xs text-amber-300">{speech.error}</p>}
              <div className="mt-3 flex gap-2">
                <label htmlFor="typed" className="sr-only">Type part of your answer</label>
                <input id="typed" value={typed} onChange={(e) => setTyped(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendTyped()} placeholder="Type instead (added to your transcript)…" className="flex-1 rounded-lg border border-white/10 bg-ink-950/60 px-3 py-2 text-sm text-white placeholder:text-ink-500 focus:border-olive-400 focus:outline-none" />
                <Button variant="secondary" size="md" onClick={sendTyped} disabled={!typed.trim()}>Add</Button>
              </div>
            </div>
          )}
        </section>

        <aside className="flex min-h-0 flex-col overflow-hidden rounded-2xl bg-white">
          {isInterviewer ? <GuidePanel id={id} state={state} onChange={refresh} /> : (
            <>
              <div className="border-b border-ink-100 px-4 py-3"><p className="text-sm font-semibold text-ink-900">Transcript</p></div>
              <TranscriptView entries={state.transcript} interviewerName={state.interviewer?.name ?? "Interviewer"} candidateName="You" interim={speech.interim} className="max-h-[50vh] flex-1 p-4 lg:max-h-none" />
            </>
          )}
        </aside>
      </div>

      <footer className="flex flex-wrap items-center justify-center gap-2 border-t border-white/10 px-4 py-3">
        <ControlButton onClick={media.toggleMic} active={media.micOn} label={media.micOn ? "Mute" : "Unmute"}>{media.micOn ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}</ControlButton>
        <ControlButton onClick={media.toggleCam} active={media.camOn} label={media.camOn ? "Turn camera off" : "Turn camera on"}>{media.camOn ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}</ControlButton>
        {rtc.screenSupported && (
          <ControlButton onClick={() => rtc.toggleScreenShare().catch((e) => toast.error((e as Error).message))} active={!rtc.sharing} label={rtc.sharing ? "Stop sharing screen" : "Share screen"}><MonitorUp className="h-5 w-5" /></ControlButton>
        )}
        {isInterviewer && <ControlButton onClick={pause} label={paused ? "Resume interview" : "Pause interview"}>{paused ? <Play className="h-5 w-5" /> : <Pause className="h-5 w-5" />}</ControlButton>}
        <ControlButton onClick={() => setReportOpen(true)} label={isInterviewer ? "Report conduct" : "Report interviewer"}><Flag className="h-5 w-5" /></ControlButton>
        <ControlButton onClick={() => setConfirmEnd(true)} danger label={isInterviewer ? "End interview" : "Leave interview"}><LogOut className="h-5 w-5" /><span className="hidden sm:inline">{isInterviewer ? "End interview" : "Leave"}</span></ControlButton>
      </footer>

      <ReportDialog interviewId={id} open={reportOpen} onClose={() => setReportOpen(false)} subject={other.name} />
      <ConfirmDialog
        open={confirmEnd}
        onClose={() => setConfirmEnd(false)}
        onConfirm={end}
        loading={ending}
        tone={isInterviewer ? "primary" : "danger"}
        title={isInterviewer ? "End the interview?" : "Leave the interview?"}
        description={isInterviewer ? "The transcript will be graded by AI. You'll be able to add optional feedback next." : "Leaving early without a reason may be reported by your interviewer. If you're having technical trouble, you can rejoin instead — technical issues are never misconduct."}
        confirmLabel={isInterviewer ? "End interview" : "Leave interview"}
      />
    </Dark>
  );
}

function InterviewerQuickActions({ id, state, onChange }: { id: string; state: ClientRoomState; onChange: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const [suggestion, setSuggestion] = useState<{ text: string; rationale: string; engine: string } | null>(null);
  const [custom, setCustom] = useState("");
  const main = (state.guide ?? []).filter((q) => !q.isFollowUp);
  const nextQ = main.find((q) => !q.askedAt);

  async function ask(body: { questionId: string } | { customText: string; parentQuestionId?: string | null }, key: string) {
    setBusy(key);
    try {
      await api(`/api/interviews/${id}/ask`, { body });
      setSuggestion(null);
      setCustom("");
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }
  async function generate() {
    setBusy("gen");
    try {
      setSuggestion(await api(`/api/interviews/${id}/follow-up`, { body: {} }));
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="mt-6 space-y-3 border-t border-ink-100 pt-5">
      <div className="flex flex-wrap gap-2">
        {nextQ ? (
          <Button onClick={() => ask({ questionId: nextQ.id }, "next")} loading={busy === "next"}>
            {state.activeQuestion ? <><SkipForward className="h-4 w-4" /> Next question</> : <>Ask question 1</>}
          </Button>
        ) : (
          <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>All planned questions asked</Badge>
        )}
        <Button variant="secondary" onClick={generate} loading={busy === "gen"} disabled={!state.activeQuestion}><Sparkles className="h-4 w-4" /> Generate follow-up</Button>
      </div>
      {nextQ && <p className="text-xs text-ink-500">Up next: “{nextQ.text.length > 110 ? `${nextQ.text.slice(0, 110)}…` : nextQ.text}”</p>}
      {suggestion && (
        <div className="rounded-xl border border-olive-200 bg-olive-50 p-4">
          <p className="text-xs font-semibold text-olive-800">Suggested follow-up {suggestion.engine === "fallback" && <span className="font-normal text-olive-700">(rule-based)</span>}</p>
          <p className="mt-1 text-sm font-medium text-ink-900">“{suggestion.text}”</p>
          <p className="mt-1 text-xs text-ink-500">{suggestion.rationale}</p>
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={() => ask({ customText: suggestion.text, parentQuestionId: state.activeQuestion?.id }, "sug")} loading={busy === "sug"}>Ask this</Button>
            <Button size="sm" variant="ghost" onClick={() => setSuggestion(null)}>Dismiss</Button>
          </div>
        </div>
      )}
      {state.activeQuestion && (
        <div className="flex gap-2">
          <label htmlFor="custom-fu" className="sr-only">Custom follow-up</label>
          <input id="custom-fu" value={custom} onChange={(e) => setCustom(e.target.value)} onKeyDown={(e) => e.key === "Enter" && custom.trim().length > 2 && ask({ customText: custom.trim(), parentQuestionId: state.activeQuestion?.id }, "custom")} placeholder="Ask your own follow-up…" className="input-base py-2" />
          <Button variant="secondary" onClick={() => ask({ customText: custom.trim(), parentQuestionId: state.activeQuestion?.id }, "custom")} disabled={custom.trim().length < 3} loading={busy === "custom"} aria-label="Ask custom follow-up"><CornerDownRight className="h-4 w-4" /></Button>
        </div>
      )}
    </div>
  );
}

function GuidePanel({ id, state, onChange }: { id: string; state: ClientRoomState; onChange: () => void }) {
  const [tab, setTab] = useState<"guide" | "notes" | "transcript">("guide");
  const tabs = [
    { key: "guide", label: "Interview guide" },
    { key: "notes", label: "Private notes" },
    { key: "transcript", label: "Transcript" },
  ] as const;
  return (
    <>
      <div className="flex border-b border-ink-100" role="tablist" aria-label="Interviewer tools">
        {tabs.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)} className={cn("flex-1 border-b-2 px-3 py-3 text-xs font-semibold", tab === t.key ? "border-ink-900 text-ink-900" : "border-transparent text-ink-500 hover:text-ink-800")}>{t.label}</button>
        ))}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto" role="tabpanel">
        {tab === "guide" && <GuideQuestions id={id} guide={state.guide ?? []} activeId={state.activeQuestion?.id ?? null} onChange={onChange} />}
        {tab === "notes" && <NotesPanel id={id} activeQuestionId={state.activeQuestion?.id ?? null} />}
        {tab === "transcript" && <TranscriptView entries={state.transcript} interviewerName="You" candidateName={state.candidate.name} className="p-4" />}
      </div>
      <ConductControls id={id} candidate={state.candidate.name} />
    </>
  );
}

function GuideQuestions({ id, guide, activeId, onChange }: { id: string; guide: Guide; activeId: string | null; onChange: () => void }) {
  const toast = useToast();
  const [open, setOpen] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const main = guide.filter((q) => !q.isFollowUp);
  const activeRoot = guide.find((q) => q.id === activeId)?.parentQuestionId ?? activeId;
  const activeRef = useRef<HTMLLIElement>(null);
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeRoot]);

  async function ask(body: object, key: string) {
    setBusy(key);
    try {
      await api(`/api/interviews/${id}/ask`, { body });
      onChange();
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <ol className="divide-y divide-ink-100">
      {main.map((q, i) => {
        const isActive = q.id === activeRoot;
        const expanded = open === q.id || isActive;
        const followUpsAsked = guide.filter((f) => f.parentQuestionId === q.id);
        return (
          <li key={q.id} ref={isActive ? activeRef : undefined} className={cn("p-4", isActive && "bg-olive-50/70")}>
            <button className="flex w-full items-start gap-3 text-left" onClick={() => setOpen(expanded && !isActive ? null : q.id)} aria-expanded={expanded}>
              <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold", isActive ? "bg-olive-600 text-white" : q.askedAt ? "bg-ink-200 text-ink-600" : "bg-ink-900 text-white")}>{q.askedAt && !isActive ? <CheckCircle2 className="h-3.5 w-3.5" /> : i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-500">Question {i + 1} · {q.category.replace("_", " ")}{isActive ? " · Asking now" : ""}</span>
                <span className={cn("mt-0.5 block text-sm leading-relaxed", q.askedAt && !isActive ? "text-ink-500" : "text-ink-900")}>{q.text}</span>
              </span>
              <ChevronDown className={cn("mt-1 h-4 w-4 shrink-0 text-ink-400 transition", expanded && "rotate-180")} />
            </button>
            {expanded && (
              <div className="ml-9 mt-3 space-y-3 text-sm">
                <div><p className="text-xs font-medium text-ink-500">What this tests</p><p className="text-ink-700">{q.whatItTests}</p></div>
                {q.followUps.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-ink-500">Suggested follow-ups</p>
                    <ul className="mt-1 space-y-1.5">
                      {q.followUps.map((f) => {
                        const asked = followUpsAsked.some((x) => x.text === f);
                        return (
                          <li key={f} className="flex items-start justify-between gap-2">
                            <span className={cn("text-ink-700", asked && "text-ink-400 line-through")}>“{f}”</span>
                            {isActive && !asked && <button onClick={() => ask({ customText: f, parentQuestionId: q.id }, f)} disabled={busy === f} className="shrink-0 text-xs font-semibold text-olive-700 hover:underline disabled:opacity-50">Ask</button>}
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}
                {q.gradingCriteria.length > 0 && (
                  <div><p className="text-xs font-medium text-ink-500">Strong answers include</p><ul className="mt-1 list-disc space-y-0.5 pl-4 text-ink-600">{q.gradingCriteria.map((c) => <li key={c}>{c}</li>)}</ul></div>
                )}
                {!isActive && (
                  <Button size="sm" variant={q.askedAt ? "secondary" : "primary"} onClick={() => ask({ questionId: q.id }, q.id)} loading={busy === q.id}>
                    {q.askedAt ? "Ask again" : "ASK QUESTION"}
                  </Button>
                )}
              </div>
            )}
          </li>
        );
      })}
    </ol>
  );
}

function NotesPanel({ id, activeQuestionId }: { id: string; activeQuestionId: string | null }) {
  const toast = useToast();
  const [notes, setNotes] = useState<{ id: string; text: string; createdAt: string }[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    api<{ notes: { id: string; text: string; createdAt: string }[] }>(`/api/interviews/${id}/notes`).then((r) => setNotes(r.notes)).catch(() => setNotes([]));
  }, [id]);
  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    try {
      const r = await api<{ note: { id: string; text: string; createdAt: string } }>(`/api/interviews/${id}/notes`, { body: { text, questionId: activeQuestionId } });
      setNotes((n) => [...(n ?? []), r.note]);
      setText("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="space-y-4 p-4">
      <p className="flex items-center gap-2 text-xs text-ink-500"><NotebookPen className="h-3.5 w-3.5" /> Only you (and admins) can see these. They inform — but never set — the AI score.</p>
      <Textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="e.g. Strong structure, but no metrics on the result." aria-label="New private note" className="min-h-[72px]" />
      <Button size="sm" onClick={add} loading={busy} disabled={!text.trim()}><MessageSquarePlus className="h-4 w-4" /> Add note</Button>
      {notes === null ? <Spinner className="text-ink-400" /> : notes.length === 0 ? <p className="text-sm text-ink-400">No notes yet.</p> : (
        <ul className="space-y-2">{notes.map((n) => <li key={n.id} className="rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{n.text}<p className="mt-1 text-[11px] text-ink-400">{new Date(n.createdAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}</p></li>)}</ul>
      )}
    </div>
  );
}

function ConductControls({ id, candidate }: { id: string; candidate: string }) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    try {
      await api(`/api/interviews/${id}/warning`, { body: { details } });
      toast.success("Conduct warning sent. This is not a strike.");
      setOpen(false);
      setDetails("");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="border-t border-ink-100 p-3">
      <button onClick={() => setOpen(true)} className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold text-amber-800 hover:bg-amber-50"><ShieldAlert className="h-4 w-4" /> Send conduct warning</button>
      <Modal open={open} onClose={() => setOpen(false)} title={`Send a conduct warning to ${candidate}`} description="A warning gives the candidate a chance to correct their behavior. It is not a strike." size="sm" footer={<><Button variant="secondary" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={send} loading={busy}>Send warning</Button></>}>
        <Textarea label="Message" optional value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Please return your attention to the interview." maxLength={500} />
        <p className="mt-3 text-xs text-ink-500">Don&apos;t warn for nerves, pauses, looking away briefly, accessibility needs or connection problems.</p>
      </Modal>
    </div>
  );
}

function Dark({ children }: { children: React.ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-ink-950 lg:h-screen">{children}</div>;
}

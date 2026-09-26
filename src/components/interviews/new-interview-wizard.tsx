"use client";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Bot, Brain, CalendarClock, FileText, Layers, MessagesSquare, Rocket, Shuffle, Upload, Users, Zap } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { DURATIONS, LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert, EmptyState, Spinner } from "@/components/ui/feedback";
import { ChoiceCard, Input, Label, Textarea } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/components/ui/toast";
import { ResumeUploader, type ResumeSummary } from "@/components/shared/resume-uploader";
import { Stepper } from "@/components/onboarding/stepper";

type Mode = "ai" | "human";
type Type = "behavioral" | "technical" | "full";
type Slot = { id: string; startsAt: string; endsAt: string; interviewerType: string; industry: string | null; fit: number; reasons: string[] };

const STEPS = ["How", "What", "Details", "Settings", "Start"];

export function NewInterviewWizard(props: {
  initialMode: Mode | null;
  initialType: Type | null;
  targetRoles: string[];
  companies: string[];
  resumes: ResumeSummary[];
  aiConfigured: boolean;
  /** Prefill from an internship listing ("Practice for this job"). */
  job?: { id: string; company: string; role: string; title: string; description: string; url: string } | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const [step, setStep] = useState(props.initialMode ? (props.initialType ? 2 : 1) : 0);
  const [mode, setMode] = useState<Mode | null>(props.initialMode);
  const [type, setType] = useState<Type | null>(props.initialType);
  const [targetRole, setTargetRole] = useState(props.job?.role ?? props.targetRoles[0] ?? "");
  const [company, setCompany] = useState(props.job?.company ?? "");
  const [jd, setJd] = useState(props.job?.description ?? "");
  const [jdBusy, setJdBusy] = useState(false);
  const [resumes, setResumes] = useState(props.resumes);
  const [resumeId, setResumeId] = useState<string | null>(props.resumes.find((r) => r.isDefault)?.id ?? props.resumes[0]?.id ?? null);
  const [showUpload, setShowUpload] = useState(false);
  const [difficulty, setDifficulty] = useState("intermediate");
  const [duration, setDuration] = useState(30);
  const [timing, setTiming] = useState<"now" | "schedule">("now");
  const [preference, setPreference] = useState("anyone");
  const [scheduledAt, setScheduledAt] = useState("");
  const [slots, setSlots] = useState<Slot[] | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [submitting, setSubmitting] = useState(false);
  const jdFile = useRef<HTMLInputElement>(null);

  // Load bookable slots when a human interview is being scheduled.
  useEffect(() => {
    if (step !== 4 || mode !== "human" || timing !== "schedule" || !type || !targetRole) return;
    setSlots(null);
    setSlotId(null);
    const ctrl = new AbortController();
    const q = new URLSearchParams({ type, targetRole, difficulty, duration: String(duration), preference });
    api<{ slots: Slot[] }>(`/api/interviews/slots?${q}`, { signal: ctrl.signal })
      .then((r) => setSlots(r.slots))
      .catch((e) => { if ((e as Error).name !== "AbortError") { setSlots([]); toast.error((e as Error).message); } });
    return () => ctrl.abort();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, mode, timing, type, targetRole, difficulty, duration, preference]);

  function validate(s: number) {
    if (s === 0 && !mode) return "Choose how you'd like to practice.";
    if (s === 1 && !type) return "Choose an interview type.";
    if (s === 2 && !targetRole.trim()) return "Enter the role you're targeting.";
    if (s === 4 && timing === "schedule" && mode === "ai" && !scheduledAt) return "Pick a date and time.";
    if (s === 4 && timing === "schedule" && mode === "human" && !slotId) return "Pick an available time slot.";
  }

  async function uploadJd(file: File) {
    setJdBusy(true);
    try {
      const form = new FormData();
      form.append("file", file);
      const r = await api<{ text: string }>("/api/documents/parse", { form });
      setJd(r.text);
      toast.success("Job description imported.");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setJdBusy(false);
      if (jdFile.current) jdFile.current.value = "";
    }
  }

  async function submit() {
    const v = validate(4);
    if (v) return setError(v);
    setSubmitting(true);
    setError(undefined);
    try {
      const res = await api<{ redirect: string }>("/api/interviews", {
        body: {
          mode, type, targetRole, company, jobDescription: jd, resumeId, difficulty, duration, timing,
          interviewerPreference: preference,
          scheduledAt: timing === "schedule" && mode === "ai" && scheduledAt ? new Date(scheduledAt).toISOString() : null,
          availabilityId: timing === "schedule" && mode === "human" ? slotId : null,
        },
      });
      router.push(res.redirect);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  function next() {
    const v = validate(step);
    if (v) return setError(v);
    setError(undefined);
    if (step === STEPS.length - 1) return submit();
    setStep(step + 1);
  }

  const minDate = new Date(Date.now() + 5 * 60_000 - new Date().getTimezoneOffset() * 60_000).toISOString().slice(0, 16);

  return (
    <div>
      {props.job && (
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-olive-200 bg-olive-50/70 px-4 py-3 text-sm">
          <p className="text-ink-700">
            Practicing for <strong className="text-ink-950">{props.job.title}</strong> at <strong className="text-ink-950">{props.job.company}</strong>.{" "}
            {props.job.description ? "The role, company and job description are filled in for you." : (
              <>We couldn&apos;t load its description, so paste it from the <a href={props.job.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">posting</a> in the Details step for the best questions.</>
            )}
          </p>
          <a href={`/jobs/${props.job.id}`} className="text-xs font-medium text-olive-800 underline-offset-2 hover:underline">View listing</a>
        </div>
      )}
      <Stepper steps={STEPS} current={step} />
      <Card className="mt-8 p-6 sm:p-8">
        {step === 0 && (
          <section aria-labelledby="q-how">
            <h2 id="q-how" className="text-2xl font-semibold">How would you like to practice?</h2>
            <div role="radiogroup" aria-labelledby="q-how" className="mt-6 grid gap-4 sm:grid-cols-2">
              <ChoiceCard name="mode" selected={mode === "ai"} onSelect={() => setMode("ai")} icon={<Bot className="h-5 w-5" />} title="AI INTERVIEW" description="Practice with an AI interviewer anytime.">
                <span className="mt-4 flex flex-wrap gap-1.5"><Badge tone="olive">Starts instantly</Badge><Badge>Adaptive follow-ups</Badge></span>
              </ChoiceCard>
              <ChoiceCard name="mode" selected={mode === "human"} onSelect={() => setMode("human")} icon={<Users className="h-5 w-5" />} title="HUMAN INTERVIEW" description="Practice with a real person.">
                <span className="mt-4 flex flex-wrap gap-1.5"><Badge tone="olive">Student or professional</Badge><Badge>Random matching</Badge></span>
              </ChoiceCard>
            </div>
          </section>
        )}

        {step === 1 && (
          <section aria-labelledby="q-what">
            <h2 id="q-what" className="text-2xl font-semibold">What type of interview?</h2>
            <div role="radiogroup" aria-labelledby="q-what" className="mt-6 grid gap-4 md:grid-cols-3">
              <ChoiceCard name="type" selected={type === "behavioral"} onSelect={() => setType("behavioral")} icon={<MessagesSquare className="h-5 w-5" />} title="BEHAVIORAL" description="Leadership, teamwork, conflict, failure and motivation (STAR stories)." />
              <ChoiceCard name="type" selected={type === "technical"} onSelect={() => setType("technical")} icon={<Brain className="h-5 w-5" />} title="TECHNICAL" description="Role-specific questions: finance, product, coding, cases, marketing." />
              <ChoiceCard name="type" selected={type === "full"} onSelect={() => setType("full")} icon={<Layers className="h-5 w-5" />} title="FULL INTERVIEW" description="A realistic end-to-end interview: intro, behavioral, technical, your questions." />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5">
            <h2 className="text-2xl font-semibold">Tailor it to the job</h2>
            <div>
              <Input label="Target role" placeholder="e.g. Investment Banking Analyst" value={targetRole} onChange={(e) => setTargetRole(e.target.value)} maxLength={120} />
              {props.targetRoles.length > 1 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {props.targetRoles.map((r) => <button key={r} type="button" onClick={() => setTargetRole(r)} className={cn("rounded-full border px-2.5 py-0.5 text-xs", r === targetRole ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 text-ink-600 hover:border-ink-400")}>{r}</button>)}
                </div>
              )}
            </div>
            <div>
              <Input label="Company" optional placeholder="e.g. Goldman Sachs" value={company} onChange={(e) => setCompany(e.target.value)} maxLength={120} />
              {props.companies.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {props.companies.map((c) => <button key={c} type="button" onClick={() => setCompany(c)} className="rounded-full border border-ink-200 px-2.5 py-0.5 text-xs text-ink-600 hover:border-ink-400">{c}</button>)}
                </div>
              )}
            </div>
            <div>
              <div className="flex items-end justify-between">
                <Label htmlFor="jd" optional>Job description</Label>
                <button type="button" onClick={() => jdFile.current?.click()} disabled={jdBusy} className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-olive-700 hover:underline disabled:opacity-50">
                  {jdBusy ? <Spinner className="h-3 w-3" /> : <Upload className="h-3.5 w-3.5" />} Upload file
                </button>
                <input ref={jdFile} type="file" className="sr-only" accept=".pdf,.docx,.txt" aria-label="Upload job description file" onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadJd(f); }} />
              </div>
              {props.job && !props.job.description && !jd && (
                <p className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {props.job.company}&apos;s careers site doesn&apos;t let us read this posting automatically.{" "}
                  <a href={props.job.url} target="_blank" rel="noopener noreferrer" className="font-medium underline">Open the posting</a>, copy the description and paste it here so the questions match the job.
                </p>
              )}
              <Textarea id="jd" value={jd} onChange={(e) => setJd(e.target.value)} placeholder="Paste the job description and the AI will tailor questions to the skills it asks for." className="min-h-[140px]" maxLength={20000} />
            </div>
            <div>
              <p className="mb-2 text-sm font-medium text-ink-800">Resume</p>
              {resumes.length > 0 && !showUpload ? (
                <div className="space-y-2" role="radiogroup" aria-label="Resume">
                  {resumes.map((r) => (
                    <button key={r.id} type="button" role="radio" aria-checked={resumeId === r.id} onClick={() => setResumeId(r.id)} className={cn("flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left text-sm", resumeId === r.id ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200 hover:border-ink-400")}>
                      <FileText className="h-4 w-4 text-ink-500" />
                      <span className="flex-1 truncate">{r.fileName}</span>
                      {!r.parsed && <Badge tone="warning">Text not readable</Badge>}
                      {r.isDefault && <Badge tone="olive">Default</Badge>}
                    </button>
                  ))}
                  <button type="button" role="radio" aria-checked={resumeId === null} onClick={() => setResumeId(null)} className={cn("w-full rounded-xl border px-4 py-3 text-left text-sm", resumeId === null ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200 text-ink-600 hover:border-ink-400")}>Don&apos;t use a resume</button>
                  <button type="button" onClick={() => setShowUpload(true)} className="text-xs font-medium text-olive-700 hover:underline">Upload a new resume</button>
                </div>
              ) : (
                <ResumeUploader compact onUploaded={(r) => { setResumes((x) => [{ ...r, isDefault: true }, ...x.map((y) => ({ ...y, isDefault: false }))]); setResumeId(r.id); setShowUpload(false); }} />
              )}
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="space-y-8">
            <h2 className="text-2xl font-semibold">Difficulty and length</h2>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-ink-800">Difficulty</legend>
              <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
                {[["beginner", "Fundamentals and common questions."], ["intermediate", "Realistic first-round difficulty."], ["advanced", "Superday / final-round pressure."]].map(([v, d]) => (
                  <ChoiceCard key={v} name="difficulty" selected={difficulty === v} onSelect={() => setDifficulty(v)} title={LABELS.difficulty[v]} description={d} />
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="mb-3 text-sm font-medium text-ink-800">Duration</legend>
              <div role="radiogroup" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {DURATIONS.map((d) => (
                  <button key={d} type="button" role="radio" aria-checked={duration === d} onClick={() => setDuration(d)} className={cn("rounded-xl border px-4 py-4 text-center transition", duration === d ? "border-ink-900 bg-ink-900 text-white" : "border-ink-200 bg-white hover:border-ink-400")}>
                    <span className="block text-xl font-semibold">{d}</span>
                    <span className={cn("text-xs", duration === d ? "text-ink-300" : "text-ink-500")}>minutes</span>
                  </button>
                ))}
              </div>
            </fieldset>
          </section>
        )}

        {step === 4 && (
          <section className="space-y-6">
            <h2 className="text-2xl font-semibold">{mode === "ai" ? "Start now or schedule" : "Find your interviewer"}</h2>
            {mode === "human" && (
              <fieldset>
                <legend className="mb-3 text-sm font-medium text-ink-800">Who should interview you?</legend>
                <div role="radiogroup" className="grid gap-3 sm:grid-cols-3">
                  <ChoiceCard name="pref" selected={preference === "anyone"} onSelect={() => setPreference("anyone")} icon={<Shuffle className="h-5 w-5" />} title="Anyone" description="We'll find an appropriate available interviewer." />
                  <ChoiceCard name="pref" selected={preference === "student"} onSelect={() => setPreference("student")} title="Another student" description="Peer practice, great for early rounds." />
                  <ChoiceCard name="pref" selected={preference === "professional"} onSelect={() => setPreference("professional")} title="Professional" description="Alumni and industry professionals." />
                </div>
              </fieldset>
            )}
            <div role="radiogroup" className="grid gap-3 sm:grid-cols-2">
              <ChoiceCard name="timing" selected={timing === "now"} onSelect={() => setTiming("now")} icon={mode === "ai" ? <Zap className="h-5 w-5" /> : <Shuffle className="h-5 w-5" />} title={mode === "ai" ? "Start now" : "Match me now"} description={mode === "ai" ? "Your AI interviewer is ready when you are." : "Randomly matched with an available interviewer who fits your role."} />
              <ChoiceCard name="timing" selected={timing === "schedule"} onSelect={() => setTiming("schedule")} icon={<CalendarClock className="h-5 w-5" />} title="Schedule" description={mode === "ai" ? "Pick a time and we'll remind you." : "Book an open slot. Interviewer revealed after booking."} />
            </div>
            {timing === "schedule" && mode === "ai" && (
              <Input label="Date and time" type="datetime-local" min={minDate} value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} hint={`Times are in your time zone (${Intl.DateTimeFormat().resolvedOptions().timeZone}).`} />
            )}
            {timing === "schedule" && mode === "human" && (
              <div>
                <p className="mb-2 text-sm font-medium text-ink-800">Available slots</p>
                {slots === null ? (
                  <div className="flex items-center gap-3 rounded-xl border border-ink-200 p-5 text-sm text-ink-500" role="status"><Spinner /> Finding interviewers that fit your role…</div>
                ) : slots.length === 0 ? (
                  <EmptyState title="No open slots match right now" description="Try “Match me now” to send your request to available interviewers, or change your interviewer preference." />
                ) : (
                  <div className="grid max-h-80 gap-2 overflow-y-auto pr-1 sm:grid-cols-2" role="radiogroup" aria-label="Available slots">
                    {slots.map((s) => (
                      <button key={s.id} type="button" role="radio" aria-checked={slotId === s.id} onClick={() => setSlotId(s.id)} className={cn("rounded-xl border p-3 text-left text-sm", slotId === s.id ? "border-ink-900 ring-1 ring-ink-900" : "border-ink-200 hover:border-ink-400")}>
                        <span className="block font-medium text-ink-900">{new Date(s.startsAt).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}</span>
                        <span className="mt-0.5 block text-xs text-ink-500">{LABELS.interviewerType[s.interviewerType]}{s.industry ? ` · ${s.industry}` : ""}</span>
                        {s.reasons[0] && <span className="mt-1 block text-[11px] text-olive-700">{s.reasons.join(" · ")}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="rounded-xl bg-ink-50 p-4 text-sm text-ink-600">
              <p className="font-medium text-ink-800">Summary</p>
              <p className="mt-1">{LABELS.mode[mode ?? "ai"]} · {LABELS.type[type ?? "behavioral"]} · {targetRole}{company ? ` at ${company}` : ""} · {LABELS.difficulty[difficulty]} · {duration} min</p>
              <p className="mt-2 text-xs text-ink-500">
                {mode === "human" ? "The AI prepares an interview guide for your interviewer. You won't see the questions in advance, just like the real thing." : "Questions are revealed one at a time. Answer by voice or by typing."}
                {!props.aiConfigured && " Note: no AI key is configured on this server, so questions come from the curated question bank and grading uses the transparent development rubric."}
              </p>
            </div>
          </section>
        )}

        {error && <Alert tone="danger" className="mt-6">{error}</Alert>}
        <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
          <Button variant="ghost" onClick={() => { setError(undefined); setStep((s) => s - 1); }} disabled={step === 0 || submitting}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={next} loading={submitting} variant={step === STEPS.length - 1 ? "olive" : "primary"}>
            {step < STEPS.length - 1 ? <>Continue <ArrowRight className="h-4 w-4" /></> : mode === "ai" && timing === "now" ? <>Generate my interview <Rocket className="h-4 w-4" /></> : mode === "human" && timing === "now" ? <>Find my interviewer <Shuffle className="h-4 w-4" /></> : <>Book interview <CalendarClock className="h-4 w-4" /></>}
          </Button>
        </div>
      </Card>
    </div>
  );
}

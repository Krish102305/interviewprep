"use client";
import { useEffect, useRef, useState } from "react";
import { ArrowRight, CheckCircle2, History, Keyboard, Mic, RotateCcw, Send, Target, TrendingDown, TrendingUp, Volume2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { cn } from "@/lib/cn";
import { speak, useSpeechRecognition } from "@/hooks/use-speech";
import type { RetryView } from "@/lib/services/retry";
import { Button, ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScorePill } from "@/components/ui/score";
import { useToast } from "@/components/ui/toast";

type Star = { situation: boolean; task: boolean; action: boolean; result: boolean } | null;

export function QuestionPractice({
  interviewId,
  question,
  original,
  attempts: initialAttempts,
}: {
  interviewId: string;
  question: { id: string; text: string; isFollowUp: boolean };
  original: { answer: string; score: number | null; feedback: string | null; star: Star };
  attempts: RetryView[];
}) {
  const toast = useToast();
  const [attempts, setAttempts] = useState(initialAttempts);
  const [draft, setDraft] = useState("");
  const [usedSpeech, setUsedSpeech] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<RetryView | null>(null);
  const startedAt = useRef(Date.now());
  const stopVoice = useRef<(() => void) | null>(null);
  const speech = useSpeechRecognition((t) => {
    setDraft((d) => (d ? `${d} ${t}` : t));
    setUsedSpeech(true);
  });
  useEffect(() => () => stopVoice.current?.(), []);

  const text = `${draft} ${speech.interim}`.trim();
  const best = attempts.reduce<number | null>((m, a) => (m == null || a.score > m ? a.score : m), null);

  async function submit() {
    if (!text || submitting) return;
    speech.stop();
    setSubmitting(true);
    try {
      const r = await api<RetryView>(`/api/interviews/${interviewId}/questions/${question.id}/retry`, {
        body: { text, source: usedSpeech ? "speech" : "typed", durationSec: Math.round((Date.now() - startedAt.current) / 1000) },
      });
      setResult(r);
      setAttempts((a) => [r, ...a]);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSubmitting(false);
    }
  }

  function tryAgain() {
    setResult(null);
    setDraft("");
    setUsedSpeech(false);
    startedAt.current = Date.now();
  }

  const questionCard = (
    <Card>
      <CardBody>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="eyebrow">{question.isFollowUp ? "Follow-up question" : "Question"}</p>
            <p className="mt-2 text-lg font-medium leading-snug text-ink-950">{question.text}</p>
          </div>
          <Button variant="secondary" size="sm" onClick={() => { stopVoice.current?.(); stopVoice.current = speak(question.text, true); }} aria-label="Read the question aloud">
            <Volume2 className="h-4 w-4" /> <span className="hidden sm:inline">Hear it</span>
          </Button>
        </div>
      </CardBody>
    </Card>
  );

  if (result) {
    const delta = result.originalScore != null ? result.score - result.originalScore : null;
    return (
      <div className="space-y-6">
        {questionCard}
        <Card className="overflow-hidden">
          <div className="flex flex-wrap items-center justify-center gap-6 p-6 sm:gap-10 sm:p-8">
            <ScoreBlock label="Original answer" score={result.originalScore} muted />
            <ArrowRight className="h-6 w-6 text-ink-300" aria-hidden />
            <ScoreBlock label="This attempt" score={result.score} />
            {delta != null && (
              <Badge tone={delta > 0 ? "success" : delta < 0 ? "warning" : "neutral"} icon={delta >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />} className="px-3 py-1 text-sm">
                {delta > 0 ? "+" : ""}{delta} points
              </Badge>
            )}
          </div>
          <p className="border-t border-ink-100 bg-ink-50/60 px-6 py-3 text-center text-sm text-ink-700 sm:px-8">{result.feedback}</p>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-olive-600" /> What got better</span>} />
            <CardBody>
              {result.improved.length ? <Bullets items={result.improved} dot="bg-olive-500" /> : <p className="text-sm text-ink-500">Nothing clearly improved this time. Compare the two answers below.</p>}
            </CardBody>
          </Card>
          <Card>
            <CardHeader title={<span className="flex items-center gap-2"><Target className="h-4 w-4 text-amber-600" /> Work on next</span>} />
            <CardBody>
              {result.nextSteps.length ? <Bullets items={result.nextSteps} dot="bg-amber-500" /> : <p className="text-sm text-ink-500">This answer is in great shape.</p>}
              {result.star && <StarBadges star={result.star} className="mt-4" />}
            </CardBody>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <AnswerCard title="Your original answer" score={result.originalScore} text={original.answer || "No answer was captured."} />
          <AnswerCard title="Your new answer" score={result.score} text={result.answer} highlight />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button onClick={tryAgain}><RotateCcw className="h-4 w-4" /> Try again</Button>
          <ButtonLink href={`/interviews/${interviewId}/results#questions`} variant="secondary">Back to results</ButtonLink>
        </div>
        <AttemptHistory attempts={attempts} best={best} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {questionCard}
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Your new answer" description="Answer out loud or type. Take your time; there's no clock here." />
          <CardBody>
            {speech.error && <p className="mb-2 text-xs text-amber-700">{speech.error}</p>}
            <label htmlFor="retry-answer" className="sr-only">Your new answer</label>
            <textarea
              id="retry-answer"
              value={draft + (speech.interim ? (draft ? " " : "") + speech.interim : "")}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submit(); }}
              placeholder={speech.supported ? "Tap “Answer out loud” and speak, or type here." : "Type your answer…"}
              disabled={submitting}
              className="min-h-[180px] w-full resize-y rounded-xl border border-ink-200 bg-white px-3.5 py-3 text-[15px] leading-relaxed text-ink-900 placeholder:text-ink-400 focus:border-olive-500 focus:outline-none focus:ring-2 focus:ring-olive-200"
            />
            <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                {speech.supported ? (
                  <button type="button" onClick={() => (speech.listening ? speech.stop() : speech.start())} aria-pressed={speech.listening} className={cn("flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition", speech.listening ? "bg-red-600 text-white" : "bg-ink-100 text-ink-900 hover:bg-ink-200")}>
                    {speech.listening ? <><span className="h-2 w-2 animate-pulse rounded-full bg-white" /> Listening (tap to stop)</> : <><Mic className="h-4 w-4" /> Answer out loud</>}
                  </button>
                ) : (
                  <span className="flex items-center gap-2 text-xs text-ink-500"><Keyboard className="h-4 w-4" /> Typing mode</span>
                )}
                <span className="text-xs text-ink-400">{text ? `${text.split(/\s+/).length} words` : ""}</span>
              </div>
              <Button variant="olive" onClick={submit} loading={submitting} disabled={!text}>
                Grade my answer <Send className="h-4 w-4" />
              </Button>
            </div>
          </CardBody>
        </Card>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Last time" action={<ScorePill score={original.score} />} />
            <CardBody className="space-y-3">
              {original.feedback && <p className="text-sm leading-relaxed text-ink-700">{original.feedback}</p>}
              {original.star && <StarBadges star={original.star} />}
              {original.answer && (
                <details className="group">
                  <summary className="cursor-pointer text-sm font-medium text-olive-700 hover:text-olive-900">Show your original answer</summary>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">{original.answer}</p>
                </details>
              )}
            </CardBody>
          </Card>
          <AttemptHistory attempts={attempts} best={best} />
        </div>
      </div>
    </div>
  );
}

function ScoreBlock({ label, score, muted }: { label: string; score: number | null; muted?: boolean }) {
  return (
    <div className="text-center">
      <p className={cn("text-5xl font-semibold tabular-nums tracking-tight", muted ? "text-ink-400" : "text-ink-950")}>{score ?? "N/A"}</p>
      <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">{label}</p>
    </div>
  );
}

function Bullets({ items, dot }: { items: string[]; dot: string }) {
  return (
    <ul className="space-y-3 text-sm leading-relaxed text-ink-700">
      {items.map((s) => <li key={s} className="flex gap-2"><span className={cn("mt-2 h-1.5 w-1.5 shrink-0 rounded-full", dot)} />{s}</li>)}
    </ul>
  );
}

function StarBadges({ star, className }: { star: NonNullable<Star>; className?: string }) {
  return (
    <div className={cn("flex flex-wrap gap-1.5", className)} aria-label="STAR components">
      {(["situation", "task", "action", "result"] as const).map((k) => (
        <Badge key={k} tone={star[k] ? "success" : "warning"}>{star[k] ? "✓" : "✗"} {k[0].toUpperCase() + k.slice(1)}</Badge>
      ))}
    </div>
  );
}

function AnswerCard({ title, score, text, highlight }: { title: string; score: number | null; text: string; highlight?: boolean }) {
  return (
    <Card className={cn(highlight && "border-olive-300")}>
      <CardHeader title={title} action={<ScorePill score={score} />} as="h3" />
      <CardBody><p className="whitespace-pre-wrap text-sm leading-relaxed text-ink-700">{text}</p></CardBody>
    </Card>
  );
}

function AttemptHistory({ attempts, best }: { attempts: RetryView[]; best: number | null }) {
  if (!attempts.length) return null;
  return (
    <Card>
      <CardHeader title={<span className="flex items-center gap-2"><History className="h-4 w-4 text-ink-500" /> Your attempts</span>} action={best != null ? <Badge tone="olive">Best {best}</Badge> : null} as="h3" />
      <CardBody>
        <ol className="divide-y divide-ink-100">
          {attempts.map((a, i) => (
            <li key={a.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
              <span className="text-ink-600">Attempt {attempts.length - i} <span className="text-ink-400">· {new Date(a.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</span></span>
              <ScorePill score={a.score} />
            </li>
          ))}
        </ol>
      </CardBody>
    </Card>
  );
}

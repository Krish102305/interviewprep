import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { conductReasonLabel, LABELS } from "@/lib/constants";
import { formatDateTime, fullName } from "@/lib/format";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { ScorePill } from "@/components/ui/score";
import { TranscriptView } from "@/components/room/transcript-view";
import { aiInterviewerLabel } from "@/lib/ai/personas";
import { GuideList } from "@/components/interviews/guide-list";

export const metadata: Metadata = { title: "Interview · Admin" };

export default async function AdminInterviewDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser({ roles: ["admin"] });
  const { id } = await params;
  const iv = await db.interview.findUnique({
    where: { id },
    include: {
      student: { select: { id: true, profile: true } },
      interviewer: { select: { id: true, profile: true } },
      questions: { where: { isFollowUp: false }, orderBy: { order: "asc" } },
      transcript: { orderBy: { createdAt: "asc" } },
      evaluation: true,
      feedback: true,
      notes: { orderBy: { createdAt: "asc" } },
      conductEvents: { orderBy: { createdAt: "asc" }, include: { user: { select: { profile: true } } } },
      technicalEvents: { orderBy: { createdAt: "asc" }, include: { user: { select: { profile: true } } } },
      conductReports: true,
      rating: true,
    },
  });
  if (!iv) notFound();
  return (
    <div className="space-y-6">
      <Link href="/admin/interviews" className="text-sm text-ink-500 hover:underline">← All interviews</Link>
      <div>
        <p className="eyebrow">{LABELS.mode[iv.mode]} · {LABELS.type[iv.type]} · {LABELS.difficulty[iv.difficulty]} · {iv.duration} min</p>
        <h1 className="mt-2 text-2xl font-semibold">{iv.targetRole}{iv.company ? ` · ${iv.company}` : ""}</h1>
        <p className="mt-1 text-sm text-ink-500">
          Candidate <Link href={`/admin/users/${iv.student.id}`} className="underline">{fullName(iv.student.profile)}</Link>
          {iv.interviewer && <> · Interviewer <Link href={`/admin/users/${iv.interviewer.id}`} className="underline">{fullName(iv.interviewer.profile)}</Link></>}
        </p>
        <div className="mt-3 flex flex-wrap gap-2"><Badge tone={toneForStatus(iv.status)}>{LABELS.status[iv.status]}</Badge><Badge tone={toneForStatus(iv.gradingStatus)}>grading {iv.gradingStatus}</Badge>{iv.questionEngine && <Badge>questions: {iv.questionEngine === "ai" ? "AI" : "question bank"}</Badge>}{iv.evaluation && <Badge>graded by: {iv.evaluation.engine === "ai" ? iv.evaluation.model : "development rubric"}</Badge>}</div>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Conduct & technical events" description="Technical events are never counted as misconduct." />
          <CardBody className="space-y-4 text-sm">
            <div>
              <p className="text-xs font-semibold text-ink-500">Conduct signals</p>
              {iv.conductEvents.length ? <ul className="mt-1 space-y-1">{iv.conductEvents.map((e) => <li key={e.id}>{formatDateTime(e.createdAt)} — <strong>{fullName(e.user.profile)}</strong>: {e.type.replaceAll("_", " ")} ({e.source}){e.details ? ` — ${e.details}` : ""}</li>)}</ul> : <p className="text-ink-400">None</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Technical events</p>
              {iv.technicalEvents.length ? <ul className="mt-1 space-y-1">{iv.technicalEvents.map((e) => <li key={e.id}>{formatDateTime(e.createdAt)} — <strong>{fullName(e.user.profile)}</strong>: {e.type.replaceAll("_", " ")}{e.details ? ` — ${e.details}` : ""}</li>)}</ul> : <p className="text-ink-400">None</p>}
            </div>
            <div>
              <p className="text-xs font-semibold text-ink-500">Reports</p>
              {iv.conductReports.length ? <ul className="mt-1 space-y-1">{iv.conductReports.map((r) => <li key={r.id}>{conductReasonLabel(r.reason)} — <Badge tone={toneForStatus(r.status)}>{r.status}</Badge> <Link href="/admin/reports?status=all" className="text-xs underline">review</Link></li>)}</ul> : <p className="text-ink-400">None</p>}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Evaluation" action={<ScorePill score={iv.overallScore} />} />
          <CardBody className="space-y-3 text-sm">
            {iv.evaluation ? <p className="text-ink-700">{iv.evaluation.summary}</p> : <p className="text-ink-400">{iv.gradingError ?? "Not graded yet."}</p>}
            {iv.feedback && <div className="rounded-lg bg-ink-50 p-3"><p className="text-xs font-semibold text-ink-500">Interviewer feedback</p><p className="mt-1">{iv.feedback.strengths}</p><p className="mt-1">{iv.feedback.improvements}</p></div>}
            {iv.notes.length > 0 && <div><p className="text-xs font-semibold text-ink-500">Interviewer private notes</p><ul className="mt-1 list-disc pl-5">{iv.notes.map((n) => <li key={n.id}>{n.text}</li>)}</ul></div>}
            {iv.rating && <p className="text-xs text-ink-500">Candidate rated interviewer {iv.rating.professionalism}/{iv.rating.realism}/{iv.rating.communication}/{iv.rating.feedbackQuality}</p>}
          </CardBody>
        </Card>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card><CardHeader title="Transcript" /><CardBody><TranscriptView entries={iv.transcript} interviewerName={iv.mode === "ai" ? aiInterviewerLabel(iv.roleCategory) : fullName(iv.interviewer?.profile)} candidateName={fullName(iv.student.profile)} className="max-h-[600px]" /></CardBody></Card>
        <Card><CardHeader title="Question plan" /><CardBody><GuideList questions={iv.questions} /></CardBody></Card>
      </div>
    </div>
  );
}

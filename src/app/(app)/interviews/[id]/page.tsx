import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AlertTriangle, ArrowRight, Bot, CalendarClock, FileText, Shuffle, Sparkles, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { LABELS, roleCategoryLabel } from "@/lib/constants";
import { formatDateTime, fullName, shortName } from "@/lib/format";
import { parseJsonArray } from "@/lib/json";
import { loadForUser } from "@/lib/services/interviews";
import { AppError } from "@/lib/errors";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Alert, Spinner } from "@/components/ui/feedback";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { initials } from "@/lib/format";
import { AutoRefresh } from "@/components/interviews/auto-refresh";
import { CancelInterviewButton, SimplePostButton } from "@/components/interviews/interview-actions";
import { GuideList } from "@/components/interviews/guide-list";

export const metadata: Metadata = { title: "Interview" };

export default async function InterviewPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  let ctx;
  try {
    ctx = await loadForUser(id, user);
  } catch (e) {
    if (e instanceof AppError) notFound();
    throw e;
  }
  const { role } = ctx;
  if (role === "admin") redirect(`/admin/interviews/${id}`);
  const iv = await db.interview.findUniqueOrThrow({
    where: { id },
    include: {
      student: { select: { profile: true, studentProfile: true } },
      interviewer: { select: { profile: true, interviewerProfile: true } },
      jobDescription: true,
      resume: { select: { id: true, fileName: true } },
      questions: role === "interviewer" ? { where: { isFollowUp: false }, orderBy: { order: "asc" } } : false,
      sessions: true,
    },
  });
  const tz = user.profile?.timezone;
  if (role === "candidate" && ["completed", "reported"].includes(iv.status)) redirect(`/interviews/${id}/results`);
  if (role === "interviewer" && ["completed", "reported"].includes(iv.status)) redirect(`/interviews/${id}/wrap-up`);

  const open = ["scheduled", "waiting", "active"].includes(iv.status);
  const pending = open && (iv.questionStatus === "generating" || (iv.mode === "human" && !iv.interviewerId));
  const canJoin = open && iv.questionStatus === "ready" && (iv.mode === "ai" || Boolean(iv.interviewerId));
  const lateEnough = iv.scheduledAt ? Date.now() - iv.scheduledAt.getTime() > 10 * 60_000 : false;
  const otherReady = iv.sessions.some((s) => s.userId !== user.id && s.ready);
  const noShows = parseJsonArray(iv.noShowUserIds);

  return (
    <div className="mx-auto max-w-5xl">
      {pending && <AutoRefresh every={4000} />}
      <PageHeader
        eyebrow={`${LABELS.mode[iv.mode]} · ${LABELS.type[iv.type]}`}
        title={iv.targetRole}
        description={[iv.company, `${iv.duration} minutes`, LABELS.difficulty[iv.difficulty]].filter(Boolean).join(" · ")}
        action={
          <>
            <Badge tone={toneForStatus(iv.status)} className="text-xs">{LABELS.status[iv.status]}</Badge>
          </>
        }
      />

      {iv.status === "cancelled" && <Alert tone="info" title="This interview was cancelled">{iv.cancelReason}</Alert>}
      {iv.status === "no_show" && (
        <Alert tone="warning" title="No-show recorded">
          {noShows.includes(user.id)
            ? "You didn't join this scheduled interview. No-shows are tracked separately from conduct strikes; repeated no-shows may be reviewed by our team."
            : "The other participant didn't join. This isn't counted against you."}
        </Alert>
      )}

      {open && (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-6">
            {role === "candidate" && iv.mode === "human" && !iv.interviewerId && (
              <Card>
                <CardBody className="flex flex-col items-center py-12 text-center">
                  <span className="relative flex h-16 w-16 items-center justify-center">
                    <span className="absolute inset-0 animate-pulse-ring rounded-full bg-olive-300" />
                    <span className="relative flex h-16 w-16 items-center justify-center rounded-full bg-olive-600 text-white"><Shuffle className="h-7 w-7" /></span>
                  </span>
                  <h2 className="mt-6 text-xl font-semibold">Finding your interviewer…</h2>
                  <p className="mt-2 max-w-md text-sm text-ink-500">
                    We&apos;re randomly matching you with a {LABELS.preference[iv.interviewerPreference].toLowerCase() === "anyone" ? "well-suited" : LABELS.preference[iv.interviewerPreference].toLowerCase()} interviewer for {roleCategoryLabel(iv.roleCategory)}. You&apos;ll get a notification the moment someone accepts — feel free to leave this page.
                  </p>
                  <p className="mt-4 text-xs text-ink-400">{iv.matchStatus === "pending" ? "Request sent to an interviewer" : "Waiting for an available interviewer"}</p>
                </CardBody>
              </Card>
            )}

            {iv.questionStatus === "generating" && (
              <Alert tone="info" title="Generating your customized interview…">
                <span className="flex items-center gap-2"><Spinner className="h-4 w-4" /> The AI is tailoring questions to the role{iv.resumeId ? ", your resume" : ""}{iv.jobDescriptionId ? " and the job description" : ""}.</span>
              </Alert>
            )}
            {iv.questionStatus === "failed" && (
              <Alert tone="danger" title="We couldn't generate the interview" action={<SimplePostButton url={`/api/interviews/${iv.id}/regenerate`} label="Try again" success="Regenerating…" />}>
                Nothing was lost. Try generating the questions again.
              </Alert>
            )}

            {(iv.mode === "ai" || iv.interviewerId) && (
              <Card>
                <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-white"><CalendarClock className="h-5 w-5" /></span>
                    <div>
                      <p className="text-sm text-ink-500">{iv.status === "active" ? "In progress" : "Scheduled for"}</p>
                      <p className="font-semibold text-ink-900">{iv.status === "active" ? "Rejoin the interview" : iv.scheduledAt ? formatDateTime(iv.scheduledAt, tz) : "Any time"}</p>
                      {iv.mode === "human" && <p className="mt-0.5 text-xs text-ink-500">{otherReady ? "The other participant is in the waiting room." : "Both participants must complete the device check before the interview begins."}</p>}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {canJoin ? (
                      <ButtonLink href={iv.mode === "ai" ? `/interviews/${iv.id}/room` : `/interviews/${iv.id}/lobby`} variant="olive">
                        {iv.status === "active" ? "Rejoin" : iv.mode === "ai" ? "Enter interview" : "Go to waiting room"} <ArrowRight className="h-4 w-4" />
                      </ButtonLink>
                    ) : null}
                    {iv.status !== "active" && <CancelInterviewButton id={iv.id} asInterviewer={role === "interviewer"} />}
                  </div>
                </CardBody>
                {iv.mode === "human" && iv.status !== "active" && lateEnough && !otherReady && (
                  <div className="border-t border-ink-100 px-6 py-4">
                    <Alert tone="warning" title="The other participant hasn't joined" action={<SimplePostButton url={`/api/interviews/${iv.id}/no-show`} label="Record no-show" success="No-show recorded." confirm={{ title: "Record a no-show?", description: "This closes the interview. No-shows are tracked separately and never create an automatic conduct strike." }} />}>
                      It&apos;s been more than 10 minutes since the scheduled start.
                    </Alert>
                  </div>
                )}
              </Card>
            )}

            {role === "interviewer" && (
              <Card>
                <CardHeader title="AI-generated interview guide" description="Only you can see this. The candidate sees each question only when you ask it." action={iv.questionEngine === "fallback" ? <Badge tone="warning">Question bank</Badge> : iv.questionEngine === "ai" ? <Badge tone="olive" icon={<Sparkles className="h-3 w-3" />}>AI-generated</Badge> : null} />
                <CardBody>
                  {iv.questionStatus === "ready" && Array.isArray(iv.questions) ? <GuideList questions={iv.questions} /> : <p className="text-sm text-ink-500">The guide will appear here once it&apos;s generated.</p>}
                </CardBody>
              </Card>
            )}

            {role === "candidate" && (
              <Card>
                <CardHeader title="What to expect" />
                <CardBody>
                  <ul className="space-y-3 text-sm text-ink-600">
                    <li className="flex gap-3"><Bot className="h-4 w-4 shrink-0 text-olive-700" />{iv.mode === "ai" ? "Your AI interviewer introduces itself and asks one question at a time, with follow-ups based on your answers." : "Your interviewer has an AI-prepared guide. You'll see each question only when it's asked."}</li>
                    <li className="flex gap-3"><Users className="h-4 w-4 shrink-0 text-olive-700" />Treat it like the real thing: quiet space, camera on if you can, answer out loud.</li>
                    <li className="flex gap-3"><Sparkles className="h-4 w-4 shrink-0 text-olive-700" />Your transcript is graded by AI on a standardized 0–100 rubric right after.</li>
                    <li className="flex gap-3"><AlertTriangle className="h-4 w-4 shrink-0 text-olive-700" />Technical problems are never counted as misconduct — you can always reconnect.</li>
                  </ul>
                </CardBody>
              </Card>
            )}
          </div>

          <div className="space-y-6">
            {role === "candidate" && iv.mode === "human" && iv.interviewer && (
              <Card>
                <CardHeader title="Your interviewer" />
                <CardBody className="flex items-start gap-4">
                  <Avatar name={fullName(iv.interviewer.profile)} initials={initials(iv.interviewer.profile)} size="lg" />
                  <div>
                    <p className="font-semibold text-ink-900">{shortName(iv.interviewer.profile)}</p>
                    <p className="text-sm text-ink-600">{iv.interviewer.interviewerProfile?.title}</p>
                    <p className="mt-1 text-xs text-ink-500">{LABELS.interviewerType[iv.interviewer.interviewerProfile?.interviewerType ?? "professional"]} · {iv.interviewer.interviewerProfile?.industry}</p>
                    {iv.interviewer.profile?.bio && <p className="mt-3 text-sm text-ink-600">{iv.interviewer.profile.bio}</p>}
                  </div>
                </CardBody>
              </Card>
            )}
            {role === "interviewer" && (
              <Card>
                <CardHeader title="Candidate" />
                <CardBody className="space-y-4 text-sm">
                  <div className="flex items-center gap-3">
                    <Avatar name={fullName(iv.student.profile)} initials={initials(iv.student.profile)} />
                    <div>
                      <p className="font-semibold text-ink-900">{shortName(iv.student.profile)}</p>
                      <p className="text-xs text-ink-500">{[iv.student.studentProfile?.school, iv.student.studentProfile?.major].filter(Boolean).join(" · ")}</p>
                    </div>
                  </div>
                  <dl className="grid grid-cols-2 gap-3">
                    <div><dt className="text-xs text-ink-500">Target role</dt><dd className="font-medium">{iv.targetRole}</dd></div>
                    <div><dt className="text-xs text-ink-500">Company</dt><dd className="font-medium">{iv.company ?? "—"}</dd></div>
                    <div><dt className="text-xs text-ink-500">Type</dt><dd className="font-medium">{LABELS.type[iv.type]}</dd></div>
                    <div><dt className="text-xs text-ink-500">Difficulty</dt><dd className="font-medium">{LABELS.difficulty[iv.difficulty]}</dd></div>
                  </dl>
                  {iv.resume && (
                    <a href={`/api/resumes/${iv.resume.id}`} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-lg border border-ink-200 px-3 py-2 hover:bg-ink-50">
                      <FileText className="h-4 w-4 text-ink-500" /> <span className="truncate">View resume</span>
                    </a>
                  )}
                </CardBody>
              </Card>
            )}
            {iv.jobDescription && (
              <Card>
                <CardHeader title="Job description" />
                <CardBody>
                  <p className="max-h-72 overflow-y-auto whitespace-pre-line text-sm leading-relaxed text-ink-600">{iv.jobDescription.content}</p>
                </CardBody>
              </Card>
            )}
            <p className="text-center text-xs text-ink-400">
              <Link href={role === "interviewer" ? "/interviewer" : "/dashboard"} className="hover:underline">Back to dashboard</Link>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

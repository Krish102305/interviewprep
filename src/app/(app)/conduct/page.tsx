import type { Metadata } from "next";
import { ShieldCheck, ShieldX } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { conductReasonLabel, MAX_STRIKES } from "@/lib/constants";
import { formatDate } from "@/lib/format";
import { activeStrikeCount, standing } from "@/lib/services/conduct";
import { Card, CardBody, CardHeader, PageHeader } from "@/components/ui/card";
import { Alert, EmptyState } from "@/components/ui/feedback";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { StandingCard } from "@/components/conduct/standing-card";
import { AppealButton } from "@/components/conduct/appeal-form";

export const metadata: Metadata = { title: "Conduct" };

export default async function ConductPage() {
  const user = await requirePageUser({ allowRestricted: true, roles: ["student", "interviewer"] });
  const [strikes, appeals, count, noShows] = await Promise.all([
    db.strike.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" }, include: { interview: { select: { targetRole: true, completedAt: true } }, appeals: { orderBy: { submittedAt: "desc" } } } }),
    db.appeal.findMany({ where: { userId: user.id }, orderBy: { submittedAt: "desc" }, include: { strike: { select: { strikeNumber: true } } } }),
    activeStrikeCount(user.id),
    db.interview.count({ where: { noShowUserIds: { contains: user.id } } }),
  ]);
  const s = standing(count, user.accountStatus);
  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader eyebrow="Interview conduct" title="Conduct & appeals" description="Interview Connect uses a fair three-strike system. Warnings come first, and a strike is only issued after a human reviews the evidence." />

      {user.accountStatus === "banned" && (
        <Alert tone="danger" title="Your Interview Connect account has been suspended after 3 confirmed conduct violations.">
          You can&apos;t join, schedule or conduct interviews while suspended. Review your strike history below and submit an appeal if you believe a strike was incorrect.
        </Alert>
      )}
      {user.accountStatus === "suspended" && <Alert tone="warning" title="Your account is temporarily suspended">An administrator suspended your account. Interview features are disabled until it&apos;s restored.</Alert>}
      {user.accountStatus === "active" && count === 2 && <Alert tone="danger" title="Final Warning">You currently have 2 / 3 confirmed strikes. One additional confirmed conduct violation will result in an account ban from Interview Connect interviews.</Alert>}
      {user.accountStatus === "active" && count === 1 && <Alert tone="warning" title="Interview Conduct Warning">You have received your first confirmed conduct strike. Future confirmed violations can result in additional strikes.</Alert>}

      <div className="grid gap-4 sm:grid-cols-3">
        <StandingCard strikes={count} accountStatus={user.accountStatus} className="sm:col-span-1" />
        <Card className="p-5 sm:col-span-2">
          <p className="text-xs font-medium uppercase tracking-wide text-ink-500">What this means</p>
          <p className="mt-3 font-semibold">{s.label}</p>
          <p className="mt-1 text-sm text-ink-600">{s.description}</p>
          <p className="mt-3 text-xs text-ink-500">Recorded no-shows: {noShows}. No-shows are tracked separately and are never automatic strikes.</p>
        </Card>
      </div>

      <Card>
        <CardHeader title="Strike history" description={`${count} / ${MAX_STRIKES} active`} />
        <CardBody>
          {strikes.length === 0 ? (
            <EmptyState icon={<ShieldCheck className="h-5 w-5" />} title="No strikes" description="You're in good standing. Keep it up!" />
          ) : (
            <ol className="space-y-3">
              {strikes.map((st) => {
                const pendingAppeal = st.appeals.find((a) => a.status === "pending");
                return (
                  <li key={st.id} className="rounded-xl border border-ink-200 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="flex items-center gap-2 font-semibold text-ink-900"><ShieldX className="h-4 w-4 text-red-600" /> Strike {st.strikeNumber} · {conductReasonLabel(st.reason)}</p>
                        <p className="mt-0.5 text-xs text-ink-500">{formatDate(st.createdAt)}{st.interview ? ` · ${st.interview.targetRole} interview` : ""} · Reviewed by Interview Connect staff</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge tone={st.status === "active" ? "danger" : "success"}>{st.status === "active" ? "Active" : st.status === "overturned" ? "Overturned" : "Removed"}</Badge>
                        {pendingAppeal ? <Badge tone="info">Appeal pending</Badge> : st.status === "active" ? <AppealButton strikeId={st.id} strikeNumber={st.strikeNumber} /> : null}
                      </div>
                    </div>
                    <p className="mt-3 text-sm text-ink-700">{st.description}</p>
                  </li>
                );
              })}
            </ol>
          )}
        </CardBody>
      </Card>

      {appeals.length > 0 && (
        <Card>
          <CardHeader title="Your appeals" />
          <CardBody>
            <ul className="divide-y divide-ink-100">
              {appeals.map((a) => (
                <li key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-medium">Strike {a.strike.strikeNumber}: {a.reason}</p>
                    <Badge tone={toneForStatus(a.status)}>{a.status[0].toUpperCase() + a.status.slice(1)}</Badge>
                  </div>
                  <p className="mt-1 text-xs text-ink-500">Submitted {formatDate(a.submittedAt)}{a.reviewNote ? ` · Reviewer note: ${a.reviewNote}` : ""}</p>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader title="Conduct standards" />
        <CardBody className="grid gap-6 text-sm sm:grid-cols-2">
          <div>
            <p className="font-medium text-ink-900">What can lead to a strike</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-600">
              <li>Leaving an interview without a legitimate reason</li>
              <li>Repeatedly refusing to participate</li>
              <li>Extended unexplained inactivity</li>
              <li>Using the interview for unrelated activities</li>
              <li>Intentionally disrupting an interview</li>
              <li>Harassing or insulting another participant</li>
              <li>Repeatedly ignoring interviewer instructions</li>
              <li>Platform abuse or manipulating feedback/scoring</li>
            </ul>
          </div>
          <div>
            <p className="font-medium text-ink-900">What is never misconduct</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-600">
              <li>Looking away briefly, moving naturally, or eye contact</li>
              <li>Taking time to think before answering</li>
              <li>Being nervous</li>
              <li>Disability or accessibility needs</li>
              <li>Poor internet, camera or microphone problems</li>
            </ul>
            <p className="mt-4 text-xs text-ink-500">AI can flag a potential issue, but it can never issue a strike or ban on its own. Every strike follows human review, and every strike can be appealed.</p>
          </div>
        </CardBody>
      </Card>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CalendarClock, Flame, Gauge, Layers, Sparkles, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { greeting, formatDateTime } from "@/lib/format";
import { LABELS } from "@/lib/constants";
import { activeStrikeCount } from "@/lib/services/conduct";
import { levelFor, totalPoints } from "@/lib/services/gamification";
import { getPerformance, parseRecommendation, recommendNext } from "@/lib/services/performance";
import { sweepStaleInterviews } from "@/lib/services/interviews";
import { ensureReminders } from "@/lib/services/notifications";
import { expireStaleMatches } from "@/lib/services/matching";
import { interviewRows } from "@/lib/services/queries";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { StandingCard } from "@/components/conduct/standing-card";
import { InterviewList } from "@/components/interviews/interview-list";
import { PerformanceChart } from "@/components/charts/performance-chart";

export const metadata: Metadata = { title: "Dashboard" };

export default async function StudentDashboard() {
  const user = await requirePageUser({ roles: ["student"] });
  await Promise.all([sweepStaleInterviews(), expireStaleMatches(), ensureReminders(user.id)]);
  const tz = user.profile?.timezone;

  const [perf, points, strikes, next, recent, sp, badges, latestEval] = await Promise.all([
    getPerformance(user.id),
    totalPoints(user.id),
    activeStrikeCount(user.id),
    db.interview.findFirst({
      where: { studentId: user.id, status: { in: ["scheduled", "waiting", "active"] } },
      orderBy: [{ status: "asc" }, { scheduledAt: "asc" }],
      include: { interviewer: { select: { profile: true } } },
    }),
    interviewRows({ studentId: user.id, status: { in: ["completed", "reported", "no_show"] } }, 6),
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.userBadge.findMany({ where: { userId: user.id }, include: { badge: true }, orderBy: { awardedAt: "desc" }, take: 4 }),
    db.aiEvaluation.findFirst({ where: { interview: { studentId: user.id } }, orderBy: { createdAt: "desc" }, select: { recommendation: true } }),
  ]);
  const level = levelFor(points);
  const rec = parseRecommendation(latestEval?.recommendation) ?? (await recommendNext(user.id));
  const completed = await db.interview.count({ where: { studentId: user.id, status: "completed" } });

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-6 rounded-3xl bg-ink-950 p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-ink-300">{greeting(new Date(), tz)}, {user.profile?.firstName}</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Ready for your next interview?</h1>
          <p className="mt-2 max-w-lg text-sm text-ink-300">Choose an AI or human interviewer, pick behavioral, technical or a full interview, and get a standardized AI evaluation.</p>
        </div>
        <ButtonLink href="/interviews/new" variant="olive" size="lg" className="self-start lg:self-center">
          START AN INTERVIEW <ArrowRight className="h-4 w-4" />
        </ButtonLink>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Card className="p-5 sm:col-span-2 xl:col-span-1">
          <div className="flex items-center justify-between">
            <p className="text-xs font-medium uppercase tracking-wide text-ink-500">Next Interview</p>
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-olive-50 text-olive-700"><CalendarClock className="h-4 w-4" /></span>
          </div>
          {next ? (
            <Link href={next.mode === "ai" && next.status !== "scheduled" ? `/interviews/${next.id}/room` : `/interviews/${next.id}`} className="mt-3 block">
              <p className="truncate font-semibold text-ink-900 hover:underline">{next.targetRole}</p>
              <p className="mt-1 text-xs text-ink-500">{LABELS.mode[next.mode]} · {LABELS.type[next.type]}</p>
              <p className="mt-1 text-xs text-ink-500">{next.status === "active" ? "In progress" : next.scheduledAt ? formatDateTime(next.scheduledAt, tz) : "Matching…"}</p>
            </Link>
          ) : (
            <div className="mt-3">
              <p className="text-sm text-ink-500">No upcoming interviews.</p>
              <Link href="/interviews/new" className="mt-1 inline-block text-xs font-medium text-olive-700 hover:underline">Find an Interview</Link>
            </div>
          )}
        </Card>
        <StatCard label="Interview Score" value={perf.summary.latest ?? "N/A"} sub={perf.summary.average != null ? `Average ${perf.summary.average} · Best ${perf.summary.highest}` : "Complete an interview to get scored"} icon={<Gauge className="h-4 w-4" />} tone="olive" />
        <StatCard label="Total Interviews" value={completed} sub={`${perf.summary.aiCount} AI · ${perf.summary.humanCount} human graded`} icon={<Layers className="h-4 w-4" />} />
        <StatCard
          label="Points"
          value={points.toLocaleString()}
          sub={
            <span className="block">
              Level {level.level} · {level.title}
              <span className="mt-1.5 block h-1.5 overflow-hidden rounded-full bg-ink-100" role="progressbar" aria-label="Progress to next level" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}>
                <span className="block h-full rounded-full bg-olive-600" style={{ width: `${level.progress}%` }} />
              </span>
            </span>
          }
          icon={<Trophy className="h-4 w-4" />}
          tone="olive"
        />
        <StandingCard strikes={strikes} accountStatus={user.accountStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader title="Performance" description="Scores from your graded interviews over time" action={<Link href="/performance" className="text-xs font-medium text-olive-700 hover:underline">Full analytics</Link>} />
          <CardBody>
            {perf.timeline.length >= 1 ? (
              <PerformanceChart data={perf.timeline} defaultSeries={["overall", "behavioral", "technical"]} />
            ) : (
              <EmptyState icon={<Gauge className="h-5 w-5" />} title="No scores yet" description="Your performance chart appears after your first graded interview." action={<ButtonLink href="/interviews/new" size="sm">Start an interview</ButtonLink>} />
            )}
          </CardBody>
        </Card>
        <div className="space-y-6">
          <Card className="border-olive-200 bg-olive-50/60">
            <CardBody>
              <p className="eyebrow flex items-center gap-1.5"><Sparkles className="h-3.5 w-3.5" /> Recommended next practice</p>
              <p className="mt-3 font-semibold text-ink-900">{rec.title}</p>
              <p className="mt-1.5 text-sm leading-relaxed text-ink-600">{rec.detail}</p>
              <ButtonLink href={`/interviews/new?mode=${rec.mode}&type=${rec.type}`} size="sm" className="mt-4">
                Start {rec.mode === "ai" ? "AI" : "human"} {LABELS.type[rec.type].toLowerCase()} <ArrowRight className="h-3.5 w-3.5" />
              </ButtonLink>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Momentum" action={<Link href="/profile" className="text-xs font-medium text-olive-700 hover:underline">All badges</Link>} />
            <CardBody className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive-600 text-white"><Flame className="h-5 w-5" /></span>
                <div>
                  <p className="font-semibold text-ink-900">{sp?.currentStreak ?? 0}-day streak</p>
                  <p className="text-xs text-ink-500">Longest: {sp?.longestStreak ?? 0} days</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {badges.length ? badges.map((b) => <Badge key={b.id} tone="olive">{b.badge.name}</Badge>) : <p className="text-sm text-ink-500">Complete your first interview to earn a badge.</p>}
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader title="Recent interviews" action={<Link href="/interviews" className="text-xs font-medium text-olive-700 hover:underline">View all</Link>} />
        <div className="mt-4 border-t border-ink-100">
          {recent.length ? (
            <InterviewList rows={recent} timeZone={tz} />
          ) : (
            <div className="p-6"><EmptyState title="No completed interviews yet" description="Your history, with scores and feedback, will show up here." /></div>
          )}
        </div>
      </Card>
    </div>
  );
}

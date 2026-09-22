import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/card";
import { ScoreBar } from "@/components/ui/score";
import { DailyBars } from "@/components/charts/daily-bars";

export const metadata: Metadata = { title: "Analytics · Admin" };

const EVENTS = [
  ["signup", "Signups"], ["profile_completed", "Profiles completed"], ["resume_uploaded", "Resumes uploaded"], ["interview_created", "Interviews created"],
  ["interview_booked", "Human interviews booked"], ["interview_completed", "Interviews completed"], ["feedback_submitted", "Interviewer feedback"], ["interviewer_accepted", "Interviewer acceptances"],
  ["points_earned", "Point awards"], ["badge_earned", "Badges earned"], ["conduct_report", "Conduct reports"], ["strike_issued", "Strikes issued"], ["appeal_submitted", "Appeals"], ["interview_no_show", "No-shows"],
] as const;

export default async function AdminAnalytics() {
  await requirePageUser({ roles: ["admin"] });
  const since = new Date(Date.now() - 30 * 86400_000);
  const [counts, completedEvents, byMode, byType, students, returning, active7] = await Promise.all([
    db.analyticsEvent.groupBy({ by: ["name"], where: { createdAt: { gte: since } }, _count: true }),
    db.analyticsEvent.findMany({ where: { name: "interview_completed", createdAt: { gte: since } }, select: { createdAt: true } }),
    db.interview.groupBy({ by: ["mode"], where: { status: "completed" }, _count: true, _avg: { overallScore: true } }),
    db.interview.groupBy({ by: ["type"], where: { status: "completed" }, _count: true, _avg: { overallScore: true } }),
    db.user.count({ where: { role: "student" } }),
    db.interview.groupBy({ by: ["studentId"], where: { status: "completed" }, _count: true }),
    db.user.count({ where: { role: "student", lastActiveAt: { gte: new Date(Date.now() - 7 * 86400_000) } } }),
  ]);
  const c = (n: string) => counts.find((x) => x.name === n)?._count ?? 0;
  const days = Array.from({ length: 30 }).map((_, i) => {
    const d = new Date(Date.now() - (29 - i) * 86400_000);
    const key = d.toISOString().slice(0, 10);
    return { day: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), count: completedEvents.filter((e) => e.createdAt.toISOString().slice(0, 10) === key).length };
  });
  const retained = returning.filter((r) => r._count >= 2).length;
  const funnel = [["Signups", c("signup")], ["Profiles completed", c("profile_completed")], ["Interviews created", c("interview_created")], ["Interviews completed", c("interview_completed")]] as const;
  const top = Math.max(1, ...funnel.map(([, v]) => v));
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Admin" title="Analytics" description="Last 30 days. Only event names and ids are stored — no free-text personal data." />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Signups (30d)" value={c("signup")} />
        <StatCard label="Interviews completed (30d)" value={c("interview_completed")} />
        <StatCard label="Weekly active students" value={active7} sub={`of ${students} students`} />
        <StatCard label="Retention" value={`${students ? Math.round((retained / students) * 100) : 0}%`} sub="students with 2+ completed interviews" />
      </div>
      <Card>
        <CardHeader title="Interviews completed per day" />
        <CardBody><DailyBars data={days} label="Interviews completed" /></CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="Activation funnel" />
          <CardBody className="space-y-3">
            {funnel.map(([label, v]) => (
              <div key={label}>
                <div className="flex justify-between text-sm"><span className="text-ink-700">{label}</span><span className="font-semibold tabular-nums">{v}</span></div>
                <div className="mt-1 h-2 rounded-full bg-ink-100"><div className="h-full rounded-full bg-olive-600" style={{ width: `${(v / top) * 100}%` }} /></div>
              </div>
            ))}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Completed interviews by mode" description="Count · average score" />
          <CardBody className="space-y-4">
            {byMode.map((m) => <ScoreBar key={m.mode} label={`${m.mode === "ai" ? "AI" : "Human"} (${m._count})`} score={m._avg.overallScore != null ? Math.round(m._avg.overallScore) : null} />)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By type" description="Count · average score" />
          <CardBody className="space-y-4">
            {byType.map((t) => <ScoreBar key={t.type} label={`${t.type[0].toUpperCase()}${t.type.slice(1)} (${t._count})`} score={t._avg.overallScore != null ? Math.round(t._avg.overallScore) : null} />)}
          </CardBody>
        </Card>
      </div>
      <Card>
        <CardHeader title="Event counts (30 days)" />
        <CardBody>
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-7">
            {EVENTS.map(([k, label]) => <div key={k}><dt className="text-xs text-ink-500">{label}</dt><dd className="text-xl font-semibold tabular-nums">{c(k)}</dd></div>)}
          </dl>
        </CardBody>
      </Card>
    </div>
  );
}

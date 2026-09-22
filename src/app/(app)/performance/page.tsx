import type { Metadata } from "next";
import { BarChart3 } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { getPerformance, recommendNext } from "@/lib/services/performance";
import { LABELS } from "@/lib/constants";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { ScoreBar } from "@/components/ui/score";
import { PerformanceChart } from "@/components/charts/performance-chart";

export const metadata: Metadata = { title: "Performance" };

export default async function PerformancePage() {
  const user = await requirePageUser({ roles: ["student"] });
  const perf = await getPerformance(user.id);
  const rec = await recommendNext(user.id);
  const s = perf.summary;
  if (!s.count)
    return (
      <div>
        <PageHeader eyebrow="Performance analytics" title="Track your progress" />
        <EmptyState icon={<BarChart3 className="h-5 w-5" />} title="No graded interviews yet" description="Complete an interview to unlock score trends, AI vs. human comparisons and category breakdowns." action={<ButtonLink href="/interviews/new">Start an interview</ButtonLink>} />
      </div>
    );
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Performance analytics" title="Your progress" description="Built only from your completed, AI-graded interviews." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4 xl:grid-cols-7">
        <StatCard label="First Interview" value={s.first ?? "—"} />
        <StatCard label="Latest Interview" value={s.latest ?? "—"} sub={s.first != null && s.latest != null ? `${s.latest - s.first >= 0 ? "+" : ""}${s.latest - s.first} since first` : undefined} />
        <StatCard label="Highest Score" value={s.highest ?? "—"} />
        <StatCard label="Average Score" value={s.average ?? "—"} />
        <StatCard label="Completed" value={s.count} />
        <StatCard label="AI Interviews" value={s.aiCount} />
        <StatCard label="Human Interviews" value={s.humanCount} />
      </div>
      <Card>
        <CardHeader title="Scores over time" description="Toggle metrics to compare. Use table view for exact values." />
        <CardBody><PerformanceChart data={perf.timeline} defaultSeries={["overall", "communication", "confidence", "problemSolving"]} height={340} maxSeries={7} /></CardBody>
      </Card>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader title="AI vs. Human interviews" description="Average overall score" />
          <CardBody className="space-y-4">
            <ScoreBar label={`AI interviews (${s.aiCount})`} score={perf.byMode.ai} />
            <ScoreBar label={`Human interviews (${s.humanCount})`} score={perf.byMode.human} />
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="By interview type" description="Average overall score" />
          <CardBody className="space-y-4">
            {(["behavioral", "technical", "full"] as const).map((t) => <ScoreBar key={t} label={LABELS.type[t]} score={perf.byType[t]} />)}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Category averages" />
          <CardBody className="space-y-3">
            {perf.categoryAverages.filter((c) => c.value != null).map((c) => <ScoreBar key={c.key} label={c.label} score={c.value} />)}
          </CardBody>
        </Card>
      </div>
      <Card className="border-olive-200 bg-olive-50/60">
        <CardBody className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="eyebrow">Recommended next practice</p>
            <p className="mt-2 font-semibold">{rec.title}</p>
            <p className="mt-1 text-sm text-ink-600">{rec.detail}</p>
          </div>
          <ButtonLink href={`/interviews/new?mode=${rec.mode}&type=${rec.type}`} className="shrink-0">Practice now</ButtonLink>
        </CardBody>
      </Card>
    </div>
  );
}

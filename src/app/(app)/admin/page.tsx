import { syncState } from "@/lib/jobs/sync";
import { relativeTime } from "@/lib/format";
import { isTtsConfigured } from "@/lib/voice/tts";
import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Ban, CalendarDays, CheckCircle2, Flag, GraduationCap, Scale, UserCheck, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { isAiConfigured } from "@/lib/ai/client";
import { isEmailConfigured } from "@/lib/email";
import { isGoogleConfigured } from "@/lib/auth/google";
import { formatDateTime } from "@/lib/format";
import { Card, CardBody, CardHeader, PageHeader, StatCard } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sweepStaleInterviews } from "@/lib/services/interviews";

export const metadata: Metadata = { title: "Admin" };

export default async function AdminHome() {
  await requirePageUser({ roles: ["admin"] });
  await sweepStaleInterviews();
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay.getTime() + 86400_000);
  const [totalUsers, students, interviewers, today, completed, pendingReports, banned, pendingAppeals, actions] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { role: "student", accountStatus: "active" } }),
    db.user.count({ where: { role: "interviewer", accountStatus: "active" } }),
    db.interview.count({ where: { OR: [{ scheduledAt: { gte: startOfDay, lt: endOfDay } }, { createdAt: { gte: startOfDay, lt: endOfDay } }] } }),
    db.interview.count({ where: { status: "completed" } }),
    db.conductReport.count({ where: { status: "pending" } }),
    db.user.count({ where: { accountStatus: "banned" } }),
    db.appeal.count({ where: { status: "pending" } }),
    db.adminAction.findMany({ orderBy: { createdAt: "desc" }, take: 10, include: { admin: { select: { profile: true } }, targetUser: { select: { email: true } } } }),
  ]);
  const jobs = await syncState();
  const integrations = [
    { name: "Database (PostgreSQL)", ok: /^postgres(ql)?:\/\//.test(process.env.DATABASE_URL ?? ""), env: "DATABASE_URL" },
    { name: "AI (Claude)", ok: isAiConfigured(), env: "ANTHROPIC_API_KEY" },
    { name: "Google OAuth", ok: isGoogleConfigured(), env: "GOOGLE_CLIENT_ID / SECRET" },
    { name: "Email (Resend)", ok: isEmailConfigured(), env: "RESEND_API_KEY" },
    { name: "Natural voice (ElevenLabs)", ok: isTtsConfigured(), env: "ELEVENLABS_API_KEY" },
    { name: "TURN relay", ok: Boolean(process.env.TURN_URL), env: "TURN_URL" },
    { name: "Internship listings", ok: jobs.count > 0, env: `${jobs.count.toLocaleString()} open${jobs.succeededAt ? ` · updated ${relativeTime(jobs.succeededAt)}` : ""}${jobs.lastError ? ` · last sync failed: ${jobs.lastError}` : ""}` },
  ];
  return (
    <div className="space-y-8">
      <PageHeader eyebrow="Admin" title="Platform overview" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total Users" value={totalUsers} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Active Students" value={students} icon={<GraduationCap className="h-4 w-4" />} />
        <StatCard label="Active Interviewers" value={interviewers} icon={<UserCheck className="h-4 w-4" />} />
        <StatCard label="Interviews Today" value={today} icon={<CalendarDays className="h-4 w-4" />} />
        <StatCard label="Completed Interviews" value={completed} icon={<CheckCircle2 className="h-4 w-4" />} tone="success" />
        <Link href="/admin/reports"><StatCard label="Pending Conduct Reports" value={pendingReports} icon={<Flag className="h-4 w-4" />} tone={pendingReports ? "warning" : "default"} className="h-full transition hover:shadow-lift" /></Link>
        <Link href="/admin/users?status=banned"><StatCard label="Banned Users" value={banned} icon={<Ban className="h-4 w-4" />} tone={banned ? "danger" : "default"} className="h-full transition hover:shadow-lift" /></Link>
        <Link href="/admin/appeals"><StatCard label="Pending Appeals" value={pendingAppeals} icon={<Scale className="h-4 w-4" />} tone={pendingAppeals ? "warning" : "default"} className="h-full transition hover:shadow-lift" /></Link>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHeader title="Admin audit log" description="Every administrative action is recorded." />
          <CardBody>
            {actions.length === 0 ? <p className="text-sm text-ink-500">No admin actions yet.</p> : (
              <ul className="divide-y divide-ink-100 text-sm">
                {actions.map((a) => (
                  <li key={a.id} className="py-2.5">
                    <p><span className="font-medium">{a.admin.profile?.firstName}</span> · <Badge>{a.action.replaceAll("_", " ")}</Badge> {a.targetUser && <span className="text-ink-500">→ {a.targetUser.email}</span>}</p>
                    {a.details && <p className="mt-0.5 text-xs text-ink-500">{a.details}</p>}
                    <p className="text-[11px] text-ink-400">{formatDateTime(a.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Integrations" description="External services and the env vars that enable them" />
          <CardBody>
            <ul className="space-y-3 text-sm">
              {integrations.map((i) => (
                <li key={i.name} className="flex items-center justify-between gap-3">
                  <div><p className="font-medium">{i.name}</p><p className="text-xs text-ink-500"><code>{i.env}</code></p></div>
                  {i.ok ? <Badge tone="success" icon={<CheckCircle2 className="h-3 w-3" />}>Configured</Badge> : <Badge tone="warning" icon={<AlertTriangle className="h-3 w-3" />}>Not configured</Badge>}
                </li>
              ))}
            </ul>
            <p className="mt-4 text-xs text-ink-500">Without an AI key the platform uses its labelled rule-based development engine for questions and grading. Video uses peer-to-peer WebRTC with public STUN.</p>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { conductReasonLabel, LABELS } from "@/lib/constants";
import { formatDate, formatDateTime, fullName, initials } from "@/lib/format";
import { parseJsonArray } from "@/lib/json";
import { standing } from "@/lib/services/conduct";
import { totalPoints } from "@/lib/services/gamification";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import { ScorePill } from "@/components/ui/score";
import { AdminAction } from "@/components/admin/admin-action";

export const metadata: Metadata = { title: "User · Admin" };

export default async function AdminUserDetail({ params }: { params: Promise<{ id: string }> }) {
  await requirePageUser({ roles: ["admin"] });
  const { id } = await params;
  const u = await db.user.findUnique({
    where: { id },
    include: {
      profile: true,
      studentProfile: true,
      interviewerProfile: true,
      strikes: { orderBy: { createdAt: "asc" }, include: { reviewer: { select: { profile: true } } } },
      conductReports: { orderBy: { createdAt: "desc" }, take: 20 },
      interviewsAsStudent: { orderBy: { createdAt: "desc" }, take: 20 },
      interviewsAsInterviewer: { orderBy: { createdAt: "desc" }, take: 20 },
    },
  });
  if (!u) notFound();
  const points = await totalPoints(u.id);
  const [noShows, techEvents] = await Promise.all([
    db.interview.count({ where: { noShowUserIds: { contains: u.id } } }),
    db.technicalEvent.count({ where: { userId: u.id } }),
  ]);
  const active = u.strikes.filter((s) => s.status === "active").length;
  const st = standing(active, u.accountStatus);
  const interviews = [...u.interviewsAsStudent, ...u.interviewsAsInterviewer].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  const isAdminTarget = u.role === "admin";
  return (
    <div className="space-y-6">
      <Link href="/admin/users" className="text-sm text-ink-500 hover:underline">← All users</Link>
      <Card>
        <CardBody className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar name={fullName(u.profile)} initials={initials(u.profile)} size="lg" />
            <div>
              <h1 className="text-2xl font-semibold">{fullName(u.profile)}</h1>
              <p className="text-sm text-ink-500">{u.email} · <span className="capitalize">{u.role}</span> · joined {formatDate(u.createdAt)}</p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={u.accountStatus === "active" ? "success" : toneForStatus(u.accountStatus)}>{u.accountStatus}</Badge>
                <Badge tone={st.tone === "success" ? "success" : st.tone}>{st.label} · {active}/3 strikes</Badge>
                <Badge>{points} pts</Badge>
                <Badge tone={noShows ? "warning" : "neutral"}>{noShows} no-shows</Badge>
                <Badge>{techEvents} technical events</Badge>
              </div>
            </div>
          </div>
          {!isAdminTarget && (
            <div className="flex flex-wrap gap-2">
              {u.accountStatus === "active" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "suspend" }} noteKey="reason" noteLabel="Reason" noteRequired label="Suspend" title="Suspend this account?" description="Suspension blocks interviews and cancels upcoming sessions until you restore the account." success="Account suspended." />}
              {u.accountStatus !== "banned" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "ban" }} noteKey="reason" noteLabel="Reason" noteRequired label="Ban" variant="danger" title="Ban this account?" description="The user will be blocked from all interview features and upcoming sessions will be cancelled. They can still sign in to appeal." success="Account banned." />}
              {u.accountStatus !== "active" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "unban" }} noteKey="reason" noteLabel="Reason" noteRequired label="Restore account" variant="olive" tone="primary" title="Restore this account?" description="The user regains full access. Active strikes are not removed." success="Account restored." />}
              {u.accountStatus === "active" && <AdminAction url={`/api/admin/users/${u.id}`} body={{ action: "add_strike" }} noteKey="reason" noteLabel="Description (shown to the user)" noteRequired label="Issue strike" title="Issue a conduct strike directly?" description="Prefer confirming a reviewed report. A third active strike bans the account automatically." success="Strike issued." />}
            </div>
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Profile" />
          <CardBody className="text-sm">
            {u.studentProfile && (
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-ink-500">School</dt><dd>{u.studentProfile.school}</dd></div>
                <div><dt className="text-xs text-ink-500">Major</dt><dd>{u.studentProfile.major} ({u.studentProfile.graduationYear})</dd></div>
                <div><dt className="text-xs text-ink-500">Target roles</dt><dd>{parseJsonArray(u.studentProfile.targetRoles).join(", ")}</dd></div>
                <div><dt className="text-xs text-ink-500">Industry</dt><dd>{u.studentProfile.targetIndustry}</dd></div>
              </dl>
            )}
            {u.interviewerProfile && (
              <dl className="grid grid-cols-2 gap-3">
                <div><dt className="text-xs text-ink-500">Title</dt><dd>{u.interviewerProfile.title}</dd></div>
                <div><dt className="text-xs text-ink-500">Type</dt><dd>{LABELS.interviewerType[u.interviewerProfile.interviewerType]}</dd></div>
                <div><dt className="text-xs text-ink-500">Company</dt><dd>{u.interviewerProfile.company ?? "—"}</dd></div>
                <div><dt className="text-xs text-ink-500">Experience</dt><dd>{u.interviewerProfile.yearsExperience} yrs</dd></div>
              </dl>
            )}
            {!u.studentProfile && !u.interviewerProfile && <p className="text-ink-500">No role profile.</p>}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Strike history" />
          <CardBody>
            {u.strikes.length === 0 ? <p className="text-sm text-ink-500">No strikes.</p> : (
              <ul className="space-y-3">
                {u.strikes.map((s) => (
                  <li key={s.id} className="rounded-lg border border-ink-200 p-3 text-sm">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-medium">Strike {s.strikeNumber} · {conductReasonLabel(s.reason)}</p>
                      <div className="flex items-center gap-2">
                        <Badge tone={s.status === "active" ? "danger" : "success"}>{s.status}</Badge>
                        {s.status === "active" && <AdminAction url={`/api/admin/strikes/${s.id}`} noteRequired label="Remove" variant="ghost" title="Remove this strike?" description="The strike will be marked removed. If the user was banned and falls below 3 strikes, their account can be restored." success="Strike removed." checkbox={{ key: "restoreAccount", label: "Restore account if eligible", default: true }} />}
                      </div>
                    </div>
                    <p className="mt-1 text-ink-600">{s.description}</p>
                    <p className="mt-1 text-xs text-ink-400">{formatDateTime(s.createdAt)} · reviewer {fullName(s.reviewer?.profile)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Interview history" />
        <CardBody>
          {interviews.length === 0 ? <p className="text-sm text-ink-500">No interviews.</p> : (
            <ul className="divide-y divide-ink-100 text-sm">
              {interviews.map((iv) => (
                <li key={iv.id} className="flex items-center justify-between gap-3 py-2.5">
                  <Link href={`/admin/interviews/${iv.id}`} className="hover:underline">{iv.targetRole} · {LABELS.mode[iv.mode]} · {LABELS.type[iv.type]} <span className="text-ink-400">({iv.studentId === u.id ? "candidate" : "interviewer"})</span></Link>
                  <div className="flex items-center gap-2"><Badge tone={toneForStatus(iv.status)}>{LABELS.status[iv.status]}</Badge><ScorePill score={iv.overallScore} /></div>
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="Conduct reports about this user" />
        <CardBody>
          {u.conductReports.length === 0 ? <p className="text-sm text-ink-500">None.</p> : (
            <ul className="divide-y divide-ink-100 text-sm">
              {u.conductReports.map((r) => (
                <li key={r.id} className="py-2.5"><div className="flex items-center justify-between"><span className="font-medium">{conductReasonLabel(r.reason)} <span className="text-xs text-ink-400">({r.source})</span></span><Badge tone={toneForStatus(r.status)}>{r.status}</Badge></div><p className="mt-0.5 text-ink-600">{r.description}</p></li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

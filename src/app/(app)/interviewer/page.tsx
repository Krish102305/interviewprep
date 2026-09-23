import type { Metadata } from "next";
import Link from "next/link";
import { CalendarClock, CalendarPlus, Inbox, Star, Trophy, Users } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { LABELS, roleCategoryLabel } from "@/lib/constants";
import { formatDateTime, greeting, relativeTime, shortName } from "@/lib/format";
import { parseJsonArray } from "@/lib/json";
import { activeStrikeCount } from "@/lib/services/conduct";
import { levelFor, totalPoints } from "@/lib/services/gamification";
import { expireStaleMatches } from "@/lib/services/matching";
import { sweepStaleInterviews } from "@/lib/services/interviews";
import { ensureReminders } from "@/lib/services/notifications";
import { interviewRows } from "@/lib/services/queries";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { StandingCard } from "@/components/conduct/standing-card";
import { InterviewList } from "@/components/interviews/interview-list";
import { AvailableNowToggle, ClaimButton, MatchActions } from "@/components/interviewer/request-actions";

export const metadata: Metadata = { title: "Interviewer dashboard" };

export default async function InterviewerDashboard() {
  const user = await requirePageUser({ roles: ["interviewer"] });
  await Promise.all([sweepStaleInterviews(), expireStaleMatches(), ensureReminders(user.id)]);
  const tz = user.profile?.timezone;
  const profile = await db.interviewerProfile.findUniqueOrThrow({ where: { userId: user.id } });
  const roles = parseJsonArray(profile.roles);
  const types = parseJsonArray(profile.interviewTypes);
  const prefOk = profile.interviewerType === "student" ? ["anyone", "student"] : ["anyone", "professional"];

  const [requests, pool, upcoming, past, ratings, points, strikes, openSlots, completedCount] = await Promise.all([
    db.match.findMany({ where: { interviewerId: user.id, status: "pending" }, include: { interview: true }, orderBy: { createdAt: "desc" } }),
    db.interview.findMany({
      where: { mode: "human", interviewerId: null, status: "scheduled", studentId: { not: user.id }, type: { in: types }, interviewerPreference: { in: prefOk }, roleCategory: { in: [...roles, "general"] } },
      orderBy: { createdAt: "asc" },
      take: 8,
    }),
    db.interview.findMany({ where: { interviewerId: user.id, status: { in: ["scheduled", "waiting", "active"] } }, orderBy: { scheduledAt: "asc" }, include: { student: { select: { profile: true, studentProfile: { select: { school: true } } } } } }),
    interviewRows({ interviewerId: user.id, status: { in: ["completed", "reported", "no_show"] } }, 6),
    db.interviewerRating.findMany({ where: { interviewerId: user.id, moderationStatus: "visible" }, orderBy: { createdAt: "desc" } }),
    totalPoints(user.id),
    activeStrikeCount(user.id),
    db.availability.count({ where: { interviewerId: user.id, interviewId: null, startsAt: { gte: new Date() } } }),
    db.interview.count({ where: { interviewerId: user.id, status: "completed" } }),
  ]);
  const avg = (k: "professionalism" | "realism" | "communication" | "feedbackQuality") => (ratings.length ? (ratings.reduce((s, r) => s + r[k], 0) / ratings.length).toFixed(1) : "N/A");
  const overall = ratings.length ? (ratings.reduce((s, r) => s + (r.professionalism + r.realism + r.communication + r.feedbackQuality) / 4, 0) / ratings.length).toFixed(1) : "N/A";
  const level = levelFor(points);

  return (
    <div className="space-y-8">
      <section className="flex flex-col gap-5 rounded-3xl bg-ink-950 p-7 text-white sm:p-10 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm text-ink-300">{greeting(new Date(), tz)}, {user.profile?.firstName}</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">Ready to interview?</h1>
          <p className="mt-2 max-w-lg text-sm text-ink-300">We prepare the interview guide. You bring real-world perspective and pressure.</p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <AvailableNowToggle on={profile.availableNow} />
          <ButtonLink href="/interviewer/availability" variant="olive"><CalendarPlus className="h-4 w-4" /> Availability</ButtonLink>
        </div>
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Interviews conducted" value={completedCount} sub={`${upcoming.length} upcoming · ${openSlots} open slots`} icon={<Users className="h-4 w-4" />} />
        <StatCard label="Average rating" value={overall === "N/A" ? "N/A" : `${overall} / 5`} sub={`${ratings.length} rating${ratings.length === 1 ? "" : "s"}`} icon={<Star className="h-4 w-4" />} tone="olive" />
        <StatCard label="Points" value={points.toLocaleString()} sub={`Level ${level.level} · ${level.title}`} icon={<Trophy className="h-4 w-4" />} tone="olive" />
        <StandingCard strikes={strikes} accountStatus={user.accountStatus} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Interview requests" description="You were matched with these candidates. Accept within 15 minutes." />
          <CardBody>
            {requests.length ? (
              <ul className="divide-y divide-ink-100">
                {requests.map((m) => (
                  <li key={m.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium text-ink-900">{m.interview.targetRole}</p>
                      <p className="text-xs text-ink-500">{LABELS.type[m.interview.type]} · {LABELS.difficulty[m.interview.difficulty]} · {m.interview.duration} min · requested {relativeTime(m.createdAt)}</p>
                      <div className="mt-1 flex flex-wrap gap-1">{parseJsonArray(m.reasons).slice(0, 3).map((r) => <Badge key={r} tone="olive">{r}</Badge>)}</div>
                    </div>
                    <MatchActions matchId={m.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState icon={<Inbox className="h-5 w-5" />} title="No pending requests" description="Turn on “Available now” to receive instant interview requests." />
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Available interviews" description="Open requests that match your roles and interview types." />
          <CardBody>
            {pool.length ? (
              <ul className="divide-y divide-ink-100">
                {pool.map((iv) => (
                  <li key={iv.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="truncate font-medium text-ink-900">{iv.targetRole}</p>
                      <p className="text-xs text-ink-500">{roleCategoryLabel(iv.roleCategory)} · {LABELS.type[iv.type]} · {iv.duration} min · waiting {relativeTime(iv.createdAt)}</p>
                    </div>
                    <ClaimButton interviewId={iv.id} />
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No open requests right now" description="New requests appear here as students look for interviewers." />
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader title="Upcoming interviews" />
        <CardBody>
          {upcoming.length ? (
            <ul className="divide-y divide-ink-100">
              {upcoming.map((iv) => (
                <li key={iv.id} className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive-50 text-olive-700"><CalendarClock className="h-5 w-5" /></span>
                    <div>
                      <p className="font-medium text-ink-900">{iv.targetRole} <span className="font-normal text-ink-500">with {shortName(iv.student.profile)}</span></p>
                      <p className="text-xs text-ink-500">{iv.status === "active" ? "In progress" : formatDateTime(iv.scheduledAt, tz)} · {LABELS.type[iv.type]} · {iv.duration} min{iv.questionStatus === "ready" ? " · Guide ready" : " · Guide generating"}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <ButtonLink href={`/interviews/${iv.id}`} size="sm" variant="secondary">Prepare</ButtonLink>
                    <ButtonLink href={`/interviews/${iv.id}/${iv.status === "active" ? "room" : "lobby"}`} size="sm">{iv.status === "active" ? "Rejoin" : "Join"}</ButtonLink>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState icon={<CalendarClock className="h-5 w-5" />} title="No upcoming interviews." description="Add availability slots so students can book you." action={<ButtonLink href="/interviewer/availability" size="sm">Add availability</ButtonLink>} />
          )}
        </CardBody>
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <Card>
          <CardHeader title="Past interviews" action={<Link href="/interviews" className="text-xs font-medium text-olive-700 hover:underline">View all</Link>} />
          <div className="mt-4 border-t border-ink-100">
            {past.length ? <InterviewList rows={past.map((r) => ({ ...r, interviewerName: r.studentName ?? null }))} viewer="interviewer" showScore={false} timeZone={tz} /> : <div className="p-6"><EmptyState title="No past interviews yet" /></div>}
          </div>
        </Card>
        <Card>
          <CardHeader title="Ratings" description="From candidates after human interviews" />
          <CardBody className="space-y-3">
            {(["professionalism", "realism", "communication", "feedbackQuality"] as const).map((k) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-ink-600">{{ professionalism: "Professionalism", realism: "Realism", communication: "Communication", feedbackQuality: "Feedback quality" }[k]}</span>
                <span className="font-semibold tabular-nums">{avg(k)}</span>
              </div>
            ))}
            {ratings.slice(0, 2).filter((r) => r.comment).map((r) => <blockquote key={r.id} className="rounded-lg bg-ink-50 p-3 text-sm italic text-ink-600">“{r.comment}”</blockquote>)}
            <div className="border-t border-ink-100 pt-3 text-xs text-ink-500">
              Interviews for: {roles.map((r) => roleCategoryLabel(r)).join(", ")} · <Link href="/profile" className="text-olive-700 hover:underline">Edit preferences</Link>
            </div>
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import { Award, Compass, Flame, Layers, MessageSquare, Sparkles, Star, TrendingUp, Trophy } from "lucide-react";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { EXPERIENCE_LEVELS, LABELS, roleCategoryLabel } from "@/lib/constants";
import { formatDate, fullName, initials } from "@/lib/format";
import { parseJsonArray } from "@/lib/json";
import { BADGES, levelFor, totalPoints } from "@/lib/services/gamification";
import { getPerformance } from "@/lib/services/performance";
import { Card, CardBody, CardHeader, StatCard } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/cn";
import { ProfileForm } from "@/components/profile/profile-form";
import { ResumeList } from "@/components/profile/resume-list";
import { InterviewerOnboarding } from "@/components/onboarding/interviewer-onboarding";

export const metadata: Metadata = { title: "Profile" };
const ICONS = { sparkles: Sparkles, layers: Layers, trophy: Trophy, message: MessageSquare, flame: Flame, trending: TrendingUp, star: Star, compass: Compass } as const;

export default async function ProfilePage() {
  const user = await requirePageUser({ roles: ["student", "interviewer"] });
  const [points, earned, sp, ip, resumes, pointsLog] = await Promise.all([
    totalPoints(user.id),
    db.userBadge.findMany({ where: { userId: user.id }, include: { badge: true } }),
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.interviewerProfile.findUnique({ where: { userId: user.id } }),
    db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
    db.pointsEntry.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);
  const level = levelFor(points);
  const isStudent = user.role === "student";
  const perf = isStudent ? await getPerformance(user.id) : null;
  const ratings = !isStudent ? await db.interviewerRating.findMany({ where: { interviewerId: user.id, moderationStatus: "visible" } }) : [];
  const avgRating = ratings.length ? (ratings.reduce((s, r) => s + (r.professionalism + r.realism + r.communication + r.feedbackQuality) / 4, 0) / ratings.length).toFixed(1) : "—";
  const conducted = !isStudent ? await db.interview.count({ where: { interviewerId: user.id, status: "completed" } }) : 0;
  const openSlots = !isStudent ? await db.availability.count({ where: { interviewerId: user.id, interviewId: null, startsAt: { gte: new Date() } } }) : 0;
  const earnedKeys = new Set(earned.map((e) => e.badge.key));

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden">
        <div className="h-24 bg-gradient-to-r from-ink-900 via-ink-800 to-olive-800" />
        <div className="-mt-10 flex flex-col gap-4 px-6 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex items-end gap-4">
            <Avatar name={fullName(user.profile)} initials={initials(user.profile)} size="xl" className="ring-4 ring-white" />
            <div className="pb-1">
              <h1 className="text-2xl font-semibold text-ink-950">{fullName(user.profile)}</h1>
              <p className="text-sm text-ink-500">
                {isStudent ? [sp?.school, sp?.major, sp?.graduationYear ? `Class of ${sp.graduationYear}` : null].filter(Boolean).join(" · ") : [ip?.title, ip?.industry, LABELS.interviewerType[ip?.interviewerType ?? "professional"]].filter(Boolean).join(" · ")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-olive-50 px-4 py-2.5">
            <Trophy className="h-5 w-5 text-olive-700" />
            <div>
              <p className="text-sm font-semibold">{points.toLocaleString()} pts · Level {level.level} {level.title}</p>
              <div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-white" role="progressbar" aria-label="Level progress" aria-valuenow={level.progress} aria-valuemin={0} aria-valuemax={100}><div className="h-full bg-olive-600" style={{ width: `${level.progress}%` }} /></div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {isStudent ? (
          <>
            <StatCard label="Interviews graded" value={perf?.summary.count ?? 0} />
            <StatCard label="Average score" value={perf?.summary.average ?? "—"} />
            <StatCard label="Best score" value={perf?.summary.highest ?? "—"} />
            <StatCard label="Current streak" value={`${sp?.currentStreak ?? 0} days`} sub={`Longest ${sp?.longestStreak ?? 0} days`} />
          </>
        ) : (
          <>
            <StatCard label="Interviews conducted" value={conducted} />
            <StatCard label="Average rating" value={avgRating === "—" ? "—" : `${avgRating} / 5`} sub={`${ratings.length} ratings`} />
            <StatCard label="Experience" value={`${ip?.yearsExperience ?? 0} yrs`} />
            <StatCard label="Open slots" value={openSlots} />
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
        <div className="space-y-6">
          {isStudent && sp && (
            <Card>
              <CardHeader title="Career profile" />
              <CardBody>
                <dl className="grid gap-4 text-sm sm:grid-cols-2">
                  <div><dt className="text-xs text-ink-500">Target roles</dt><dd className="mt-1 flex flex-wrap gap-1">{parseJsonArray(sp.targetRoles).map((r) => <Badge key={r}>{r}</Badge>)}</dd></div>
                  <div><dt className="text-xs text-ink-500">Industry</dt><dd className="mt-1 font-medium">{sp.targetIndustry}</dd></div>
                  <div><dt className="text-xs text-ink-500">Experience</dt><dd className="mt-1 font-medium">{EXPERIENCE_LEVELS.find((l) => l.value === sp.experienceLevel)?.label}</dd></div>
                  <div><dt className="text-xs text-ink-500">Companies</dt><dd className="mt-1 text-ink-700">{parseJsonArray(sp.companies).join(", ") || "—"}</dd></div>
                  <div><dt className="text-xs text-ink-500">Practicing</dt><dd className="mt-1 text-ink-700">{parseJsonArray(sp.interviewPreferences).map((t) => LABELS.type[t]).join(", ")}</dd></div>
                  <div><dt className="text-xs text-ink-500">Member since</dt><dd className="mt-1 text-ink-700">{formatDate(user.createdAt)}</dd></div>
                </dl>
              </CardBody>
            </Card>
          )}
          {!isStudent && ip && (
            <Card>
              <CardHeader title="Interviewer profile" description={`Interviews for: ${parseJsonArray(ip.roles).map(roleCategoryLabel).join(", ")}`} />
              <CardBody>
                <InterviewerOnboarding
                  editing
                  initial={{ firstName: user.profile?.firstName ?? "", lastName: user.profile?.lastName ?? "", location: user.profile?.location ?? "", interviewerType: ip.interviewerType, title: ip.title ?? "", company: ip.company ?? "", school: ip.school ?? "", industry: ip.industry ?? "Technology", yearsExperience: String(ip.yearsExperience), roles: parseJsonArray(ip.roles), interviewTypes: parseJsonArray(ip.interviewTypes), weeklyLimit: String(ip.weeklyLimit), bio: user.profile?.bio ?? "" }}
                />
              </CardBody>
            </Card>
          )}
          {isStudent && (
            <Card>
              <CardHeader title="Resumes" description="Private. Only you and interviewers you're matched with can open them." />
              <CardBody><ResumeList resumes={resumes.map((r) => ({ id: r.id, fileName: r.fileName, isDefault: r.isDefault, parsed: Boolean(r.parsedText) }))} /></CardBody>
            </Card>
          )}
          {isStudent && (
            <Card>
              <CardHeader title="Account details" />
              <CardBody><ProfileForm initial={{ firstName: user.profile?.firstName ?? "", lastName: user.profile?.lastName ?? "", location: user.profile?.location ?? "", bio: user.profile?.bio ?? "", timezone: user.profile?.timezone ?? "America/New_York" }} /></CardBody>
            </Card>
          )}
        </div>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Badges" description={`${earned.length} of ${BADGES.length} earned`} />
            <CardBody>
              <ul className="grid grid-cols-2 gap-3">
                {BADGES.map((b) => {
                  const Icon = ICONS[b.icon as keyof typeof ICONS] ?? Award;
                  const has = earnedKeys.has(b.key);
                  return (
                    <li key={b.key} className={cn("rounded-xl border p-3", has ? "border-olive-200 bg-olive-50" : "border-ink-200 opacity-60")}>
                      <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", has ? "bg-olive-600 text-white" : "bg-ink-100 text-ink-400")}><Icon className="h-4 w-4" /></span>
                      <p className="mt-2 text-sm font-semibold">{b.name}</p>
                      <p className="text-xs text-ink-500">{b.description}</p>
                      <p className="mt-1 text-[11px] font-medium">{has ? "Earned" : "Locked"}</p>
                    </li>
                  );
                })}
              </ul>
            </CardBody>
          </Card>
          <Card>
            <CardHeader title="Recent points" />
            <CardBody>
              {pointsLog.length ? (
                <ul className="space-y-2 text-sm">{pointsLog.map((p) => <li key={p.id} className="flex justify-between gap-3"><span className="text-ink-600">{p.reason}</span><span className="font-semibold text-olive-700">+{p.amount}</span></li>)}</ul>
              ) : <p className="text-sm text-ink-500">No points yet.</p>}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}

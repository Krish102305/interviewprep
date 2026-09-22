import type { Metadata } from "next";
import Link from "next/link";
import { Flame, Medal } from "lucide-react";
import { requirePageUser } from "@/lib/auth/guards";
import { leaderboard, levelFor, totalPoints } from "@/lib/services/gamification";
import { fullName, initials, shortName } from "@/lib/format";
import { LABELS } from "@/lib/constants";
import { cn } from "@/lib/cn";
import { Card, PageHeader } from "@/components/ui/card";
import { Avatar } from "@/components/ui/avatar";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Leaderboard" };

export default async function LeaderboardPage({ searchParams }: { searchParams: Promise<{ board?: string }> }) {
  const user = await requirePageUser({ roles: ["student", "interviewer"] });
  const board = (await searchParams).board === "interviewer" ? "interviewer" : (await searchParams).board === "student" ? "student" : user.role === "interviewer" ? "interviewer" : "student";
  const [rows, mine] = await Promise.all([leaderboard(board, 25), totalPoints(user.id)]);
  const myLevel = levelFor(mine);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Gamification" title="Leaderboard" description="Points come from completing interviews, improving, keeping streaks and — for interviewers — conducting interviews and giving great feedback." />
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex gap-1.5" aria-label="Leaderboard type">
          {(["student", "interviewer"] as const).map((b) => (
            <Link key={b} href={`/leaderboard?board=${b}`} aria-current={board === b ? "page" : undefined} className={cn("rounded-full px-4 py-1.5 text-sm", board === b ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>{b === "student" ? "Students" : "Interviewers"}</Link>
          ))}
        </nav>
        <p className="text-sm text-ink-600">You: <strong>{mine.toLocaleString()} pts</strong> · Level {myLevel.level} {myLevel.title}{myLevel.next ? ` · ${myLevel.toNext} to ${myLevel.next.title}` : ""}</p>
      </div>
      <Card>
        {rows.length === 0 ? <div className="p-6"><EmptyState title="No points yet" /></div> : (
          <ol className="divide-y divide-ink-100">
            {rows.map((r) => {
              const me = r.userId === user.id;
              return (
                <li key={r.userId} className={cn("flex items-center gap-4 px-5 py-3.5", me && "bg-olive-50/70")}>
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold", r.rank <= 3 ? "bg-ink-900 text-white" : "text-ink-500")}>{r.rank <= 3 ? <Medal className="h-4 w-4" aria-label={`Rank ${r.rank}`} /> : r.rank}</span>
                  <Avatar name={fullName(r.user?.profile)} initials={initials(r.user?.profile)} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-ink-900">{shortName(r.user?.profile)}{me && <span className="ml-1.5 text-xs text-olive-700">(you)</span>}</p>
                    <p className="truncate text-xs text-ink-500">
                      {board === "student" ? r.user?.studentProfile?.school ?? "" : `${r.user?.interviewerProfile?.title ?? ""} · ${LABELS.interviewerType[r.user?.interviewerProfile?.interviewerType ?? "professional"]}`}
                      {board === "student" && (r.user?.studentProfile?.currentStreak ?? 0) > 1 && <span className="ml-2 inline-flex items-center gap-0.5 text-olive-700"><Flame className="h-3 w-3" />{r.user?.studentProfile?.currentStreak}d</span>}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold tabular-nums">{r.points.toLocaleString()}</p>
                    <p className="text-[11px] text-ink-500">Lv {r.level.level} · {r.user?._count.badges ?? 0} badges</p>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </Card>
    </div>
  );
}

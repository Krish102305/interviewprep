import type { Metadata } from "next";
import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { formatDate, fullName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, PageHeader } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";

export const metadata: Metadata = { title: "Users · Admin" };

export default async function AdminUsers({ searchParams }: { searchParams: Promise<{ q?: string; role?: string; status?: string }> }) {
  await requirePageUser({ roles: ["admin"] });
  const sp = await searchParams;
  const q = sp.q?.trim().slice(0, 100);
  const where: Prisma.UserWhereInput = {
    ...(sp.role && ["student", "interviewer", "admin"].includes(sp.role) ? { role: sp.role } : {}),
    ...(sp.status && ["active", "suspended", "banned"].includes(sp.status) ? { accountStatus: sp.status } : {}),
    ...(q ? { OR: [{ email: { contains: q } }, { profile: { firstName: { contains: q } } }, { profile: { lastName: { contains: q } } }] } : {}),
  };
  const users = await db.user.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 200,
    include: { profile: true, studentProfile: { select: { school: true } }, _count: { select: { interviewsAsStudent: true, interviewsAsInterviewer: true, strikes: { where: { status: "active" } } } } },
  });
  const chip = (params: Record<string, string | undefined>, label: string, active: boolean) => {
    const u = new URLSearchParams(Object.entries({ ...sp, ...params }).filter(([, v]) => v) as [string, string][]);
    return <Link key={label} href={`/admin/users?${u}`} className={cn("rounded-full px-3 py-1 text-sm", active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>{label}</Link>;
  };
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Users" description={`${users.length} shown`} />
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <form className="flex gap-2" role="search">
          {sp.role && <input type="hidden" name="role" value={sp.role} />}
          {sp.status && <input type="hidden" name="status" value={sp.status} />}
          <label htmlFor="q" className="sr-only">Search users</label>
          <input id="q" name="q" defaultValue={q} placeholder="Search name or email" className="input-base w-64" />
        </form>
        <div className="flex flex-wrap gap-1.5">
          {chip({ role: undefined }, "All roles", !sp.role)}
          {chip({ role: "student" }, "Students", sp.role === "student")}
          {chip({ role: "interviewer" }, "Interviewers", sp.role === "interviewer")}
          {chip({ role: "admin" }, "Admins", sp.role === "admin")}
          <span className="mx-1 w-px bg-ink-200" />
          {chip({ status: undefined }, "Any status", !sp.status)}
          {chip({ status: "suspended" }, "Suspended", sp.status === "suspended")}
          {chip({ status: "banned" }, "Banned", sp.status === "banned")}
        </div>
      </div>
      <Card className="overflow-x-auto">
        {users.length === 0 ? <div className="p-6"><EmptyState title="No users match" /></div> : (
          <table className="w-full min-w-[760px] text-sm">
            <thead><tr className="border-b border-ink-200 text-left text-xs text-ink-500"><th className="px-5 py-2.5 font-medium">Name</th><th className="py-2.5 pr-4 font-medium">Email</th><th className="py-2.5 pr-4 font-medium">Role</th><th className="py-2.5 pr-4 font-medium">School</th><th className="py-2.5 pr-4 font-medium">Interviews</th><th className="py-2.5 pr-4 font-medium">Strikes</th><th className="py-2.5 pr-4 font-medium">Status</th><th className="py-2.5 pr-5 font-medium">Joined</th></tr></thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-b border-ink-100 last:border-0 hover:bg-ink-50">
                  <td className="px-5 py-3"><Link href={`/admin/users/${u.id}`} className="font-medium text-ink-900 hover:underline">{fullName(u.profile)}</Link></td>
                  <td className="py-3 pr-4 text-ink-600">{u.email}</td>
                  <td className="py-3 pr-4 capitalize">{u.role}</td>
                  <td className="py-3 pr-4 text-ink-600">{u.studentProfile?.school ?? "—"}</td>
                  <td className="py-3 pr-4 tabular-nums">{u._count.interviewsAsStudent + u._count.interviewsAsInterviewer}</td>
                  <td className="py-3 pr-4 tabular-nums">{u._count.strikes} / 3</td>
                  <td className="py-3 pr-4"><Badge tone={u.accountStatus === "active" ? "success" : toneForStatus(u.accountStatus)}>{u.accountStatus}</Badge></td>
                  <td className="py-3 pr-5 text-ink-500">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </div>
  );
}

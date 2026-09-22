import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { conductReasonLabel } from "@/lib/constants";
import { formatDateTime, fullName } from "@/lib/format";
import { cn } from "@/lib/cn";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { AdminAction } from "@/components/admin/admin-action";
import { EvidenceBlock } from "@/components/admin/evidence-block";

export const metadata: Metadata = { title: "Conduct reports · Admin" };

export default async function AdminReports({ searchParams }: { searchParams: Promise<{ status?: string }> }) {
  await requirePageUser({ roles: ["admin"] });
  const status = (await searchParams).status ?? "pending";
  const reports = await db.conductReport.findMany({
    where: status === "all" ? {} : { status },
    orderBy: { createdAt: status === "pending" ? "asc" : "desc" },
    take: 100,
    include: {
      user: { select: { id: true, email: true, role: true, profile: true, _count: { select: { strikes: { where: { status: "active" } } } } } },
      reportedBy: { select: { profile: true, role: true } },
      reviewedBy: { select: { profile: true } },
      interview: { select: { id: true, targetRole: true, mode: true, type: true } },
    },
  });
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Conduct reports" description="Reports never create strikes on their own. Review the evidence, then confirm (issues the next strike) or dismiss." />
      <nav className="mb-4 flex flex-wrap gap-1.5" aria-label="Report status">
        {["pending", "confirmed", "dismissed", "appealed", "overturned", "all"].map((s) => (
          <Link key={s} href={`/admin/reports?status=${s}`} aria-current={status === s ? "page" : undefined} className={cn("rounded-full px-3 py-1 text-sm capitalize", status === s ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100")}>{s}</Link>
        ))}
      </nav>
      {reports.length === 0 ? <EmptyState title={`No ${status === "all" ? "" : status} reports`} /> : (
        <div className="space-y-4">
          {reports.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={toneForStatus(r.status)}>{r.status}</Badge>
                      <Badge tone="dark">{conductReasonLabel(r.reason)}</Badge>
                      <Badge>{r.source === "system" ? "Automated signal" : `Filed by ${r.reportedBy?.role ?? r.source}`}</Badge>
                    </div>
                    <p className="mt-3 font-semibold text-ink-900">
                      <Link href={`/admin/users/${r.user.id}`} className="hover:underline">{fullName(r.user.profile)}</Link>
                      <span className="font-normal text-ink-500"> ({r.user.role}) · currently {r.user._count.strikes}/3 strikes</span>
                    </p>
                    <p className="mt-1 text-xs text-ink-500">
                      {formatDateTime(r.createdAt)}{r.reportedBy ? ` · reported by ${fullName(r.reportedBy.profile)}` : ""}
                      {r.interview && <> · <Link href={`/admin/interviews/${r.interview.id}`} className="underline">{r.interview.targetRole} interview</Link></>}
                    </p>
                    <p className="mt-3 rounded-lg bg-ink-50 p-3 text-sm text-ink-700">{r.description}</p>
                    <div className="mt-3"><EvidenceBlock evidence={r.evidence} /></div>
                    {r.reviewedBy && <p className="mt-3 text-xs text-ink-500">Reviewed by {fullName(r.reviewedBy.profile)} {r.reviewNote ? `— “${r.reviewNote}”` : ""}</p>}
                  </div>
                  {r.status === "pending" && (
                    <div className="flex shrink-0 gap-2">
                      <AdminAction url={`/api/admin/reports/${r.id}`} body={{ decision: "confirm" }} label="Confirm strike" variant="danger" title="Confirm this report?" description={`This issues strike ${Math.min(3, r.user._count.strikes + 1)} of 3 to ${fullName(r.user.profile)}.${r.user._count.strikes >= 2 ? " This is their third strike — the account will be banned and upcoming interviews cancelled." : ""}`} success="Report confirmed and strike issued." />
                      <AdminAction url={`/api/admin/reports/${r.id}`} body={{ decision: "dismiss" }} label="Dismiss" tone="primary" title="Dismiss this report?" description="No strike will be issued. The reporter will be notified that it was reviewed." success="Report dismissed." />
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

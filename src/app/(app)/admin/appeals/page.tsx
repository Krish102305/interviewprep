import type { Metadata } from "next";
import Link from "next/link";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { conductReasonLabel } from "@/lib/constants";
import { formatDateTime, fullName } from "@/lib/format";
import { Card, CardBody, PageHeader } from "@/components/ui/card";
import { Badge, toneForStatus } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/feedback";
import { AdminAction } from "@/components/admin/admin-action";

export const metadata: Metadata = { title: "Appeals · Admin" };

export default async function AdminAppeals() {
  await requirePageUser({ roles: ["admin"] });
  const appeals = await db.appeal.findMany({
    orderBy: [{ status: "desc" }, { submittedAt: "asc" }],
    take: 100,
    include: { user: { select: { id: true, profile: true, accountStatus: true } }, strike: { include: { report: true } }, reviewedBy: { select: { profile: true } } },
  });
  const sorted = [...appeals.filter((a) => a.status === "pending"), ...appeals.filter((a) => a.status !== "pending")];
  return (
    <div>
      <PageHeader eyebrow="Admin" title="Appeals" description="Approving an appeal overturns the strike and can restore a banned account." />
      {sorted.length === 0 ? <EmptyState title="No appeals" /> : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex flex-col gap-4 lg:flex-row lg:justify-between">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={toneForStatus(a.status)}>{a.status}</Badge>
                    <Badge tone="dark">Strike {a.strike.strikeNumber} · {conductReasonLabel(a.strike.reason)}</Badge>
                    {a.user.accountStatus === "banned" && <Badge tone="danger">Account banned</Badge>}
                  </div>
                  <p className="mt-3 font-semibold"><Link href={`/admin/users/${a.user.id}`} className="hover:underline">{fullName(a.user.profile)}</Link> <span className="font-normal text-ink-500">· submitted {formatDateTime(a.submittedAt)}</span></p>
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    <div className="rounded-lg bg-ink-50 p-3 text-sm"><p className="text-xs font-semibold text-ink-500">Original strike</p><p className="mt-1 text-ink-700">{a.strike.description}</p></div>
                    <div className="rounded-lg border border-olive-200 bg-olive-50 p-3 text-sm"><p className="text-xs font-semibold text-olive-800">Appeal: {a.reason}</p><p className="mt-1 text-ink-700">{a.description}</p></div>
                  </div>
                  {a.reviewedBy && <p className="mt-3 text-xs text-ink-500">Reviewed by {fullName(a.reviewedBy.profile)}{a.reviewNote ? ` — “${a.reviewNote}”` : ""}</p>}
                </div>
                {a.status === "pending" && (
                  <div className="flex shrink-0 gap-2 lg:flex-col">
                    <AdminAction url={`/api/admin/appeals/${a.id}`} body={{ decision: "approve" }} label="Approve" variant="olive" tone="primary" title="Approve this appeal?" description="The strike is overturned and the strike history updated." success="Appeal approved; strike overturned." checkbox={{ key: "restoreAccount", label: "Restore account if it drops below 3 strikes", default: true }} />
                    <AdminAction url={`/api/admin/appeals/${a.id}`} body={{ decision: "deny" }} label="Deny" title="Deny this appeal?" description="The strike stays active. Your note is shared with the user." noteLabel="Note to the user" success="Appeal denied." />
                  </div>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

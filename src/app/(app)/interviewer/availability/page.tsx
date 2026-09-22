import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { PageHeader } from "@/components/ui/card";
import { AvailabilityManager } from "@/components/interviewer/availability-manager";

export const metadata: Metadata = { title: "Availability" };

export default async function AvailabilityPage() {
  const user = await requirePageUser({ roles: ["interviewer"] });
  const slots = await db.availability.findMany({
    where: { interviewerId: user.id, endsAt: { gte: new Date() } },
    orderBy: { startsAt: "asc" },
    include: { interview: { select: { id: true, targetRole: true } } },
  });
  return (
    <div>
      <PageHeader eyebrow="Scheduling" title="Availability" description="Open time slots students can book. You can also toggle “Available now” on your dashboard for instant matches." />
      <AvailabilityManager slots={slots.map((s) => ({ id: s.id, startsAt: s.startsAt.toISOString(), endsAt: s.endsAt.toISOString(), interview: s.interview }))} />
    </div>
  );
}

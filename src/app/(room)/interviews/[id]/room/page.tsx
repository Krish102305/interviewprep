import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guards";
import { loadForUser } from "@/lib/services/interviews";
import { fullName, initials } from "@/lib/format";
import { AiRoom } from "@/components/room/ai-room";
import { HumanRoom } from "@/components/room/human-room";

export const metadata: Metadata = { title: "Interview room" };

export default async function RoomPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const ctx = await loadForUser(id, user).catch(() => null);
  if (!ctx || ctx.role === "admin") notFound();
  if (ctx.iv.mode === "ai") return <AiRoom id={id} candidateName={fullName(user.profile)} candidateInitials={initials(user.profile)} />;
  if (["scheduled", "waiting"].includes(ctx.iv.status)) redirect(`/interviews/${id}/lobby`);
  return <HumanRoom id={id} />;
}

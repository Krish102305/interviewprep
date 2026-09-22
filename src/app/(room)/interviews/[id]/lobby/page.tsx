import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requirePageUser } from "@/lib/auth/guards";
import { loadForUser } from "@/lib/services/interviews";
import { Lobby } from "@/components/room/lobby";

export const metadata: Metadata = { title: "Device check" };

export default async function LobbyPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePageUser();
  const { id } = await params;
  const ctx = await loadForUser(id, user).catch(() => null);
  if (!ctx || ctx.role === "admin") notFound();
  if (ctx.iv.mode === "ai") redirect(`/interviews/${id}/room`);
  return <Lobby id={id} />;
}

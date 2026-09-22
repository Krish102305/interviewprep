import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { notFound } from "@/lib/errors";
import { deleteFile, readFile } from "@/lib/storage";

/**
 * Download a resume. Allowed: the owner, an admin, or the interviewer assigned
 * to an interview that uses this resume (needed to prepare for the interview).
 */
export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser();
  const resume = await db.resume.findUnique({ where: { id: params.id } });
  if (!resume) throw notFound();
  const allowed =
    resume.userId === user.id ||
    user.role === "admin" ||
    (user.role === "interviewer" && (await db.interview.count({ where: { resumeId: resume.id, interviewerId: user.id } })) > 0);
  if (!allowed) throw notFound();
  const data = await readFile(resume.storagePath);
  return new NextResponse(new Uint8Array(data), {
    headers: {
      "Content-Type": resume.mimeType,
      "Content-Disposition": `inline; filename="${resume.fileName.replace(/[^\w.\- ]/g, "_")}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
});

export const PATCH = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser({ roles: ["student"] });
  const resume = await db.resume.findFirst({ where: { id: params.id, userId: user.id } });
  if (!resume) throw notFound();
  await db.$transaction([
    db.resume.updateMany({ where: { userId: user.id }, data: { isDefault: false } }),
    db.resume.update({ where: { id: resume.id }, data: { isDefault: true } }),
  ]);
  return { ok: true };
});

export const DELETE = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser({ roles: ["student"] });
  const resume = await db.resume.findFirst({ where: { id: params.id, userId: user.id } });
  if (!resume) throw notFound();
  await db.resume.delete({ where: { id: resume.id } });
  await deleteFile(resume.storagePath).catch(() => {});
  return { ok: true };
});

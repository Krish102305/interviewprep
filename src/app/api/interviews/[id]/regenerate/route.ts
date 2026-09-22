import { after } from "next/server";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { conflict, forbidden } from "@/lib/errors";
import { generateQuestionsFor, loadForUser } from "@/lib/services/interviews";

/** Retry question generation after a failure. */
export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser();
  const { iv, role } = await loadForUser(params.id, user);
  if (role === "admin") throw forbidden();
  if (iv.questionStatus !== "failed") throw conflict("Questions are not in a failed state.");
  await db.interview.update({ where: { id: iv.id }, data: { questionStatus: "generating" } });
  after(() => generateQuestionsFor(iv.id));
  return { ok: true };
});

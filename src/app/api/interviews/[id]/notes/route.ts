import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { noteSchema } from "@/lib/validation";
import { addNote, listNotes } from "@/lib/services/room";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer", "admin"] });
  return { notes: await listNotes(params.id, user) };
});

export const POST = route<{ id: string }>(async (req, { params }) => {
  const user = await requireApiUser({ roles: ["interviewer"] });
  const body = await readJson(req, noteSchema);
  return { note: await addNote(params.id, user, body.text, body.questionId) };
});

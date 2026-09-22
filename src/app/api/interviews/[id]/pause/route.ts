import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { togglePause } from "@/lib/services/room";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser();
  return togglePause(params.id, user);
});

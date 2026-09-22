import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { aiStart, getRoomState } from "@/lib/services/room";

export const POST = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser({ roles: ["student"] });
  await aiStart(params.id, user);
  return getRoomState(params.id, user);
});

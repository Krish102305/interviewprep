import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { getRoomState } from "@/lib/services/room";

export const dynamic = "force-dynamic";

export const GET = route<{ id: string }>(async (_req, { params }) => {
  const user = await requireApiUser();
  return getRoomState(params.id, user);
});

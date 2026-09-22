import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { reportSchema } from "@/lib/validation";
import { forbidden } from "@/lib/errors";
import { loadForUser } from "@/lib/services/interviews";
import { fileReport } from "@/lib/services/conduct";

/** Report the other participant. Creates a PENDING report — never a strike. */
export const POST = route<{ id: string }>(
  async (req, { params }) => {
    const user = await requireApiUser();
    const body = await readJson(req, reportSchema);
    const { iv, role } = await loadForUser(params.id, user);
    if (role === "admin" || iv.mode !== "human" || !iv.interviewerId) throw forbidden("Reports can only be filed by participants of a human interview.");
    const target = role === "interviewer" ? iv.studentId : iv.interviewerId;
    const [conductEvents, technicalEvents] = await Promise.all([
      db.conductEvent.findMany({ where: { interviewId: iv.id, userId: target }, orderBy: { createdAt: "asc" } }),
      db.technicalEvent.findMany({ where: { interviewId: iv.id, userId: target }, orderBy: { createdAt: "asc" } }),
    ]);
    const report = await fileReport({
      userId: target,
      interviewId: iv.id,
      reportedById: user.id,
      source: role === "interviewer" ? "interviewer" : "participant",
      reason: body.reason,
      description: body.description,
      evidence: {
        filedAt: new Date(),
        interviewStatus: iv.status,
        conductEvents: conductEvents.map((e) => ({ type: e.type, source: e.source, details: e.details, at: e.createdAt })),
        technicalEvents: technicalEvents.map((e) => ({ type: e.type, details: e.details, at: e.createdAt })),
      },
    });
    return { ok: true, reportId: report.id };
  },
  { rateLimit: { key: "report", limit: 10, windowSec: 3600 } },
);

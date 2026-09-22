import { z } from "zod";
import { db } from "@/lib/db";
import { route } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { DIFFICULTIES, INTERVIEWER_PREFERENCES, INTERVIEW_TYPES, inferRoleCategory } from "@/lib/constants";
import { availableSlots } from "@/lib/services/matching";

const q = z.object({
  type: z.enum(INTERVIEW_TYPES),
  targetRole: z.string().trim().min(1).max(120),
  difficulty: z.enum(DIFFICULTIES),
  duration: z.coerce.number().int().min(15).max(60),
  preference: z.enum(INTERVIEWER_PREFERENCES),
});

export const GET = route(async (req) => {
  const user = await requireApiUser({ roles: ["student"] });
  const p = q.parse(Object.fromEntries(new URL(req.url).searchParams));
  const [sp, profile] = await Promise.all([db.studentProfile.findUnique({ where: { userId: user.id } }), db.profile.findUnique({ where: { userId: user.id } })]);
  const slots = await availableSlots({
    studentId: user.id,
    type: p.type,
    roleCategory: inferRoleCategory(p.targetRole, sp?.targetIndustry),
    difficulty: p.difficulty,
    duration: p.duration,
    preference: p.preference,
    studentIndustry: sp?.targetIndustry,
    studentTimezone: profile?.timezone,
  });
  return { slots };
});

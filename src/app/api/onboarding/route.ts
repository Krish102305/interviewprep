import { db } from "@/lib/db";
import { route, readJson } from "@/lib/api";
import { requireApiUser } from "@/lib/auth/guards";
import { interviewerOnboardingSchema, studentOnboardingSchema } from "@/lib/validation";
import { badRequest } from "@/lib/errors";
import { safeTz } from "@/lib/format";
import { awardPoints, POINTS } from "@/lib/services/gamification";
import { track } from "@/lib/services/analytics";

export const POST = route(async (req) => {
  const user = await requireApiUser({ roles: ["student", "interviewer"] });
  if (user.role === "student") {
    const d = await readJson(req, studentOnboardingSchema);
    const profile = { firstName: d.firstName, lastName: d.lastName, location: d.location || null, timezone: safeTz(d.timezone) ?? "America/New_York" };
    const student = {
      school: d.school,
      major: d.major,
      graduationYear: d.graduationYear,
      targetIndustry: d.targetIndustry,
      targetRoles: JSON.stringify(d.targetRoles),
      experienceLevel: d.experienceLevel,
      companies: JSON.stringify(d.companies),
      goals: JSON.stringify(d.goals),
      interviewPreferences: JSON.stringify(d.interviewPreferences),
    };
    await db.$transaction([
      db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profile }, update: profile }),
      db.studentProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...student }, update: student }),
      db.user.update({ where: { id: user.id }, data: { onboardedAt: user.onboardedAt ?? new Date() } }),
    ]);
    if (!user.onboardedAt) {
      await awardPoints(user.id, POINTS.onboarding, "Completed your profile");
      await track("profile_completed", user.id, { role: "student" });
    }
    return { ok: true, redirect: "/dashboard" };
  }
  if (user.role === "interviewer") {
    const d = await readJson(req, interviewerOnboardingSchema);
    const profile = { firstName: d.firstName, lastName: d.lastName, location: d.location || null, timezone: safeTz(d.timezone) ?? "America/New_York", bio: d.bio || null };
    const interviewer = {
      interviewerType: d.interviewerType,
      title: d.title,
      company: d.company || null,
      school: d.school || null,
      industry: d.industry,
      yearsExperience: d.yearsExperience,
      roles: JSON.stringify(d.roles),
      interviewTypes: JSON.stringify(d.interviewTypes),
      weeklyLimit: d.weeklyLimit,
    };
    await db.$transaction([
      db.profile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...profile }, update: profile }),
      db.interviewerProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, ...interviewer }, update: interviewer }),
      db.user.update({ where: { id: user.id }, data: { onboardedAt: user.onboardedAt ?? new Date() } }),
    ]);
    if (!user.onboardedAt) {
      await awardPoints(user.id, POINTS.onboarding, "Completed your interviewer profile");
      await track("profile_completed", user.id, { role: "interviewer" });
    }
    return { ok: true, redirect: "/interviewer/availability" };
  }
  throw badRequest("Unsupported role.");
});

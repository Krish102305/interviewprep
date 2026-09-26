import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { parseJsonArray } from "@/lib/json";
import { isAiConfigured } from "@/lib/ai/client";
import { PageHeader } from "@/components/ui/card";
import { NewInterviewWizard } from "@/components/interviews/new-interview-wizard";
import { ensureDescription } from "@/lib/jobs/sync";

export const metadata: Metadata = { title: "Start an interview" };

export default async function NewInterviewPage({ searchParams }: { searchParams: Promise<{ mode?: string; type?: string; job?: string }> }) {
  const user = await requirePageUser({ roles: ["student"] });
  const sp = await searchParams;
  const [student, resumes] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, isDefault: true, parsedText: true } }),
  ]);
  // "Practice for this job" from the internship listings: prefill the setup.
  const listing = sp.job ? await ensureDescription(String(sp.job).slice(0, 40)).catch(() => null) : null;
  const job = listing
    ? {
        id: listing.id,
        company: listing.company.slice(0, 120),
        // Drop the season from the title ("Software Engineer Intern - Summer 2027" → "Software Engineer Intern").
        role: listing.title.replace(/\s*[-–|,:(]*\s*\b(summer|fall|autumn|winter|spring)\b\s*'?(20)?\d\d\b\)?/gi, "").replace(/\(\s*\)/g, "").trim().slice(0, 120) || listing.title.slice(0, 120),
        title: listing.title,
        description: listing.description ?? "",
        url: listing.url,
      }
    : null;
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Start an interview" title="Set up your practice interview" description="Every interview is customized by AI and graded by AI, no matter who conducts it." />
      <NewInterviewWizard
        // Remount per job so "Practice for this job" always loads that job's details.
        key={job?.id ?? "none"}
        initialMode={sp.mode === "human" ? "human" : sp.mode === "ai" ? "ai" : null}
        initialType={sp.type === "technical" || sp.type === "full" || sp.type === "behavioral" ? sp.type : null}
        targetRoles={parseJsonArray(student?.targetRoles)}
        companies={parseJsonArray(student?.companies)}
        resumes={resumes.map((r) => ({ id: r.id, fileName: r.fileName, isDefault: r.isDefault, parsed: Boolean(r.parsedText) }))}
        aiConfigured={isAiConfigured()}
        job={job}
      />
    </div>
  );
}

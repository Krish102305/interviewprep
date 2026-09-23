import type { Metadata } from "next";
import { db } from "@/lib/db";
import { requirePageUser } from "@/lib/auth/guards";
import { parseJsonArray } from "@/lib/json";
import { isAiConfigured } from "@/lib/ai/client";
import { PageHeader } from "@/components/ui/card";
import { NewInterviewWizard } from "@/components/interviews/new-interview-wizard";

export const metadata: Metadata = { title: "Start an interview" };

export default async function NewInterviewPage({ searchParams }: { searchParams: Promise<{ mode?: string; type?: string }> }) {
  const user = await requirePageUser({ roles: ["student"] });
  const sp = await searchParams;
  const [student, resumes] = await Promise.all([
    db.studentProfile.findUnique({ where: { userId: user.id } }),
    db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, select: { id: true, fileName: true, isDefault: true, parsedText: true } }),
  ]);
  return (
    <div className="mx-auto max-w-4xl">
      <PageHeader eyebrow="Start an interview" title="Set up your practice interview" description="Every interview is customized by AI and graded by AI, no matter who conducts it." />
      <NewInterviewWizard
        initialMode={sp.mode === "human" ? "human" : sp.mode === "ai" ? "ai" : null}
        initialType={sp.type === "technical" || sp.type === "full" || sp.type === "behavioral" ? sp.type : null}
        targetRoles={parseJsonArray(student?.targetRoles)}
        companies={parseJsonArray(student?.companies)}
        resumes={resumes.map((r) => ({ id: r.id, fileName: r.fileName, isDefault: r.isDefault, parsed: Boolean(r.parsedText) }))}
        aiConfigured={isAiConfigured()}
      />
    </div>
  );
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";
import { Logo } from "@/components/layout/logo";
import { StudentOnboarding } from "@/components/onboarding/student-onboarding";
import { InterviewerOnboarding } from "@/components/onboarding/interviewer-onboarding";

export const metadata: Metadata = { title: "Set up your profile" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.onboardedAt || user.role === "admin" || user.accountStatus !== "active") redirect(homeFor(user));
  const resume = user.role === "student" ? await db.resume.findFirst({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }) : null;
  const first = user.profile?.firstName ?? "";
  return (
    <div className="min-h-screen">
      <header className="container-page flex h-16 items-center"><Logo /></header>
      <main id="main" className="container-page max-w-3xl pb-16 pt-6">
        <p className="eyebrow">{user.role === "student" ? "Student onboarding" : "Interviewer onboarding"}</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink-950">{first ? `Welcome, ${first}.` : "Welcome."} Let&apos;s set up your profile.</h1>
        <p className="mt-2 text-ink-500">
          {user.role === "student"
            ? "This takes about two minutes and lets the AI customize every interview to you."
            : "Tell us what you can interview for so we can match you with the right candidates."}
        </p>
        <div className="mt-10">
          {user.role === "student" ? (
            <StudentOnboarding initial={{ firstName: first, lastName: user.profile?.lastName ?? "" }} existingResume={resume ? { id: resume.id, fileName: resume.fileName, parsed: Boolean(resume.parsedText) } : null} />
          ) : (
            <InterviewerOnboarding
              initial={{ firstName: first, lastName: user.profile?.lastName ?? "", location: "", interviewerType: "professional", title: "", company: "", school: "", industry: "Technology", yearsExperience: "3", roles: [], interviewTypes: ["behavioral", "technical", "full"], weeklyLimit: "5", bio: "" }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

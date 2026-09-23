"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { EXPERIENCE_LEVELS, GOALS, INDUSTRIES, INTERVIEW_TYPES, LABELS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { ChipGroup, Input, Select } from "@/components/ui/form";
import { ResumeUploader, type ResumeSummary } from "@/components/shared/resume-uploader";
import { TagInput } from "@/components/shared/tag-input";
import { Stepper } from "./stepper";

const STEPS = ["Basic information", "Career", "Resume", "Goals", "Interview preferences"];
const ROLE_SUGGESTIONS = ["Software Engineer Intern", "Product Manager Intern", "Investment Banking Analyst", "Consulting Analyst", "Marketing Associate", "Data Analyst"];

type Initial = { firstName: string; lastName: string };

export function StudentOnboarding({ initial, existingResume }: { initial: Initial; existingResume: ResumeSummary | null }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [resume, setResume] = useState<ResumeSummary | null>(existingResume);
  const [f, setF] = useState({
    firstName: initial.firstName,
    lastName: initial.lastName,
    school: "",
    major: "",
    graduationYear: String(new Date().getFullYear() + 1),
    location: "",
    targetIndustry: "Technology",
    targetRoles: [] as string[],
    experienceLevel: "entry",
    companies: [] as string[],
    goals: [] as string[],
    interviewPreferences: ["behavioral"] as string[],
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function validate(s: number) {
    if (s === 0 && (!f.firstName.trim() || !f.school.trim() || !f.major.trim() || !f.graduationYear)) return "Please fill in your name, school, major and graduation year.";
    if (s === 1 && !f.targetRoles.length) return "Add at least one target role.";
    if (s === 3 && !f.goals.length) return "Pick at least one goal.";
    if (s === 4 && !f.interviewPreferences.length) return "Pick at least one interview type.";
  }

  async function next() {
    const v = validate(step);
    if (v) return setError(v);
    setError(undefined);
    if (step < STEPS.length - 1) return setStep(step + 1);
    setSaving(true);
    try {
      const res = await api<{ redirect: string }>("/api/onboarding", {
        body: { ...f, graduationYear: Number(f.graduationYear), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      router.push(res.redirect);
      router.refresh();
    } catch (err) {
      setError((err as Error).message);
      setSaving(false);
    }
  }

  return (
    <div>
      <Stepper steps={STEPS} current={step} />
      <Card className="mt-8 p-6 sm:p-8">
        <p className="eyebrow">Step {step + 1} of {STEPS.length}</p>
        <h2 className="mt-2 text-xl font-semibold">{STEPS[step]}</h2>
        {error && <Alert tone="danger" className="mt-5">{error}</Alert>}
        <div className="mt-6 space-y-5">
          {step === 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="First name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} required />
                <Input label="Last name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <Input label="School" placeholder="e.g. University of Michigan" value={f.school} onChange={(e) => set("school", e.target.value)} required />
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Major" placeholder="e.g. Economics" value={f.major} onChange={(e) => set("major", e.target.value)} required />
                <Input label="Graduation year" type="number" min={1990} max={2040} value={f.graduationYear} onChange={(e) => set("graduationYear", e.target.value)} required />
              </div>
              <Input label="Location" optional placeholder="City, State" value={f.location} onChange={(e) => set("location", e.target.value)} />
            </>
          )}
          {step === 1 && (
            <>
              <Select label="Target industry" value={f.targetIndustry} onChange={(e) => set("targetIndustry", e.target.value)}>
                {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
              </Select>
              <TagInput label="Target roles" value={f.targetRoles} onChange={(v) => set("targetRoles", v)} placeholder="Type a role and press Enter" suggestions={ROLE_SUGGESTIONS} />
              <Select label="Experience level" value={f.experienceLevel} onChange={(e) => set("experienceLevel", e.target.value)}>
                {EXPERIENCE_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
              </Select>
              <TagInput label="Companies you're interested in (optional)" value={f.companies} onChange={(v) => set("companies", v)} placeholder="e.g. Google, Goldman Sachs" max={10} />
            </>
          )}
          {step === 2 && (
            <>
              <p className="text-sm text-ink-600">Your resume lets the AI ask about your real experience. It&apos;s stored privately. Only you and an interviewer you&apos;re matched with can view it.</p>
              {resume ? (
                <Alert tone="success" title="Resume uploaded" action={<Button size="sm" variant="secondary" onClick={() => setResume(null)}>Replace</Button>}>
                  {resume.fileName}{resume.parsed ? ": parsed for question customization." : ": we couldn't read text from it."}
                </Alert>
              ) : (
                <ResumeUploader onUploaded={setResume} />
              )}
              <p className="text-xs text-ink-500">You can skip this and upload later.</p>
            </>
          )}
          {step === 3 && <ChipGroup label="What are you preparing for?" options={GOALS} value={f.goals} onChange={(v) => set("goals", v)} />}
          {step === 4 && (
            <ChipGroup
              label="Which interview types do you want to practice?"
              options={INTERVIEW_TYPES.map((t) => ({ value: t, label: LABELS.type[t] }))}
              value={f.interviewPreferences}
              onChange={(v) => set("interviewPreferences", v)}
            />
          )}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
          <Button variant="ghost" onClick={() => { setError(undefined); setStep((s) => s - 1); }} disabled={step === 0 || saving}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={next} loading={saving}>
            {step === STEPS.length - 1 ? <>Finish <CheckCircle2 className="h-4 w-4" /></> : step === 2 && !resume ? <>Skip for now <ArrowRight className="h-4 w-4" /></> : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </Card>
    </div>
  );
}

"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import { api } from "@/lib/client-api";
import { INDUSTRIES, INTERVIEW_TYPES, LABELS, ROLE_CATEGORIES } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Alert } from "@/components/ui/feedback";
import { ChipGroup, Input, Select, Textarea } from "@/components/ui/form";
import { Stepper } from "./stepper";

const STEPS = ["About you", "Experience", "What you interview for"];

export type InterviewerFormValues = {
  firstName: string;
  lastName: string;
  location: string;
  interviewerType: string;
  title: string;
  company: string;
  school: string;
  industry: string;
  yearsExperience: string;
  roles: string[];
  interviewTypes: string[];
  weeklyLimit: string;
  bio: string;
};

export function InterviewerOnboarding({ initial, editing }: { initial: InterviewerFormValues; editing?: boolean }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  const [f, setF] = useState(initial);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));

  function validate(s: number) {
    if (s === 0 && !f.firstName.trim()) return "First name is required.";
    if (s === 1 && (!f.title.trim() || !f.industry)) return "Add your title and industry.";
    if (s === 2 && (!f.roles.length || !f.interviewTypes.length)) return "Pick at least one role and one interview type.";
  }

  async function next() {
    const v = validate(step);
    if (v) return setError(v);
    setError(undefined);
    if (step < STEPS.length - 1) return setStep(step + 1);
    setSaving(true);
    try {
      const res = await api<{ redirect: string }>("/api/onboarding", {
        body: { ...f, yearsExperience: Number(f.yearsExperience || 0), weeklyLimit: Number(f.weeklyLimit || 5), timezone: Intl.DateTimeFormat().resolvedOptions().timeZone },
      });
      router.push(editing ? "/profile" : res.redirect);
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
                <Input label="First name" value={f.firstName} onChange={(e) => set("firstName", e.target.value)} />
                <Input label="Last name" value={f.lastName} onChange={(e) => set("lastName", e.target.value)} />
              </div>
              <ChipGroup single label="I am a…" options={[{ value: "student", label: "Student" }, { value: "alumni", label: "Alum" }, { value: "professional", label: "Professional" }]} value={[f.interviewerType]} onChange={(v) => set("interviewerType", v[0] ?? "professional")} />
              <Input label="Location" optional placeholder="City, State" value={f.location} onChange={(e) => set("location", e.target.value)} />
              <Textarea label="Short bio" optional value={f.bio} onChange={(e) => set("bio", e.target.value)} placeholder="Shown to candidates after they're matched with you." maxLength={600} />
            </>
          )}
          {step === 1 && (
            <>
              <Input label="Professional title" placeholder={f.interviewerType === "student" ? "e.g. Finance Club VP, Senior at NYU" : "e.g. Senior Product Manager"} value={f.title} onChange={(e) => set("title", e.target.value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Select label="Industry" value={f.industry} onChange={(e) => set("industry", e.target.value)}>
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </Select>
                <Input label="Years of experience" type="number" min={0} max={60} value={f.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value)} />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input label="Company" optional value={f.company} onChange={(e) => set("company", e.target.value)} hint="Never shown to candidates without your consent." />
                <Input label="School" optional value={f.school} onChange={(e) => set("school", e.target.value)} />
              </div>
            </>
          )}
          {step === 2 && (
            <>
              <ChipGroup label="Roles you can interview for" options={ROLE_CATEGORIES.map((r) => ({ value: r.value, label: r.label }))} value={f.roles} onChange={(v) => set("roles", v)} />
              <ChipGroup label="Interview types" options={INTERVIEW_TYPES.map((t) => ({ value: t, label: LABELS.type[t] }))} value={f.interviewTypes} onChange={(v) => set("interviewTypes", v)} />
              <Input label="Max interviews per week" type="number" min={1} max={40} value={f.weeklyLimit} onChange={(e) => set("weeklyLimit", e.target.value)} hint="We won't match you beyond this limit." />
            </>
          )}
        </div>
        <div className="mt-8 flex items-center justify-between border-t border-ink-100 pt-6">
          <Button variant="ghost" onClick={() => { setError(undefined); setStep((s) => s - 1); }} disabled={step === 0 || saving}>
            <ArrowLeft className="h-4 w-4" /> Back
          </Button>
          <Button onClick={next} loading={saving}>
            {step === STEPS.length - 1 ? <>{editing ? "Save profile" : "Finish"} <CheckCircle2 className="h-4 w-4" /></> : <>Continue <ArrowRight className="h-4 w-4" /></>}
          </Button>
        </div>
      </Card>
    </div>
  );
}

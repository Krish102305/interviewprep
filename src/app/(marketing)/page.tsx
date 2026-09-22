import {
  ArrowRight, Bot, Brain, CheckCircle2, Clock, Flame, Gauge, Mic, Shuffle, ShieldCheck, Sparkles, Target, Trophy, Users, Video,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { MarketingFooter, MarketingNav } from "@/components/marketing/nav";

const problems = [
  { title: "Interview anxiety", body: "Most students walk into their first real interview having never felt real interview pressure. Nerves take over and preparation goes out the window." },
  { title: "No realistic practice", body: "Reading question lists isn't practice. Answering out loud, to someone unfamiliar, on a clock — that's what the real thing feels like." },
  { title: "Weak, vague feedback", body: "“That was good!” doesn't help you improve. You need specific, standardized feedback on what to fix and what to practice next." },
  { title: "Practicing with friends", body: "Friends are too kind, too familiar and rarely know what a strong answer sounds like for your target role." },
];

const steps = [
  { n: "01", title: "Build your profile", body: "School, target roles, resume and goals — so every interview is customized to you." },
  { n: "02", title: "Choose your interview", body: "AI or human. Behavioral, technical or a full interview. Add a company and job description." },
  { n: "03", title: "Get matched or start AI", body: "Start instantly with our AI interviewer, or get randomly matched with a student or professional." },
  { n: "04", title: "Complete the interview", body: "One question at a time, adaptive follow-ups, real pressure — in a professional video room." },
  { n: "05", title: "Get AI feedback", body: "Every interview is graded by AI on a standardized 0–100 rubric, with evidence from your own answers." },
  { n: "06", title: "Improve", body: "Track your scores over time, earn points and badges, and practice exactly what the AI recommends next." },
];

const features = [
  { icon: Video, title: "Realistic practice", body: "A serious interview room with video, a timer and questions revealed one at a time. No chatbot vibes." },
  { icon: Users, title: "Real interviewers", body: "Practice with other students, alumni and professionals who conduct interviews with an AI-prepared guide." },
  { icon: Sparkles, title: "AI customization", body: "Questions generated from your resume, the job description, the company and your experience level." },
  { icon: Shuffle, title: "Random matching", body: "Meet different interviewers, styles and backgrounds — just like the unpredictability of real recruiting." },
  { icon: Trophy, title: "Gamification", body: "Points, levels, streaks, badges and a leaderboard keep you coming back — outside the interview room." },
  { icon: Gauge, title: "AI-powered evaluation", body: "One standardized grading layer for every interview, AI or human, so your scores are comparable over time." },
];

function HeroVisual() {
  return (
    <div className="relative mx-auto w-full max-w-xl lg:max-w-none" aria-hidden>
      <div className="absolute -inset-6 -z-10 rounded-[2.5rem] bg-gradient-to-br from-olive-100 via-paper to-ink-100 blur-2xl" />
      <div className="overflow-hidden rounded-3xl border border-ink-200 bg-ink-950 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/10 px-5 py-3 text-xs text-ink-300">
          <span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-red-500" /> Live · Human Interview · Behavioral</span>
          <span className="flex items-center gap-1.5 font-mono"><Clock className="h-3.5 w-3.5" /> 12:48</span>
        </div>
        <div className="grid grid-cols-2 gap-3 p-4">
          {[
            { name: "You", tone: "from-ink-700 to-ink-800", initials: "MR" },
            { name: "Priya S. · Product Lead", tone: "from-olive-800 to-olive-900", initials: "PS" },
          ].map((p) => (
            <div key={p.name} className={`relative flex aspect-[4/3] items-center justify-center rounded-2xl bg-gradient-to-br ${p.tone}`}>
              <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/10 text-lg font-semibold text-white">{p.initials}</span>
              <span className="absolute bottom-2 left-2 rounded-md bg-black/40 px-2 py-0.5 text-[10px] text-white">{p.name}</span>
              <Mic className="absolute bottom-2 right-2 h-3.5 w-3.5 text-white/70" />
            </div>
          ))}
        </div>
        <div className="mx-4 mb-4 rounded-2xl bg-white p-4">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-olive-700">Question 4 of 8</p>
            <div className="flex gap-1">{Array.from({ length: 8 }).map((_, i) => <span key={i} className={`h-1 w-4 rounded-full ${i < 4 ? "bg-olive-600" : "bg-ink-200"}`} />)}</div>
          </div>
          <p className="mt-2 text-sm font-medium leading-relaxed text-ink-900">“Tell me about a time you had to lead a team through a difficult situation.”</p>
        </div>
      </div>
      <div className="absolute -bottom-6 -left-4 hidden w-56 rounded-2xl border border-ink-200 bg-white p-4 shadow-lift sm:block lg:-left-10">
        <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">AI Evaluation</p>
        <div className="mt-2 flex items-end gap-2">
          <span className="text-3xl font-semibold tracking-tight text-ink-950">84</span>
          <span className="mb-1 text-xs text-ink-500">/ 100</span>
          <span className="mb-1 ml-auto rounded-md bg-olive-50 px-1.5 py-0.5 text-[10px] font-semibold text-olive-800">+9</span>
        </div>
        {[["Communication", 88], ["Structure", 79], ["Confidence", 83]].map(([k, v]) => (
          <div key={k} className="mt-2">
            <div className="flex justify-between text-[10px] text-ink-500"><span>{k}</span><span>{v}</span></div>
            <div className="mt-1 h-1.5 rounded-full bg-ink-100"><div className="h-full rounded-full bg-olive-600" style={{ width: `${v}%` }} /></div>
          </div>
        ))}
      </div>
      <div className="absolute -right-3 -top-5 hidden items-center gap-2 rounded-full border border-ink-200 bg-white px-3 py-1.5 text-xs font-medium shadow-lift sm:flex">
        <Flame className="h-3.5 w-3.5 text-olive-600" /> 5-day streak
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <>
      <MarketingNav />
      <main id="main">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="container-page grid items-center gap-16 pb-24 pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-32 lg:pt-24">
            <div className="animate-fade-in">
              <p className="inline-flex items-center gap-2 rounded-full border border-olive-200 bg-olive-50 px-3 py-1 text-xs font-medium text-olive-800">
                <Sparkles className="h-3.5 w-3.5" /> AI + real people + standardized AI grading
              </p>
              <h1 className="mt-6 text-[2.75rem] font-semibold leading-[1.02] tracking-tight text-ink-950 sm:text-6xl lg:text-[4.25rem]">
                Practice like it&apos;s the <span className="font-display font-normal italic text-olive-700">real</span> interview.
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-600">
                Interview Connect combines AI-powered preparation with real interview experiences to help you perform when it matters.
              </p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <ButtonLink href="/signup" size="lg">
                  Start Practicing <ArrowRight className="h-4 w-4" />
                </ButtonLink>
                <ButtonLink href="/signup?role=interviewer" size="lg" variant="secondary">
                  Become an Interviewer
                </ButtonLink>
              </div>
              <dl className="mt-10 grid max-w-lg grid-cols-3 gap-6 border-t border-ink-200 pt-6">
                {[["2 modes", "AI or human interviewer"], ["3 types", "Behavioral · Technical · Full"], ["0–100", "Standardized AI score"]].map(([k, v]) => (
                  <div key={k}>
                    <dt className="text-xl font-semibold tracking-tight text-ink-950">{k}</dt>
                    <dd className="mt-1 text-xs leading-snug text-ink-500">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            <HeroVisual />
          </div>
        </section>

        {/* Problem */}
        <section className="border-y border-ink-200/70 bg-white py-24" aria-labelledby="problem-title">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow">The problem</p>
              <h2 id="problem-title" className="mt-3 text-3xl font-semibold text-ink-950 sm:text-4xl">Talent isn&apos;t the gap. Practice is.</h2>
              <p className="mt-4 text-ink-600">Students prepare for interviews in ways that never recreate the real thing — so the first real pressure they feel is on the day that counts.</p>
            </div>
            <div className="mt-12 grid gap-px overflow-hidden rounded-2xl border border-ink-200 bg-ink-200 sm:grid-cols-2 lg:grid-cols-4">
              {problems.map((p, i) => (
                <div key={p.title} className="bg-white p-6">
                  <span className="font-display text-3xl italic text-olive-600">{String(i + 1).padStart(2, "0")}</span>
                  <h3 className="mt-4 font-semibold text-ink-950">{p.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{p.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The choice */}
        <section className="py-24" aria-labelledby="choice-title">
          <div className="container-page">
            <div className="mx-auto max-w-2xl text-center">
              <p className="eyebrow">One simple choice</p>
              <h2 id="choice-title" className="mt-3 text-3xl font-semibold text-ink-950 sm:text-4xl">How do you want to practice?</h2>
            </div>
            <div className="mx-auto mt-12 grid max-w-4xl gap-5 md:grid-cols-2">
              <div className="rounded-3xl border border-ink-200 bg-white p-8 shadow-card">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-900 text-white"><Bot className="h-6 w-6" /></span>
                <h3 className="mt-6 text-xl font-semibold">AI Interview</h3>
                <p className="mt-2 text-ink-600">Practice with an AI interviewer anytime. It introduces itself, asks one question at a time and adapts follow-ups to what you actually say.</p>
                <ul className="mt-6 space-y-2 text-sm text-ink-700">
                  {["Available 24/7, starts instantly", "Adaptive follow-up questions", "Voice answers with live transcription"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />{t}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-3xl border border-ink-900 bg-ink-950 p-8 text-white shadow-lift">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-olive-500 text-white"><Users className="h-6 w-6" /></span>
                <h3 className="mt-6 text-xl font-semibold">Human Interview</h3>
                <p className="mt-2 text-ink-300">Practice with a real person — another student, an alum or a professional — who runs your interview from an AI-generated guide you never see.</p>
                <ul className="mt-6 space-y-2 text-sm text-ink-200">
                  {["Random matching for real unpredictability", "Live video, real pressure", "Optional interviewer feedback in your report"].map((t) => (
                    <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-olive-300" />{t}</li>
                  ))}
                </ul>
              </div>
            </div>
            <p className="mt-8 text-center text-sm text-ink-500">
              Then choose what to practice: <strong className="font-semibold text-ink-800">Behavioral</strong>, <strong className="font-semibold text-ink-800">Technical</strong> or a <strong className="font-semibold text-ink-800">Full Interview</strong>.
            </p>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="scroll-mt-20 bg-ink-950 py-24 text-white" aria-labelledby="how-title">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-olive-300">How it works</p>
              <h2 id="how-title" className="mt-3 text-3xl font-semibold sm:text-4xl">From profile to progress in six steps.</h2>
            </div>
            <ol className="mt-14 grid gap-x-10 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
              {steps.map((s) => (
                <li key={s.n} className="border-t border-white/15 pt-6">
                  <span className="font-display text-4xl italic text-olive-300">{s.n}</span>
                  <h3 className="mt-4 text-lg font-semibold">{s.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-300">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* Why */}
        <section id="why" className="scroll-mt-20 py-24" aria-labelledby="why-title">
          <div className="container-page">
            <div className="max-w-2xl">
              <p className="eyebrow">Why Interview Connect?</p>
              <h2 id="why-title" className="mt-3 text-3xl font-semibold text-ink-950 sm:text-4xl">Not another interview chatbot.</h2>
              <p className="mt-4 text-ink-600">AI handles the preparation, customization, follow-ups, evaluation and recommendations. People bring real interaction, unpredictability and pressure.</p>
            </div>
            <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {features.map((f) => (
                <div key={f.title} className="rounded-2xl border border-ink-200 bg-white p-6 shadow-card transition hover:shadow-lift">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-olive-50 text-olive-700"><f.icon className="h-5 w-5" /></span>
                  <h3 className="mt-5 font-semibold text-ink-950">{f.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-600">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Grading */}
        <section id="grading" className="scroll-mt-20 border-y border-ink-200/70 bg-white py-24" aria-labelledby="grading-title">
          <div className="container-page grid items-center gap-14 lg:grid-cols-2">
            <div>
              <p className="eyebrow">Every interview is graded by AI</p>
              <h2 id="grading-title" className="mt-3 text-3xl font-semibold text-ink-950 sm:text-4xl">One standard. Every interview.</h2>
              <p className="mt-4 text-ink-600">Whether an AI or a person interviews you, the same AI grading layer evaluates your transcript against a role-specific rubric. Human interviewers add notes — they never set your score.</p>
              <ul className="mt-8 space-y-4">
                {[
                  { icon: Target, t: "STAR analysis", d: "Pinpoints missing or weak Situation, Task, Action and Result." },
                  { icon: Brain, t: "Role-aware technical grading", d: "Finance, product, engineering, consulting and marketing rubrics." },
                  { icon: Sparkles, t: "Evidence, not guesses", d: "Feedback quotes your actual answers — nothing is fabricated." },
                ].map((x) => (
                  <li key={x.t} className="flex gap-4">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-ink-900 text-white"><x.icon className="h-4 w-4" /></span>
                    <div>
                      <p className="font-medium text-ink-900">{x.t}</p>
                      <p className="text-sm text-ink-600">{x.d}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-3xl border border-ink-200 bg-paper p-6 sm:p-8" aria-label="Sample feedback report">
              <p className="eyebrow">Your interview results</p>
              <div className="mt-4 flex items-end gap-3">
                <span className="text-5xl font-semibold tracking-tight">82</span>
                <span className="mb-2 text-sm text-ink-500">/ 100 overall</span>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[["Communication", 86], ["Technical", 79], ["Confidence", 81], ["Problem Solving", 83], ["Professionalism", 88], ["Structure", 74]].map(([k, v]) => (
                  <div key={k} className="rounded-xl border border-ink-200 bg-white p-3">
                    <p className="text-[11px] text-ink-500">{k}</p>
                    <p className="text-lg font-semibold">{v}</p>
                  </div>
                ))}
              </div>
              <div className="mt-6 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                <p className="font-semibold">Area to improve</p>
                <p className="mt-1">Your answer clearly explained the situation and action you took, but the result was not specific.</p>
              </div>
            </div>
          </div>
        </section>

        {/* Interviewers + conduct */}
        <section id="interviewers" className="scroll-mt-20 py-24">
          <div className="container-page grid gap-6 lg:grid-cols-2">
            <div className="rounded-3xl bg-olive-700 p-8 text-white sm:p-10">
              <Users className="h-8 w-8 text-olive-200" />
              <h2 className="mt-6 text-2xl font-semibold sm:text-3xl">Become an interviewer</h2>
              <p className="mt-3 max-w-md text-olive-100">Students, alumni and professionals: help the next generation prepare. We generate the interview guide — you bring the real-world perspective.</p>
              <ul className="mt-6 space-y-2 text-sm text-olive-50">
                {["AI-generated question guide with suggested follow-ups", "Set your own availability", "Earn points, ratings and the Top Interviewer badge"].map((t) => (
                  <li key={t} className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-olive-200" />{t}</li>
                ))}
              </ul>
              <ButtonLink href="/signup?role=interviewer" variant="secondary" className="mt-8">Become an Interviewer</ButtonLink>
            </div>
            <div id="conduct" className="scroll-mt-20 rounded-3xl border border-ink-200 bg-white p-8 sm:p-10">
              <ShieldCheck className="h-8 w-8 text-olive-700" />
              <h2 className="mt-6 text-2xl font-semibold sm:text-3xl">Professional by design</h2>
              <p className="mt-3 text-ink-600">A fair three-strike conduct system keeps every interview serious and respectful — for students and interviewers alike.</p>
              <ul className="mt-6 space-y-3 text-sm text-ink-700">
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />Warnings first — a chance to correct course before any strike.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />Strikes only after human review of evidence. Appeals always available.</li>
                <li className="flex gap-2"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-olive-600" />Nerves, pauses, eye contact, accessibility needs or bad Wi-Fi are never misconduct.</li>
              </ul>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="pb-24">
          <div className="container-page">
            <div className="relative overflow-hidden rounded-3xl bg-ink-950 px-6 py-16 text-center text-white sm:px-16">
              <div className="absolute inset-0 -z-0 bg-[radial-gradient(ellipse_at_top,rgba(149,161,106,0.35),transparent_60%)]" />
              <div className="relative">
                <h2 className="text-3xl font-semibold sm:text-5xl">Your next interview is <span className="font-display font-normal italic text-olive-300">practice</span>.</h2>
                <p className="mx-auto mt-4 max-w-xl text-ink-300">Make the real one feel familiar. Start with an AI interview in under two minutes.</p>
                <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
                  <ButtonLink href="/signup" size="lg" variant="olive">Start Practicing <ArrowRight className="h-4 w-4" /></ButtonLink>
                  <ButtonLink href="/signup?role=interviewer" size="lg" variant="secondary">Become an Interviewer</ButtonLink>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>
      <MarketingFooter />
    </>
  );
}

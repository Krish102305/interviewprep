import type { ReactNode } from "react";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.1fr]">
      <aside className="relative hidden overflow-hidden bg-ink-950 p-12 text-white lg:flex lg:flex-col">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,rgba(149,161,106,0.35),transparent_60%)]" />
        <div className="relative"><Logo light /></div>
        <div className="relative mt-auto max-w-md">
          <p className="font-display text-4xl italic leading-tight text-olive-200">“The first time I felt real interview pressure wasn&apos;t on the day it mattered.”</p>
          <ul className="mt-10 space-y-3 text-sm text-ink-300">
            {["AI and human interviewers", "Customized to your resume and target role", "Standardized AI grading and feedback"].map((t) => (
              <li key={t} className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-olive-300" />{t}</li>
            ))}
          </ul>
        </div>
      </aside>
      <main id="main" className="flex flex-col px-5 py-8 sm:px-10">
        <div className="lg:hidden"><Logo /></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">{children}</div>
      </main>
    </div>
  );
}

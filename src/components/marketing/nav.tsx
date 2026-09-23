import Link from "next/link";
import { Logo } from "@/components/layout/logo";
import { ButtonLink } from "@/components/ui/button";
import { getSessionUser } from "@/lib/auth/session";
import { homeFor } from "@/lib/auth/guards";

export async function MarketingNav() {
  const user = await getSessionUser();
  return (
    <header className="sticky top-0 z-40 border-b border-ink-200/60 bg-paper/80 backdrop-blur">
      <div className="container-page flex h-16 items-center justify-between">
        <Logo />
        <nav aria-label="Primary" className="hidden items-center gap-8 text-sm text-ink-600 md:flex">
          <Link href="/#how-it-works" className="hover:text-ink-950">How it works</Link>
          <Link href="/#why" className="hover:text-ink-950">Why Interview Connect</Link>
          <Link href="/#grading" className="hover:text-ink-950">AI grading</Link>
          <Link href="/#interviewers" className="hover:text-ink-950">For interviewers</Link>
        </nav>
        <div className="flex items-center gap-2">
          {user ? (
            <ButtonLink href={homeFor(user)} size="sm">Go to dashboard</ButtonLink>
          ) : (
            <>
              <ButtonLink href="/login" variant="ghost" size="sm">Sign in</ButtonLink>
              <ButtonLink href="/signup" size="sm">Start practicing</ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}

export function MarketingFooter() {
  return (
    <footer className="border-t border-ink-200/70 bg-white">
      <div className="container-page flex flex-col gap-6 py-10 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Logo />
          <p className="mt-2 max-w-sm text-sm text-ink-500">Realistic interview practice with AI and real people, graded consistently by AI.</p>
        </div>
        <nav aria-label="Footer" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-ink-600">
          <Link href="/signup" className="hover:text-ink-950">Start practicing</Link>
          <Link href="/signup?role=interviewer" className="hover:text-ink-950">Become an interviewer</Link>
          <Link href="/login" className="hover:text-ink-950">Sign in</Link>
          <Link href="/#conduct" className="hover:text-ink-950">Conduct standards</Link>
        </nav>
        <p className="text-xs text-ink-400">© {new Date().getFullYear()} Interview Connect</p>
      </div>
    </footer>
  );
}

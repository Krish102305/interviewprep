import { ButtonLink } from "@/components/ui/button";
import { Logo } from "@/components/layout/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <Logo />
      <p className="mt-10 font-display text-7xl italic text-olive-600">404</p>
      <h1 className="mt-4 text-2xl font-semibold">We couldn&apos;t find that page</h1>
      <p className="mt-2 text-sm text-ink-500">It may have moved, or you may not have access to it.</p>
      <ButtonLink href="/" className="mt-6">Back to Interview Connect</ButtonLink>
    </main>
  );
}

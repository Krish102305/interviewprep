import Link from "next/link";
import { cn } from "@/lib/cn";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("h-7 w-7", className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="#18191B" />
      <circle cx="12.5" cy="16" r="5.5" fill="none" stroke="#B6BF92" strokeWidth="2.4" />
      <circle cx="19.5" cy="16" r="5.5" fill="none" stroke="#FFFFFF" strokeWidth="2.4" />
    </svg>
  );
}

export function Logo({ href = "/", className, light }: { href?: string; className?: string; light?: boolean }) {
  return (
    <Link href={href} className={cn("inline-flex items-center gap-2.5", className)} aria-label="Interview Connect home">
      <LogoMark />
      <span className={cn("text-[15px] font-semibold tracking-tight", light ? "text-white" : "text-ink-950")}>
        Interview<span className={light ? "text-olive-300" : "text-olive-600"}>Connect</span>
      </span>
    </Link>
  );
}

import { cn } from "@/lib/cn";

const palette = ["bg-olive-600", "bg-ink-700", "bg-olive-800", "bg-ink-500", "bg-olive-500"];

export function Avatar({ name, initials, size = "md", className }: { name: string; initials: string; size?: "sm" | "md" | "lg" | "xl"; className?: string }) {
  const hash = Array.from(name).reduce((h, c) => h + c.charCodeAt(0), 0);
  const sizes = { sm: "h-7 w-7 text-[10px]", md: "h-9 w-9 text-xs", lg: "h-12 w-12 text-sm", xl: "h-20 w-20 text-xl" };
  return (
    <span className={cn("inline-flex shrink-0 items-center justify-center rounded-full font-semibold text-white", palette[hash % palette.length], sizes[size], className)} aria-hidden>
      {initials}
    </span>
  );
}

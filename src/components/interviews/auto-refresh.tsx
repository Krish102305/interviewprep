"use client";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Re-renders the server page on an interval while something is pending (matching, generation, grading). */
export function AutoRefresh({ every = 5000, ping }: { every?: number; ping?: string }) {
  const router = useRouter();
  useEffect(() => {
    if (ping) fetch(ping, { method: "POST" }).catch(() => {});
    const t = setInterval(() => {
      if (document.visibilityState !== "visible") return;
      if (ping) fetch(ping, { method: "POST" }).catch(() => {});
      router.refresh();
    }, every);
    return () => clearInterval(t);
  }, [router, every, ping]);
  return null;
}

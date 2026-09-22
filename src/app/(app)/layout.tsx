import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/session";
import { AppShell } from "@/components/layout/app-shell";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (!user.onboardedAt && user.role !== "admin" && user.accountStatus === "active") redirect("/onboarding");
  return <AppShell user={user}>{children}</AppShell>;
}

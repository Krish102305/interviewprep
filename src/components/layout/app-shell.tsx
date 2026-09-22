import type { ReactNode } from "react";
import type { SessionUser } from "@/lib/auth/session";
import { fullName, initials } from "@/lib/format";
import { unreadCount } from "@/lib/services/notifications";
import { Logo } from "./logo";
import { SidebarNav, MobileNav, type NavItem } from "./sidebar-nav";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";

function navFor(user: SessionUser): NavItem[] {
  if (user.accountStatus !== "active")
    return [
      { href: "/conduct", label: "Conduct & Appeals", icon: "shield" },
      { href: "/notifications", label: "Notifications", icon: "bell" },
    ];
  if (user.role === "admin")
    return [
      { href: "/admin", label: "Overview", icon: "dashboard" },
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/interviewers", label: "Interviewers", icon: "userCheck" },
      { href: "/admin/interviews", label: "Interviews", icon: "video" },
      { href: "/admin/reports", label: "Conduct Reports", icon: "flag" },
      { href: "/admin/strikes", label: "Strikes", icon: "shieldAlert" },
      { href: "/admin/appeals", label: "Appeals", icon: "scale" },
      { href: "/admin/ratings", label: "Ratings", icon: "star" },
      { href: "/admin/analytics", label: "Analytics", icon: "chart" },
    ];
  if (user.role === "interviewer")
    return [
      { href: "/interviewer", label: "Dashboard", icon: "dashboard" },
      { href: "/interviewer/availability", label: "Availability", icon: "calendar" },
      { href: "/interviews", label: "My Interviews", icon: "video" },
      { href: "/leaderboard", label: "Leaderboard", icon: "trophy" },
      { href: "/profile", label: "Profile", icon: "user" },
      { href: "/conduct", label: "Conduct", icon: "shield" },
    ];
  return [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/interviews/new", label: "Start Interview", icon: "plus" },
    { href: "/interviews", label: "Interview History", icon: "history" },
    { href: "/performance", label: "Performance", icon: "chart" },
    { href: "/leaderboard", label: "Leaderboard", icon: "trophy" },
    { href: "/profile", label: "Profile", icon: "user" },
    { href: "/conduct", label: "Conduct", icon: "shield" },
  ];
}

export async function AppShell({ user, children }: { user: SessionUser; children: ReactNode }) {
  const items = navFor(user);
  const unread = await unreadCount(user.id);
  const name = fullName(user.profile);
  const roleLabel = user.role === "admin" ? "Admin" : user.role === "interviewer" ? "Interviewer" : "Student";
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[256px_1fr]">
      <div className="hidden border-r border-ink-200/80 bg-white lg:block">
      <aside className="sticky top-0 flex h-screen flex-col">
        <div className="px-5 py-5">
          <Logo href="/" />
        </div>
        <SidebarNav items={items} />
        <div className="mt-auto border-t border-ink-100 p-4">
          <UserMenu name={name} email={user.email} initials={initials(user.profile)} roleLabel={roleLabel} />
        </div>
      </aside>
      </div>
      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-ink-200/80 bg-paper/85 px-4 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3 lg:hidden">
            <MobileNav items={items} />
            <Logo href="/" />
          </div>
          <div className="hidden text-xs text-ink-500 lg:block">
            {user.accountStatus !== "active" ? (
              <span className="font-medium text-red-700">Account {user.accountStatus} — interview features are disabled</span>
            ) : (
              <span>{roleLabel} workspace</span>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <NotificationBell initialUnread={unread} />
            <div className="lg:hidden">
              <UserMenu name={name} email={user.email} initials={initials(user.profile)} roleLabel={roleLabel} compact />
            </div>
          </div>
        </header>
        <main id="main" className="container-page flex-1 py-8 sm:py-10">
          {children}
        </main>
      </div>
    </div>
  );
}

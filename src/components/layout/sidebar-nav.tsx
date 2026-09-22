"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Award, BarChart3, Bell, Calendar, Flag, History, LayoutDashboard, Menu, Plus, Scale, Shield, ShieldAlert, Star, Trophy, User, UserCheck, Users, Video, X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { Logo } from "./logo";

const ICONS = {
  dashboard: LayoutDashboard, users: Users, userCheck: UserCheck, video: Video, flag: Flag, shieldAlert: ShieldAlert, scale: Scale, star: Star,
  chart: BarChart3, calendar: Calendar, trophy: Trophy, user: User, shield: Shield, plus: Plus, history: History, bell: Bell, award: Award,
};
export type NavItem = { href: string; label: string; icon: keyof typeof ICONS };

function isActive(pathname: string, href: string, items: NavItem[]) {
  if (pathname === href) return true;
  if (!pathname.startsWith(`${href}/`)) return false;
  // Prefer the most specific matching item (e.g. /interviews/new over /interviews).
  return !items.some((i) => i.href !== href && i.href.startsWith(href) && (pathname === i.href || pathname.startsWith(`${i.href}/`)));
}

export function SidebarNav({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <nav aria-label="Main" className="flex-1 space-y-0.5 px-3">
      {items.map((item) => {
        const Icon = ICONS[item.icon];
        const active = isActive(pathname, item.href, items);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
              active ? "bg-ink-900 text-white" : "text-ink-600 hover:bg-ink-100 hover:text-ink-900",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function MobileNav({ items }: { items: NavItem[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => setOpen(false), [pathname]);
  return (
    <>
      <button onClick={() => setOpen(true)} className="rounded-lg p-2 text-ink-700 hover:bg-ink-100" aria-label="Open navigation" aria-expanded={open}>
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-ink-950/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 flex w-72 animate-fade-in flex-col bg-white py-4 shadow-2xl">
            <div className="mb-4 flex items-center justify-between px-5">
              <Logo />
              <button onClick={() => setOpen(false)} className="rounded-lg p-2 hover:bg-ink-100" aria-label="Close navigation">
                <X className="h-5 w-5" />
              </button>
            </div>
            <SidebarNav items={items} onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}
    </>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import {
  Zap,
  LayoutDashboard,
  Map,
  Mic,
  Briefcase,
  FileCheck,
  User,
  Bell,
  LogOut,
  ChevronRight,
} from "lucide-react";

const NAV = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/roadmap", icon: Map, label: "Roadmap" },
  { href: "/interview", icon: Mic, label: "Interview" },
  { href: "/jobs", icon: Briefcase, label: "Jobs" },
  { href: "/applications", icon: FileCheck, label: "Applications" },
  { href: "/profile", icon: User, label: "Profile" },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0d0d0d] border-r border-zinc-800/60">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800/60">
        <div className="w-6 h-6 bg-amber-500 rounded-sm flex items-center justify-center shrink-0">
          <Zap className="w-3 h-3 text-black" fill="black" />
        </div>
        <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">
          CareerForge
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors group ${
                active
                  ? "bg-zinc-800/80 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-amber-400" : "text-current"}`} />
              <span>{label}</span>
              {active && (
                <ChevronRight className="w-3 h-3 ml-auto text-zinc-600" />
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom actions */}
      <div className="px-3 py-4 border-t border-zinc-800/60 space-y-0.5">
        <Link
          href="/notifications"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
        >
          <Bell className="w-4 h-4" />
          Notifications
        </Link>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-red-400 hover:bg-red-500/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </button>
      </div>
    </aside>
  );
}

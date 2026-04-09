"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, Building2, BarChart3,
  GraduationCap, Zap,
} from "lucide-react";

const NAV = [
  { href: "/admin/dashboard", icon: LayoutDashboard, label: "Overview" },
  { href: "/admin/students", icon: Users, label: "Students" },
  { href: "/admin/drives", icon: Building2, label: "Drives" },
  { href: "/admin/analytics", icon: BarChart3, label: "Analytics" },
];

export function AdminSidebar() {
  const path = usePathname();
  return (
    <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0d0d0d] border-r border-zinc-800/60 shrink-0">
      <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800/60">
        <div className="w-6 h-6 bg-amber-500 rounded-sm flex items-center justify-center shrink-0">
          <Zap className="w-3 h-3 text-black" fill="black" />
        </div>
        <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">Admin</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV.map(({ href, icon: Icon, label }) => {
          const active = path === href || (href !== "/admin/dashboard" && path.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? "bg-zinc-800/80 text-white"
                  : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40"
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 ${active ? "text-amber-400" : ""}`} />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="px-3 py-4 border-t border-zinc-800/60">
        <Link
          href="/dashboard"
          className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors"
        >
          <GraduationCap className="w-4 h-4" />
          Student view
        </Link>
      </div>
    </aside>
  );
}

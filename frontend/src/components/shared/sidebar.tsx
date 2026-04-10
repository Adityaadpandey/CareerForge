"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Map, Mic, Briefcase, FileCheck,
  User, Bell, LogOut, ChevronLeft,
} from "lucide-react";
import { useState } from "react";

/* ── nav structure ──────────────────────────────────────────────────────── */
const SECTIONS = [
  {
    label: "Overview",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
    ],
  },
  {
    label: "Prepare",
    items: [
      { href: "/roadmap",   icon: Map,  label: "Roadmap"   },
      { href: "/interview", icon: Mic,  label: "Interview" },
    ],
  },
  {
    label: "Apply",
    items: [
      { href: "/jobs",         icon: Briefcase, label: "Jobs"         },
      { href: "/applications", icon: FileCheck, label: "Applications" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/profile",       icon: User, label: "Profile"       },
      { href: "/notifications", icon: Bell, label: "Notifications" },
    ],
  },
];

/* ── component ──────────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname  = usePathname();
  const { data: session } = useSession();
  const name     = session?.user?.name ?? "Student";
  const initials = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside className="sidebar-root hidden md:flex flex-col">
      {/* ── Logo ───────────────────────────────────────────────────── */}
      <div className="sidebar-logo">
        <div className="sidebar-brand">
          Career<span className="sidebar-brand-accent">Forge</span>
        </div>
        <div className="sidebar-subtitle">AI Career Platform</div>
      </div>

      {/* ── Nav ────────────────────────────────────────────────────── */}
      <nav className="sidebar-nav">
        {SECTIONS.map((section) => (
          <div key={section.label} className="sidebar-section">
            <div className="sidebar-section-label">{section.label}</div>

            {section.items.map(({ href, icon: Icon, label }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  className={`sidebar-link ${active ? "sidebar-link--active" : ""}`}
                >
                  {/* Active indicator line */}
                  {active && <span className="sidebar-active-indicator" />}
                  <Icon className="sidebar-link-icon" />
                  <span className="sidebar-link-label">{label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User + sign out ────────────────────────────────────────── */}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <div className="sidebar-avatar">
            <span className="sidebar-avatar-text">{initials}</span>
          </div>
          <div className="sidebar-user-info">
            <div className="sidebar-user-name">{name}</div>
            <div className="sidebar-user-role">Student</div>
          </div>
        </div>

        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-signout"
        >
          <LogOut className="sidebar-signout-icon" />
          Sign out
        </button>
      </div>

      <style>{`
        .sidebar-root {
          width: 220px;
          min-width: 220px;
          height: 100vh;
          position: sticky;
          top: 0;
          background: #0a0a0a;
          border-right: 1px solid rgba(255,255,255,0.05);
          flex-shrink: 0;
          overflow: hidden;
        }

        /* Logo */
        .sidebar-logo {
          padding: 20px 20px 16px;
          border-bottom: 1px solid rgba(255,255,255,0.05);
        }
        .sidebar-brand {
          font-family: var(--font-syne), sans-serif;
          font-weight: 800;
          font-size: 17px;
          color: #f5f5f5;
          letter-spacing: -0.02em;
          line-height: 1;
        }
        .sidebar-brand-accent {
          background: linear-gradient(135deg, #f97316, #fbbf24);
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }
        .sidebar-subtitle {
          font-size: 9px;
          color: #525252;
          letter-spacing: 0.14em;
          margin-top: 5px;
          text-transform: uppercase;
          font-family: var(--font-geist-mono), monospace;
        }

        /* Nav */
        .sidebar-nav {
          flex: 1;
          padding-top: 10px;
          overflow-y: auto;
        }
        .sidebar-nav::-webkit-scrollbar {
          width: 0;
        }
        .sidebar-section {
          margin-bottom: 4px;
        }
        .sidebar-section-label {
          font-size: 10px;
          color: #404040;
          text-transform: uppercase;
          letter-spacing: 0.14em;
          font-family: var(--font-geist-mono), monospace;
          font-weight: 500;
          padding: 10px 20px 4px;
        }

        /* Links */
        .sidebar-link {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 8px 20px;
          font-size: 13px;
          color: #737373;
          font-weight: 400;
          background: transparent;
          text-decoration: none;
          transition: all 0.15s ease;
          position: relative;
          border-radius: 0;
        }
        .sidebar-link:hover {
          color: #d4d4d4;
          background: rgba(255,255,255,0.03);
        }

        .sidebar-link--active {
          color: #fb923c;
          font-weight: 500;
          background: rgba(249,115,22,0.06);
        }
        .sidebar-link--active:hover {
          color: #fb923c;
          background: rgba(249,115,22,0.08);
        }

        .sidebar-active-indicator {
          position: absolute;
          left: 0;
          top: 6px;
          bottom: 6px;
          width: 2px;
          background: linear-gradient(180deg, #f97316, #fbbf24);
          border-radius: 0 2px 2px 0;
        }

        .sidebar-link-icon {
          width: 15px;
          height: 15px;
          flex-shrink: 0;
        }
        .sidebar-link-label {
          flex: 1;
        }

        /* Footer */
        .sidebar-footer {
          padding: 12px 14px 14px;
          border-top: 1px solid rgba(255,255,255,0.05);
        }
        .sidebar-user {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 6px 6px 10px;
        }

        .sidebar-avatar {
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: linear-gradient(135deg, rgba(249,115,22,0.15), rgba(251,191,36,0.08));
          border: 1px solid rgba(249,115,22,0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .sidebar-avatar-text {
          font-size: 11px;
          font-weight: 800;
          color: #fb923c;
          font-family: var(--font-syne), sans-serif;
        }

        .sidebar-user-info {
          flex: 1;
          min-width: 0;
        }
        .sidebar-user-name {
          font-size: 12px;
          color: #e5e5e5;
          font-weight: 500;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .sidebar-user-role {
          font-size: 10px;
          color: #525252;
          margin-top: 1px;
        }

        /* Sign out */
        .sidebar-signout {
          width: 100%;
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 7px 8px;
          font-size: 12px;
          color: #525252;
          background: transparent;
          border: none;
          cursor: pointer;
          border-radius: 8px;
          transition: all 0.15s ease;
          text-align: left;
        }
        .sidebar-signout:hover {
          background: rgba(239,68,68,0.06);
          color: #ef4444;
        }
        .sidebar-signout-icon {
          width: 13px;
          height: 13px;
        }
      `}</style>
    </aside>
  );
}

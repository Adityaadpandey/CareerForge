"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut, useSession } from "next-auth/react";
import {
  LayoutDashboard, Map, Mic, Briefcase, FileCheck,
  User, Bell, LogOut,
} from "lucide-react";

/* ── colour tokens ──────────────────────────────────────────────────────── */
const C = {
  bg:          "#0a0a0a",
  border:      "#2a2a2a",
  active_bg:   "#1c1007",
  active_text: "#fb923c",
  item_text:   "#a3a3a3",
  label:       "#525252",
  hover_bg:    "#1a1a1a",
  accent:      "#f97316",
  text_pri:    "#f5f5f5",
  danger_bg:   "#1f0a0a",
  danger_text: "#ef4444",
};

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
      { href: "/roadmap", icon: Map,  label: "Roadmap"   },
      { href: "/interview", icon: Mic, label: "Interview" },
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
      { href: "/notifications", icon: Bell, label: "Notifications", badge: 3 },
    ],
  },
];

/* ── component ──────────────────────────────────────────────────────────── */
export function Sidebar() {
  const pathname  = usePathname();
  const { data: session } = useSession();
  const name      = session?.user?.name ?? "Student";
  const initials  = name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2);

  return (
    <aside
      className="hidden md:flex flex-col"
      style={{
        width: 220,
        minWidth: 220,
        height: "100vh",
        position: "sticky",
        top: 0,
        background: C.bg,
        borderRight: `1px solid ${C.border}`,
        flexShrink: 0,
      }}
    >
      {/* ── Logo ─────────────────────────────────────────────────────────── */}
      <div style={{ padding: "18px 18px 14px", borderBottom: `1px solid ${C.border}` }}>
        <div
          style={{
            fontFamily: "var(--font-syne), sans-serif",
            fontWeight: 800,
            fontSize: 16,
            color: C.text_pri,
            letterSpacing: "-0.02em",
            lineHeight: 1,
          }}
        >
          Career<span style={{ color: C.accent }}>Forge</span>
        </div>
        <div
          style={{
            fontSize: 9,
            color: C.label,
            letterSpacing: "0.15em",
            marginTop: 4,
            textTransform: "uppercase",
            fontFamily: "monospace",
          }}
        >
          AI Career Platform
        </div>
      </div>

      {/* ── Nav ──────────────────────────────────────────────────────────── */}
      <nav style={{ flex: 1, paddingTop: 8, overflowY: "auto" }}>
        {SECTIONS.map((section) => (
          <div key={section.label} style={{ marginBottom: 2 }}>
            {/* Section label */}
            <div
              style={{
                fontSize: 10,
                color: C.label,
                textTransform: "uppercase",
                letterSpacing: "0.12em",
                fontFamily: "monospace",
                padding: "8px 18px 3px",
              }}
            >
              {section.label}
            </div>

            {/* Items */}
            {section.items.map(({ href, icon: Icon, label, badge }) => {
              const active = pathname === href || pathname.startsWith(href + "/");
              return (
                <Link
                  key={href}
                  href={href}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 9,
                    padding: "8px 18px",
                    fontSize: 13,
                    color: active ? C.active_text : C.item_text,
                    fontWeight: active ? 500 : 400,
                    background: active ? C.active_bg : "transparent",
                    textDecoration: "none",
                    transition: "all 0.15s ease",
                    position: "relative",
                  }}
                  className="sidebar-item"
                  data-active={active}
                >
                  <Icon size={14} strokeWidth={active ? 2 : 1.75} />
                  <span style={{ flex: 1 }}>{label}</span>
                  {badge != null && (
                    <span
                      style={{
                        background: C.danger_text,
                        color: "#fff",
                        fontSize: 9,
                        fontWeight: 700,
                        padding: "1px 5px",
                        borderRadius: 99,
                        lineHeight: 1.5,
                        letterSpacing: "0.01em",
                      }}
                    >
                      {badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* ── User + sign out ───────────────────────────────────────────────── */}
      <div style={{ padding: "10px 12px 12px", borderTop: `1px solid ${C.border}` }}>
        {/* Avatar row */}
        <div style={{ display: "flex", alignItems: "center", gap: 9, padding: "6px 6px 10px" }}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: C.active_bg,
              border: `1px solid #7c3a0a`,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: 11,
                fontWeight: 800,
                color: C.active_text,
                fontFamily: "var(--font-syne), sans-serif",
              }}
            >
              {initials}
            </span>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 12,
                color: C.text_pri,
                fontWeight: 500,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {name}
            </div>
            <div style={{ fontSize: 10, color: C.label, marginTop: 1 }}>Student</div>
          </div>
        </div>

        {/* Sign out */}
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="sidebar-signout"
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            gap: 8,
            padding: "7px 8px",
            fontSize: 12,
            color: C.label,
            background: "transparent",
            border: "none",
            cursor: "pointer",
            borderRadius: 6,
            transition: "all 0.15s ease",
            textAlign: "left",
          }}
        >
          <LogOut size={13} />
          Sign out
        </button>
      </div>

      {/* Hover styles injected once */}
      <style>{`
        .sidebar-item:not([data-active="true"]):hover {
          background: ${C.hover_bg} !important;
          color: ${C.text_pri} !important;
        }
        .sidebar-signout:hover {
          background: ${C.danger_bg} !important;
          color: ${C.danger_text} !important;
        }
      `}</style>
    </aside>
  );
}

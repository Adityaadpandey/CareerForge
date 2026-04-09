"use client";

import { useState, useEffect, useCallback } from "react";
import {
  RefreshCw, Zap, Bell, CheckCircle2, Play, Lock,
  ChevronRight, TrendingUp, TrendingDown, GitBranch,
  GitPullRequest, Star, Code2,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";

/* ── colour tokens ──────────────────────────────────────────────────────── */
const C = {
  bg:           "#0a0a0a",
  bg2:          "#111111",
  bg3:          "#1a1a1a",
  card:         "#141414",
  border:       "#2a2a2a",
  border_h:     "#3a3a3a",
  accent:       "#f97316",
  accent_bg:    "#1c1007",
  accent_brd:   "#7c3a0a",
  accent_text:  "#fb923c",
  text_pri:     "#f5f5f5",
  text_sec:     "#a3a3a3",
  text_ter:     "#525252",
  success:      "#22c55e",
  success_bg:   "#0a1f0e",
  success_brd:  "#14532d",
  warn:         "#f59e0b",
  warn_bg:      "#1c1505",
  danger:       "#ef4444",
  danger_bg:    "#1f0a0a",
  purple:       "#a855f7",
  blue:         "#3b82f6",
};

const SYNE = "var(--font-syne), sans-serif";

/* ── types ──────────────────────────────────────────────────────────────── */
type Mission = {
  id: string; title: string; type: string; status: string;
  estimatedHours: number; deadline: string | null;
};

type Connection = {
  platform: string; syncStatus: string;
  lastSyncedAt: string | null;
  parsedData: Record<string, unknown> | null;
};

type JobMatch = {
  id: string; company: string; title: string;
  matchScore: number; applyUrl: string;
  location: string | null; isRemote: boolean;
};

type ActivityItem = { dot: string; html: string; time: string };

type Readiness = {
  total: number; dsa: number; dev: number; comm: number; consistency: number;
  weakTopics: string[]; delta: number | null;
};

type DashboardData = {
  user:              { name: string | null; image: string | null };
  profile:           { targetRole: string | null; streakDays: number; segment: string; dreamCompanies: string[] };
  readiness:         Readiness | null;
  missions:          Mission[];
  connections:       Connection[];
  jobMatches:        JobMatch[];
  interviewCount:    number;
  applicationCount:  number;
  notificationCount: number;
  recentActivity:    ActivityItem[];
};

type Props = DashboardData;

/* ── GitHub parsedData shape ─────────────────────────────────────────────── */
type GHData = {
  profile?:      { public_repos?: number; followers?: number };
  repositories?: {
    total_count?:      number;
    primary_languages?:Record<string, number>;
    top_projects?:     { name: string; stars: number; total_commits: number }[];
  };
  contributions?:{ total_prs?: number; merged_prs?: number };
};

type LCData = {
  total_solved?:    number;
  easy_solved?:     number;
  medium_solved?:   number;
  hard_solved?:     number;
  contest_rating?:  number;
  global_ranking?:  number;
  handle?:          string;
};

function parseGitHub(conn: Connection | undefined): GHData | null {
  if (!conn || conn.syncStatus !== "DONE" || !conn.parsedData) return null;
  return conn.parsedData as unknown as GHData;
}

function parseLeetCode(conn: Connection | undefined): LCData | null {
  if (!conn || conn.syncStatus !== "DONE" || !conn.parsedData) return null;
  return conn.parsedData as unknown as LCData;
}

/* ── card wrapper ───────────────────────────────────────────────────────── */
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div
      style={{ background: C.card, border: `1px solid ${C.border}`, borderRadius: 12, transition: "border-color 0.15s ease", ...style }}
      className="dash-card"
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, color: C.text_ter, textTransform: "uppercase", letterSpacing: "0.12em", fontFamily: "monospace", marginBottom: 10 }}>
      {children}
    </div>
  );
}

/* ── score ring ─────────────────────────────────────────────────────────── */
function ScoreRing({ score }: { score: number }) {
  const pct = Math.max(0, Math.min(100, score));
  return (
    <div style={{ position: "relative", width: 72, height: 72, flexShrink: 0 }}>
      <div style={{ width: 72, height: 72, borderRadius: "50%", background: `conic-gradient(from -90deg, ${C.accent} 0% ${pct}%, ${C.bg3} ${pct}% 100%)` }} />
      <div style={{ position: "absolute", inset: 9, borderRadius: "50%", background: C.card, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: SYNE, fontWeight: 800, fontSize: 14, color: C.text_pri, lineHeight: 1 }}>{Math.round(score)}</span>
        <span style={{ fontSize: 8, color: C.text_ter }}>/100</span>
      </div>
    </div>
  );
}

/* ── pillar bar ─────────────────────────────────────────────────────────── */
const PILLAR_COLORS: Record<string, string> = {
  DSA: C.accent, Dev: C.success, Communication: C.warn, Consistency: C.purple,
};

function PillarBar({ name, score }: { name: string; score: number }) {
  const color = PILLAR_COLORS[name] ?? C.accent;
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: C.text_ter, marginBottom: 5 }}>
        <span>{name}</span><span style={{ color }}>{Math.round(score)}</span>
      </div>
      <div style={{ height: 5, background: C.bg3, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${score}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.7s ease" }} />
      </div>
    </div>
  );
}

/* ── metric card ────────────────────────────────────────────────────────── */
function MetricCard({ label, value, valueColor, sub }: { label: string; value: string | number; valueColor: string; sub: string }) {
  return (
    <Card style={{ padding: 14 }}>
      <SectionLabel>{label}</SectionLabel>
      <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 22, color: valueColor, lineHeight: 1, marginBottom: 5 }}>{value}</div>
      <div style={{ fontSize: 11, color: C.text_ter }}>{sub}</div>
    </Card>
  );
}

/* ── mission type tag ───────────────────────────────────────────────────── */
const TYPE_TAG: Record<string, { bg: string; color: string; label: string }> = {
  BUILD:      { bg: "#2e1065", color: "#c084fc", label: "Build" },
  SOLVE:      { bg: "#0c1a3d", color: "#60a5fa", label: "Solve" },
  COMMUNICATE:{ bg: C.success_bg, color: "#4ade80", label: "Comm" },
};

function TypeTag({ type }: { type: string }) {
  const cfg = TYPE_TAG[type] ?? { bg: C.bg3, color: C.text_sec, label: type };
  return (
    <span style={{ background: cfg.bg, color: cfg.color, fontSize: 10, padding: "2px 6px", borderRadius: 99 }}>{cfg.label}</span>
  );
}

/* ── mission item ───────────────────────────────────────────────────────── */
function MissionItem({ mission }: { mission: Mission }) {
  const done   = mission.status === "COMPLETED";
  const active = mission.status === "IN_PROGRESS" || mission.status === "AVAILABLE";
  const locked = mission.status === "LOCKED";

  const bg        = done ? C.success_bg : active ? C.accent_bg : "transparent";
  const brd       = done ? C.success_brd : active ? C.accent_brd : C.border;
  const color     = done ? C.success : active ? C.accent_text : C.text_pri;
  const iconBg    = done ? C.success : active ? C.accent : C.bg3;
  const iconColor = done || active ? "#fff" : C.text_ter;
  const Icon      = done ? CheckCircle2 : active ? Play : Lock;

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 10px", background: bg, border: `1px solid ${brd}`, borderRadius: 8, opacity: locked ? 0.4 : 1 }}>
      <div style={{ width: 24, height: 24, borderRadius: "50%", background: iconBg, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <Icon size={11} color={iconColor} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 500, color, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 3 }}>{mission.title}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <TypeTag type={mission.type} />
          <span style={{ fontSize: 10, color: C.text_ter }}>{mission.estimatedHours}h</span>
        </div>
      </div>
    </div>
  );
}

/* ── activity dot grid ──────────────────────────────────────────────────── */
function ActivityDotGrid({ streakDays }: { streakDays: number }) {
  const TOTAL = 28;
  const dots  = Array.from({ length: TOTAL }, (_, i) => {
    const fromEnd = TOTAL - 1 - i;
    if (fromEnd < streakDays) return C.accent;
    if (fromEnd < streakDays + 7) return C.accent_brd;
    return C.bg3;
  });
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 12px)", gap: 4 }}>
      {dots.map((color, i) => <div key={i} style={{ width: 12, height: 12, borderRadius: 3, background: color }} />)}
    </div>
  );
}

/* ── weak topics ────────────────────────────────────────────────────────── */
const SEVERITY: Record<string, { color: string; pct: number }> = {
  "Binary Trees":        { color: C.danger, pct: 85 },
  "Dynamic Programming": { color: C.danger, pct: 78 },
  "System Design":       { color: C.warn,   pct: 62 },
  "Graphs":              { color: C.warn,   pct: 55 },
  "Behavioral":          { color: C.success,pct: 38 },
  "Recursion":           { color: C.success,pct: 28 },
};

function WeakBar({ topic }: { topic: string }) {
  const cfg = SEVERITY[topic] ?? { color: C.warn, pct: 50 };
  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
        <span style={{ color: C.text_sec }}>{topic}</span>
        <span style={{ color: cfg.color }}>{cfg.pct}%</span>
      </div>
      <div style={{ height: 4, background: C.bg3, borderRadius: 99, overflow: "hidden" }}>
        <div style={{ width: `${cfg.pct}%`, height: "100%", background: cfg.color, borderRadius: 99 }} />
      </div>
    </div>
  );
}

/* ── topbar ─────────────────────────────────────────────────────────────── */
function Topbar({
  firstName, targetRole, streakDays, notificationCount, lastRefreshed, onRefresh, refreshing,
}: {
  firstName: string; targetRole: string | null; streakDays: number;
  notificationCount: number; lastRefreshed: Date | null; onRefresh: () => void; refreshing: boolean;
}) {
  return (
    <div style={{ height: 52, background: C.bg, borderBottom: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 22px", position: "sticky", top: 0, zIndex: 10, flexShrink: 0 }}>
      <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 16, color: C.text_pri }}>
        Hey, {firstName} 👋
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {lastRefreshed && (
          <div style={{ fontSize: 10, color: C.text_ter }}>
            Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
          </div>
        )}

        {/* Manual refresh */}
        <button
          onClick={onRefresh}
          disabled={refreshing}
          style={{ width: 32, height: 32, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.text_sec, opacity: refreshing ? 0.5 : 1, transition: "all 0.15s ease" }}
          title="Refresh data"
        >
          <RefreshCw size={13} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
        </button>

        {/* Streak chip */}
        <div style={{ background: C.success_bg, color: C.success, border: `1px solid ${C.success_brd}`, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 99, display: "flex", alignItems: "center", gap: 5 }}>
          🔥 {streakDays}d streak
        </div>

        {/* Target chip */}
        {targetRole && (
          <div style={{ background: C.bg2, color: C.text_sec, border: `1px solid ${C.border}`, fontSize: 11, padding: "4px 10px", borderRadius: 99 }}>
            → {targetRole}
          </div>
        )}

        {/* Bell */}
        <div style={{ position: "relative" }}>
          <Link href="/notifications" style={{ width: 32, height: 32, background: C.card, border: `1px solid ${C.border}`, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: C.text_sec, textDecoration: "none" }} className="dash-card">
            <Bell size={14} />
          </Link>
          {notificationCount > 0 && (
            <div style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: 99, background: C.accent, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <span style={{ fontSize: 8, fontWeight: 700, color: "#000", padding: "0 3px" }}>{notificationCount > 9 ? "9+" : notificationCount}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── readiness card ─────────────────────────────────────────────────────── */
function ReadinessCard({ readiness }: { readiness: Readiness | null }) {
  const pillars = readiness ? [
    { name: "DSA",           score: readiness.dsa          },
    { name: "Dev",           score: readiness.dev          },
    { name: "Communication", score: readiness.comm         },
    { name: "Consistency",   score: readiness.consistency  },
  ] : [];

  return (
    <Card style={{ padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionLabel>Readiness Score</SectionLabel>
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        {readiness
          ? <ScoreRing score={readiness.total} />
          : <div style={{ width: 72, height: 72, borderRadius: "50%", background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center" }}><span style={{ color: C.text_ter, fontSize: 20, fontFamily: SYNE }}>—</span></div>
        }
        <div>
          {readiness ? (
            <>
              <div style={{ fontFamily: SYNE, fontWeight: 800, fontSize: 28, color: C.text_pri, lineHeight: 1 }}>{Math.round(readiness.total)}</div>
              {readiness.delta !== null && (
                <div style={{ fontSize: 11, color: readiness.delta >= 0 ? C.success : C.danger, display: "flex", alignItems: "center", gap: 3, marginTop: 3 }}>
                  {readiness.delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                  {readiness.delta >= 0 ? "+" : ""}{readiness.delta.toFixed(1)} this week
                </div>
              )}
              <div style={{ fontSize: 10, color: C.text_ter, marginTop: 4 }}>Target: 85 · {readiness.total >= 75 ? "On track" : "Needs work"}</div>
            </>
          ) : (
            <div style={{ fontSize: 12, color: C.text_ter, lineHeight: 1.5 }}>Score appears after<br />analysis runs</div>
          )}
        </div>
      </div>
      {pillars.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {pillars.map((p) => <PillarBar key={p.name} name={p.name} score={p.score} />)}
        </div>
      )}
    </Card>
  );
}

/* ── missions panel ─────────────────────────────────────────────────────── */
function MissionsPanel({ missions }: { missions: Mission[] }) {
  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text_pri }}>Roadmap Missions</div>
        <Link href="/roadmap" style={{ fontSize: 11, color: C.accent_text, textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>View all <ChevronRight size={11} /></Link>
      </div>
      {missions.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {missions.map((m) => <MissionItem key={m.id} mission={m} />)}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0", fontSize: 12, color: C.text_ter }}>
          Missions appear after gap analysis runs
        </div>
      )}
    </Card>
  );
}

/* ── job matches panel ──────────────────────────────────────────────────── */
function JobMatchesPanel({ jobMatches }: { jobMatches: JobMatch[] }) {
  const display = jobMatches.length > 0 ? jobMatches : null;

  return (
    <Card style={{ padding: 16, display: "flex", flexDirection: "column" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text_pri }}>Job Matches</div>
        <Link href="/jobs" style={{ fontSize: 11, color: C.accent_text, textDecoration: "none", display: "flex", alignItems: "center", gap: 2 }}>See all <ChevronRight size={11} /></Link>
      </div>

      {display ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
          {display.map((j) => {
            const matchBg    = j.matchScore > 75 ? C.success_bg : C.warn_bg;
            const matchColor = j.matchScore > 75 ? C.success    : C.warn;
            return (
              <div key={j.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: `1px solid ${C.border}` }}>
                <div style={{ width: 28, height: 28, borderRadius: 8, background: C.bg3, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: C.text_sec }}>{j.company[0]}</span>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: C.text_pri }}>{j.title}</div>
                  <div style={{ fontSize: 11, color: C.text_ter }}>{j.company}{j.location ? ` · ${j.location}` : j.isRemote ? " · Remote" : ""}</div>
                </div>
                <div style={{ background: matchBg, color: matchColor, fontSize: 10, fontWeight: 600, padding: "2px 7px", borderRadius: 99 }}>
                  {Math.round(j.matchScore)}%
                </div>
                <a href={j.applyUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 10, color: C.accent_text, background: "transparent", border: `1px solid ${C.accent_brd}`, borderRadius: 6, padding: "3px 8px", cursor: "pointer", textDecoration: "none", flexShrink: 0 }}>
                  Apply
                </a>
              </div>
            );
          })}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 12, color: C.text_ter, marginBottom: 8 }}>No matches yet</div>
          <div style={{ fontSize: 11, color: C.text_ter }}>Run analysis to get personalized job matches</div>
        </div>
      )}

      <div style={{ marginTop: 12, background: C.accent_bg, border: `1px solid ${C.accent_brd}`, borderRadius: 8, padding: "10px 12px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontSize: 11, color: C.accent_text }}>Generate a tailored CV for any role</span>
        <button style={{ background: C.accent, color: "#000", fontWeight: 600, fontSize: 11, border: "none", borderRadius: 6, padding: "5px 12px", cursor: "pointer", whiteSpace: "nowrap" }}>
          Auto-generate
        </button>
      </div>
    </Card>
  );
}

/* ── github stats panel ─────────────────────────────────────────────────── */
function GitHubStatsPanel({ conn }: { conn: Connection | undefined }) {
  const gh = parseGitHub(conn);

  const totalCommits = gh?.repositories?.top_projects?.reduce((s, p) => s + (p.total_commits ?? 0), 0) ?? 0;
  const topLangs     = Object.keys(gh?.repositories?.primary_languages ?? {}).slice(0, 3);
  const topProject   = gh?.repositories?.top_projects?.[0] ?? null;
  const publicRepos  = gh?.profile?.public_repos ?? 0;
  const totalPRs     = gh?.contributions?.total_prs ?? 0;
  const mergedPRs    = gh?.contributions?.merged_prs ?? 0;
  const syncing      = conn?.syncStatus === "SYNCING" || conn?.syncStatus === "PENDING";
  const failed       = conn?.syncStatus === "FAILED";
  const noConn       = !conn;

  return (
    <Card style={{ padding: 16 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <svg width="14" height="14" viewBox="0 0 16 16" fill={C.text_sec}>
            <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
          </svg>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text_pri }}>GitHub</span>
        </div>
        {conn?.lastSyncedAt && (
          <span style={{ fontSize: 10, color: C.text_ter }}>
            {new Date(conn.lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {syncing && <div style={{ fontSize: 10, color: C.warn, display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} /> Syncing…</div>}
        {failed  && <div style={{ fontSize: 10, color: C.danger }}>Sync failed</div>}
      </div>

      {noConn ? (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: C.text_ter }}>
          Connect GitHub in <Link href="/profile" style={{ color: C.accent_text, textDecoration: "none" }}>profile</Link>
        </div>
      ) : !gh ? (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: C.text_ter }}>
          {syncing ? "Analysing your GitHub…" : "No data yet"}
        </div>
      ) : (
        <>
          {/* Key stats row */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 12 }}>
            {[
              { icon: <GitBranch size={11} />, label: "Repos",   value: publicRepos,  color: C.blue   },
              { icon: <Code2      size={11} />, label: "Commits", value: totalCommits, color: C.accent },
              { icon: <GitPullRequest size={11} />, label: "PRs", value: totalPRs,    color: C.purple  },
            ].map((s) => (
              <div key={s.label} style={{ background: C.bg3, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 4, color: s.color, marginBottom: 3 }}>
                  {s.icon}
                  <span style={{ fontSize: 9, color: C.text_ter, textTransform: "uppercase", letterSpacing: "0.08em" }}>{s.label}</span>
                </div>
                <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 16, color: C.text_pri }}>{s.value}</div>
              </div>
            ))}
          </div>

          {/* Languages */}
          {topLangs.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginBottom: 10 }}>
              {topLangs.map((lang) => (
                <span key={lang} style={{ fontSize: 10, padding: "2px 7px", borderRadius: 99, background: C.bg3, color: C.text_sec }}>
                  {lang}
                </span>
              ))}
            </div>
          )}

          {/* Top project */}
          {topProject && (
            <div style={{ background: C.bg3, borderRadius: 8, padding: "8px 10px", display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 11, fontWeight: 500, color: C.text_pri, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{topProject.name}</div>
                <div style={{ fontSize: 10, color: C.text_ter, marginTop: 2 }}>{topProject.total_commits} commits</div>
              </div>
              {topProject.stars > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 3, color: C.warn }}>
                  <Star size={10} />
                  <span style={{ fontSize: 10 }}>{topProject.stars}</span>
                </div>
              )}
            </div>
          )}

          {/* PR merge rate */}
          {totalPRs > 0 && (
            <div style={{ marginTop: 10, fontSize: 10, color: C.text_ter }}>
              PR merge rate: <span style={{ color: mergedPRs / totalPRs > 0.7 ? C.success : C.warn }}>{Math.round((mergedPRs / totalPRs) * 100)}%</span>
              {" "}({mergedPRs}/{totalPRs} merged)
            </div>
          )}
        </>
      )}
    </Card>
  );
}

/* ── leetcode stats panel ────────────────────────────────────────────────── */
function LeetCodeStatsPanel({ conn }: { conn: Connection | undefined }) {
  const lc = parseLeetCode(conn);
  const syncing = conn?.syncStatus === "SYNCING" || conn?.syncStatus === "PENDING";
  const noConn  = !conn;

  const total  = lc?.total_solved  ?? 0;
  const easy   = lc?.easy_solved   ?? 0;
  const medium = lc?.medium_solved ?? 0;
  const hard   = lc?.hard_solved   ?? 0;

  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <div style={{ width: 14, height: 14, borderRadius: 3, background: "#ffa116", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontSize: 8, fontWeight: 800, color: "#1a1a1a" }}>LC</span>
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: C.text_pri }}>LeetCode</span>
        </div>
        {conn?.lastSyncedAt && (
          <span style={{ fontSize: 10, color: C.text_ter }}>
            {new Date(conn.lastSyncedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
        {syncing && <div style={{ fontSize: 10, color: C.warn, display: "flex", alignItems: "center", gap: 4 }}><RefreshCw size={10} style={{ animation: "spin 1s linear infinite" }} /> Syncing…</div>}
      </div>

      {noConn ? (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: C.text_ter }}>
          Connect LeetCode in <Link href="/profile" style={{ color: C.accent_text, textDecoration: "none" }}>profile</Link>
        </div>
      ) : !lc ? (
        <div style={{ textAlign: "center", padding: "16px 0", fontSize: 11, color: C.text_ter }}>
          {syncing ? "Fetching LeetCode stats…" : "No data yet"}
        </div>
      ) : (
        <>
          {/* Total */}
          <div style={{ textAlign: "center", marginBottom: 14 }}>
            <div style={{ fontFamily: SYNE, fontWeight: 800, fontSize: 32, color: C.text_pri, lineHeight: 1 }}>{total}</div>
            <div style={{ fontSize: 10, color: C.text_ter, marginTop: 3 }}>problems solved</div>
          </div>

          {/* Difficulty breakdown */}
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
            {[
              { label: "Easy",   value: easy,   color: C.success },
              { label: "Medium", value: medium, color: C.warn    },
              { label: "Hard",   value: hard,   color: C.danger  },
            ].map((d) => (
              <div key={d.label}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, marginBottom: 4 }}>
                  <span style={{ color: d.color }}>{d.label}</span>
                  <span style={{ color: C.text_ter }}>{d.value}</span>
                </div>
                <div style={{ height: 5, background: C.bg3, borderRadius: 99, overflow: "hidden" }}>
                  <div style={{ width: total > 0 ? `${(d.value / total) * 100}%` : "0%", height: "100%", background: d.color, borderRadius: 99 }} />
                </div>
              </div>
            ))}
          </div>

          {/* Rating + ranking */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {lc.contest_rating && (
              <div style={{ background: C.bg3, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: C.text_ter, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Contest</div>
                <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 15, color: C.warn }}>{Math.round(lc.contest_rating)}</div>
              </div>
            )}
            {lc.global_ranking && (
              <div style={{ background: C.bg3, borderRadius: 8, padding: "8px 10px" }}>
                <div style={{ fontSize: 9, color: C.text_ter, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>Rank</div>
                <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 15, color: C.text_sec }}>
                  {lc.global_ranking.toLocaleString()}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

/* ── activity streak panel ──────────────────────────────────────────────── */
function ActivityStreakPanel({ streakDays }: { streakDays: number }) {
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text_pri }}>Activity Streak</div>
        <div style={{ fontSize: 11, color: C.success, fontWeight: 600 }}>🔥 {streakDays} days</div>
      </div>
      <ActivityDotGrid streakDays={streakDays} />
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 14 }}>
        <div style={{ background: C.bg3, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 16, color: C.text_pri }}>{streakDays}</div>
          <div style={{ fontSize: 10, color: C.text_ter, marginTop: 2 }}>Current streak</div>
        </div>
        <div style={{ background: C.bg3, borderRadius: 8, padding: "10px 12px" }}>
          <div style={{ fontFamily: SYNE, fontWeight: 700, fontSize: 16, color: C.text_pri }}>—</div>
          <div style={{ fontSize: 10, color: C.text_ter, marginTop: 2 }}>Best streak</div>
        </div>
      </div>
    </Card>
  );
}

/* ── weak topics panel ──────────────────────────────────────────────────── */
function WeakTopicsPanel({ weakTopics }: { weakTopics: string[] }) {
  const topics = weakTopics.length > 0 ? weakTopics.slice(0, 6) : Object.keys(SEVERITY).slice(0, 6);
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: C.text_pri }}>Weak Topics</div>
        <span style={{ fontSize: 10, color: C.accent_text, cursor: "pointer" }}>Fix these first →</span>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {topics.map((t) => <WeakBar key={t} topic={t} />)}
      </div>
    </Card>
  );
}

/* ── recent activity panel ──────────────────────────────────────────────── */
function RecentActivityPanel({ activities }: { activities: ActivityItem[] }) {
  const items = activities.length > 0 ? activities : [
    { dot: C.text_ter, html: "Your activity will appear here as you complete missions and interviews", time: "" },
  ];
  return (
    <Card style={{ padding: 16 }}>
      <div style={{ fontSize: 13, fontWeight: 600, color: C.text_pri, marginBottom: 14 }}>Recent Activity</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {items.map((a, i) => (
          <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: a.dot, marginTop: 4, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div
                style={{ fontSize: 11, color: C.text_sec, lineHeight: 1.5 }}
                dangerouslySetInnerHTML={{ __html: a.html.replace(/<b>/g, `<span style="color:${C.text_pri};font-weight:600">`).replace(/<\/b>/g, "</span>") }}
              />
              {a.time && <div style={{ fontSize: 10, color: C.text_ter, marginTop: 2 }}>{a.time}</div>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ── main export ────────────────────────────────────────────────────────── */
export function DashboardClient(initialData: Props) {
  const [data,         setData]         = useState<DashboardData>(initialData);
  const [triggering,   setTriggering]   = useState(false);
  const [refreshing,   setRefreshing]   = useState(false);
  const [lastRefreshed,setLastRefreshed]= useState<Date | null>(null);

  /* ── polling ──────────────────────────────────────────────────────────── */
  const fetchDashboard = useCallback(async (silent = true) => {
    if (!silent) setRefreshing(true);
    try {
      const res = await fetch("/api/dashboard", { cache: "no-store" });
      if (res.ok) {
        const fresh = await res.json();
        setData(fresh);
        setLastRefreshed(new Date());
      }
    } catch {
      /* network error — keep showing stale data */
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const syncing = data.connections.some((c) => c.syncStatus === "SYNCING" || c.syncStatus === "PENDING");
    const interval = syncing ? 10_000 : 60_000;
    const id = setInterval(() => fetchDashboard(true), interval);
    return () => clearInterval(id);
  }, [data.connections, fetchDashboard]);

  /* ── derived ──────────────────────────────────────────────────────────── */
  const { user, profile, readiness, missions, connections, jobMatches, interviewCount, applicationCount, notificationCount, recentActivity } = data;

  const syncingCount  = connections.filter((c) => c.syncStatus === "SYNCING" || c.syncStatus === "PENDING").length;
  const allSynced     = connections.length > 0 && syncingCount === 0;
  const needsAnalysis = allSynced && !readiness;
  const firstName     = (user.name ?? "Student").split(" ")[0];
  const activeMissions = missions.filter((m) => m.status === "IN_PROGRESS" || m.status === "AVAILABLE").length;

  const ghConn = connections.find((c) => c.platform === "GITHUB");
  const lcConn = connections.find((c) => c.platform === "LEETCODE");

  /* ── trigger analysis ─────────────────────────────────────────────────── */
  const triggerAnalysis = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/analyze/trigger", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to trigger analysis");
      } else {
        toast.success("Analysis running — refreshing in 60 s…");
        setTimeout(() => fetchDashboard(false), 60_000);
      }
    } catch {
      toast.error("Could not reach AI service");
    } finally {
      setTriggering(false);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: "100%" }}>
      {/* Topbar */}
      <Topbar
        firstName={firstName}
        targetRole={profile.targetRole}
        streakDays={profile.streakDays}
        notificationCount={notificationCount}
        lastRefreshed={lastRefreshed}
        onRefresh={() => fetchDashboard(false)}
        refreshing={refreshing}
      />

      {/* Scrollable content */}
      <div style={{ flex: 1, padding: "18px 22px 28px", display: "flex", flexDirection: "column", gap: 14, overflowY: "auto", scrollbarWidth: "thin", scrollbarColor: `${C.border} ${C.bg2}` }}>

        {/* ── Banners ── */}
        {syncingCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, background: C.warn_bg, border: `1px solid ${C.warn}33`, fontSize: 12, color: C.warn }}>
            <RefreshCw size={13} style={{ animation: "spin 1.5s linear infinite", flexShrink: 0 }} />
            Syncing your profiles… this takes ~60 seconds. Your roadmap will appear shortly.
          </div>
        )}
        {needsAnalysis && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 14px", borderRadius: 10, background: C.bg2, border: `1px solid ${C.border}` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: C.text_sec }}>
              <Zap size={13} color={C.warn} />
              Profiles synced — run gap analysis to see your readiness score and roadmap.
            </div>
            <button
              onClick={triggerAnalysis}
              disabled={triggering}
              style={{ display: "flex", alignItems: "center", gap: 5, padding: "6px 14px", background: C.accent, color: "#000", fontWeight: 600, fontSize: 11, border: "none", borderRadius: 7, cursor: "pointer", flexShrink: 0, opacity: triggering ? 0.6 : 1 }}
            >
              {triggering ? <RefreshCw size={11} style={{ animation: "spin 1.5s linear infinite" }} /> : <Zap size={11} />}
              {triggering ? "Running…" : "Run Analysis"}
            </button>
          </div>
        )}

        {/* ── Section 1: Readiness + metric cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "240px 1fr", gap: 14 }}>
          <ReadinessCard readiness={readiness} />
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            <MetricCard label="Missions"     value={activeMissions}    valueColor={C.accent_text} sub="active now"    />
            <MetricCard label="Interviews"   value={interviewCount}    valueColor={C.success}     sub="this week"     />
            <MetricCard label="Jobs"         value={jobMatches.length} valueColor={C.accent_text} sub="top matches"   />
            <MetricCard label="Applications" value={applicationCount}  valueColor={C.warn}        sub="submitted"     />
          </div>
        </div>

        {/* ── Section 2: Missions + Job Matches ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <MissionsPanel missions={missions} />
          <JobMatchesPanel jobMatches={jobMatches} />
        </div>

        {/* ── Section 3: GitHub + LeetCode + Streak ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 14 }}>
          <GitHubStatsPanel   conn={ghConn} />
          <LeetCodeStatsPanel conn={lcConn} />
          <ActivityStreakPanel streakDays={profile.streakDays} />
        </div>

        {/* ── Section 4: Weak Topics + Recent Activity ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <WeakTopicsPanel   weakTopics={readiness?.weakTopics ?? []} />
          <RecentActivityPanel activities={recentActivity} />
        </div>
      </div>

      {/* Global styles */}
      <style>{`
        .dash-card:hover { border-color: ${C.border_h} !important; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}

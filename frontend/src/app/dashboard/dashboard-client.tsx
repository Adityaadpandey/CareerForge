"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  Bell,
  CheckCircle2,
  ChevronRight,
  Clock,
  Code2,
  ExternalLink,
  Flame,
  GitBranch,
  GitPullRequest,
  Lock,
  MapPin,
  Mic,
  Play,
  RefreshCw,
  Sparkles,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────────────────────────── */

type Mission = {
  id: string;
  title: string;
  type: string;
  status: string;
  estimatedHours: number;
  deadline: string | null;
};

type Connection = {
  platform: string;
  syncStatus: string;
  lastSyncedAt: string | null;
  parsedData: Record<string, unknown> | null;
};

type JobMatch = {
  id: string;
  company: string;
  title: string;
  matchScore: number;
  applyUrl: string;
  location: string | null;
  isRemote: boolean;
};

type ActivityItem = { dot: string; html: string; time: string };

type Readiness = {
  total: number;
  dsa: number;
  dev: number;
  comm: number;
  consistency: number;
  weakTopics: string[];
  delta: number | null;
};

type DashboardData = {
  user: { name: string | null; image: string | null };
  profile: {
    targetRole: string | null;
    streakDays: number;
    segment: string;
    dreamCompanies: string[];
  };
  readiness: Readiness | null;
  missions: Mission[];
  connections: Connection[];
  jobMatches: JobMatch[];
  interviewCount: number;
  applicationCount: number;
  notificationCount: number;
  recentActivity: ActivityItem[];
};

type Props = DashboardData;

type GHData = {
  profile?: { public_repos?: number; followers?: number };
  repositories?: {
    total_count?: number;
    primary_languages?: Record<string, number>;
    top_projects?: { name: string; stars: number; total_commits: number }[];
  };
  contributions?: { total_prs?: number; merged_prs?: number };
};

type LCData = {
  total_solved?: number;
  easy_solved?: number;
  medium_solved?: number;
  hard_solved?: number;
  contest_rating?: number;
  global_ranking?: number;
  handle?: string;
};

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}


const cardClass =
  "rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(15,15,18,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const sectionEyebrow = "text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-mono";



const TOPIC_META: Record<string, { color: string; score: number }> = {
  "Binary Trees": { color: "#ef4444", score: 85 },
  "Dynamic Programming": { color: "#f97316", score: 78 },
  "System Design": { color: "#f59e0b", score: 62 },
  Graphs: { color: "#eab308", score: 55 },
  Behavioral: { color: "#22c55e", score: 38 },
  Recursion: { color: "#10b981", score: 28 },
};

function parseGitHub(conn: Connection | undefined): GHData | null {
  if (!conn || conn.syncStatus !== "DONE" || !conn.parsedData) return null;
  return conn.parsedData as GHData;
}

function parseLeetCode(conn: Connection | undefined): LCData | null {
  if (!conn || conn.syncStatus !== "DONE" || !conn.parsedData) return null;
  return conn.parsedData as LCData;
}

function formatDate(date: string | null) {
  if (!date) return null;
  return new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

const CARD_INNER =
  "rounded-xl border border-white/[0.05] bg-white/[0.02] p-4";

const TYPE_COLORS: Record<string, { border: string; bg: string; text: string; glow: string }> = {
  BUILD:       { border: "border-orange-500/20", bg: "bg-orange-500/10", text: "text-orange-400", glow: "shadow-orange-500/20" },
  SOLVE:       { border: "border-sky-500/20",    bg: "bg-sky-500/10",    text: "text-sky-400",    glow: "shadow-sky-500/20" },
  COMMUNICATE: { border: "border-emerald-500/20",bg: "bg-emerald-500/10",text: "text-emerald-400", glow: "shadow-emerald-500/20" },
};

const STATUS_CONFIG: Record<string, { border: string; bg: string; text: string; icon: typeof Play }> = {
  COMPLETED:   { border: "border-emerald-500/20", bg: "bg-emerald-500/10", text: "text-emerald-400", icon: CheckCircle2 },
  IN_PROGRESS: { border: "border-orange-500/20",  bg: "bg-orange-500/10",  text: "text-orange-400",  icon: Play },
  AVAILABLE:   { border: "border-sky-500/20",     bg: "bg-sky-500/10",     text: "text-sky-400",     icon: Sparkles },
  LOCKED:      { border: "border-white/[0.06]",   bg: "bg-white/[0.03]",   text: "text-zinc-600",    icon: Lock },
};

/* ── Stat Card ─────────────────────────────────────────────────────────── */

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  gradient,
}: {
  label: string;
  value: string | number;
  hint: string;
  icon: React.ElementType;
  gradient: string;
}) {
  return (
    <div className={cn(cardClass, "relative overflow-hidden")}>
      <div className={`absolute inset-0 rounded-[1.6rem] ${gradient}`} />
      <div className="relative z-10">
        <div className="flex items-center justify-between">
          <div className={sectionEyebrow}>{label}</div>
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-white/[0.04] text-zinc-500">
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <div className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
        <div className="mt-1.5 text-xs text-zinc-500">{hint}</div>
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  return (
    <div
      className="relative h-28 w-28 shrink-0 rounded-full"
      style={{
        background: `conic-gradient(from -90deg, rgba(249,115,22,1) 0% ${score}%, rgba(39,39,42,1) ${score}% 100%)`,
      }}
    >
      <div className="absolute inset-[10px] flex flex-col items-center justify-center rounded-full border border-white/8 bg-[#121214]">
        <div className="text-3xl font-semibold tracking-[-0.06em] text-white">{Math.round(score)}</div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500">Readiness</div>
      </div>
    </div>
  );
}

/* ── Readiness Card ────────────────────────────────────────────────────── */

function ReadinessCard({ readiness, className }: { readiness: Readiness | null; className?: string }) {
  const pillars = readiness
    ? [
        { label: "DSA", value: readiness.dsa, color: "#f97316" },
        { label: "Development", value: readiness.dev, color: "#22c55e" },
        { label: "Communication", value: readiness.comm, color: "#eab308" },
        { label: "Consistency", value: readiness.consistency, color: "#a855f7" },
      ]
    : [];

  return (
    <section className={cn(cardClass, className)}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Readiness</div>
          <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
            {readiness ? "You are moving in the right direction." : "Run your analysis to unlock the dashboard."}
          </h2>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-400">
            {readiness
              ? "This score blends coding depth, development quality, communication, and consistency into one cleaner signal."
              : "Once your synced profiles finish processing, CareerForge will build a readiness score and surface your biggest improvement areas."}
          </p>
        </div>
        <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-xs text-zinc-400">
          Target score: <span className="font-medium text-white">85</span>
        </div>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <div className="flex flex-wrap items-center gap-5">
          {readiness ? (
            <ScoreRing score={readiness.total} />
          ) : (
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full border border-white/8 bg-zinc-900 text-4xl text-zinc-600">
              —
            </div>
          )}

          <div className="flex-1">
            {readiness ? (
              <>
                <div className="text-4xl font-semibold tracking-[-0.06em] text-white">{Math.round(readiness.total)}</div>
                <div className="mt-2 flex items-center gap-2 text-sm">
                  {readiness.delta !== null ? (
                    <>
                      {readiness.delta >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-emerald-400" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-rose-400" />
                      )}
                      <span className={readiness.delta >= 0 ? "text-emerald-400" : "text-rose-400"}>
                        {readiness.delta >= 0 ? "+" : ""}
                        {readiness.delta.toFixed(1)} this week
                      </span>
                    </>
                  ) : (
                    <span className="text-zinc-500">Fresh baseline captured</span>
                  )}
                </div>
                <div className="mt-3 inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs text-orange-300">
                  <Target className="h-3.5 w-3.5" />
                  {readiness.total >= 75 ? "On track" : "Needs prep"}
                </div>
              </>
            ) : (
              <div className="max-w-xs text-sm leading-6 text-zinc-500">
                Score appears after analysis runs.
              </div>
            )}
          </div>
        </div>

        {pillars.length > 0 && (
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-1 2xl:grid-cols-2">
            {pillars.map((pillar) => (
              <div key={pillar.label} className="rounded-2xl border border-white/8 bg-black/20 p-3">
                <div className="mb-3 flex items-center justify-between text-xs">
                  <span className="text-zinc-300">{pillar.label}</span>
                  <span className="font-medium text-white">{Math.round(pillar.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                  <div className="h-full rounded-full" style={{ width: `${pillar.value}%`, backgroundColor: pillar.color }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/* ── Mission Item ──────────────────────────────────────────────────────── */

function MissionItem({ mission }: { mission: Mission }) {
  const sc = STATUS_CONFIG[mission.status] ?? STATUS_CONFIG.LOCKED;
  const tc = TYPE_COLORS[mission.type];
  const Icon = sc.icon;

  return (
    <div className={cn(CARD_INNER, "group/mission transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.04]")}>
      <div className="flex items-start gap-3">
        <div className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
          sc.border, sc.bg,
        )}>
          <Icon className={cn("h-3.5 w-3.5", sc.text)} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h4 className="text-sm font-medium text-zinc-200 group-hover/mission:text-white transition-colors">
              {mission.title}
            </h4>
            {tc && (
              <span className={cn(
                "rounded-md border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.12em]",
                tc.border, tc.bg, tc.text,
              )}>
                {mission.type}
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-3 text-[11px] text-zinc-600">
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {mission.estimatedHours}h
            </span>
            {mission.deadline && (
              <span>Due {formatDate(mission.deadline)}</span>
            )}
            <span className="capitalize">{mission.status.toLowerCase().replace("_", " ")}</span>
          </div>
        </div>
        <ChevronRight className="h-4 w-4 text-zinc-700 opacity-0 transition-all group-hover/mission:opacity-100 group-hover/mission:text-zinc-400" />
      </div>
    </div>
  );
}

/* ── Missions Panel ────────────────────────────────────────────────────── */

function MissionsPanel({ missions, className }: { missions: Mission[]; className?: string }) {
  return (
    <section className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Roadmap</div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Missions in motion</h3>
        </div>
        <Link href="/roadmap" className="inline-flex items-center gap-1 text-sm text-orange-300 transition-colors hover:text-orange-200">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

        <div className="mt-4 space-y-2">
          {missions.length ? (
            missions.map((m) => <MissionItem key={m.id} mission={m} />)
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/[0.06] py-10 text-center">
              <Sparkles className="h-6 w-6 text-zinc-700" />
              <p className="text-sm text-zinc-600">Missions appear after gap analysis.</p>
            </div>
          )}
        </div>
    </section>
  );
}

/* ── Job Match Card ────────────────────────────────────────────────────── */

function JobMatchesPanel({ jobMatches, className }: { jobMatches: JobMatch[]; className?: string }) {
  return (
    <section className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Jobs</div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Top matches</h3>
        </div>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-orange-300 transition-colors hover:text-orange-200">
          See all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

        <div className="mt-4 space-y-2">
          {jobMatches.length ? (
            jobMatches.map((job) => (
              <div
                key={job.id}
                className={cn(CARD_INNER, "group/job transition-all duration-200 hover:border-white/[0.1] hover:bg-white/[0.04]")}
              >
                <div className="flex items-start gap-3">
                  {/* Company Avatar */}
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-white/[0.08] to-white/[0.03] text-sm font-bold text-zinc-300">
                    {job.company[0]}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium text-zinc-200 group-hover/job:text-white transition-colors truncate">
                      {job.title}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-600">
                      <span>{job.company}</span>
                      {(job.location || job.isRemote) && (
                        <>
                          <span className="text-zinc-700">·</span>
                          <span className="flex items-center gap-0.5">
                            <MapPin className="h-2.5 w-2.5" />
                            {job.location ?? "Remote"}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={cn(
                      "rounded-md px-2 py-1 text-[10px] font-bold",
                      job.matchScore >= 80
                        ? "bg-emerald-500/10 text-emerald-400"
                        : job.matchScore >= 60
                          ? "bg-amber-500/10 text-amber-400"
                          : "bg-zinc-500/10 text-zinc-400",
                    )}>
                      {Math.round(job.matchScore)}%
                    </span>
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-7 w-7 items-center justify-center rounded-lg border border-white/[0.06] text-zinc-600 transition-all hover:border-orange-500/30 hover:text-orange-400"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/[0.06] py-10 text-center">
              <Target className="h-6 w-6 text-zinc-700" />
              <p className="text-sm text-zinc-600">Run analysis to get job matches.</p>
            </div>
          )}
        </div>

        {/* Auto-Generate CTA */}
        <div className="mt-4 rounded-xl border border-orange-500/15 bg-gradient-to-r from-orange-500/[0.06] to-transparent p-3.5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-white">Auto-generate a tailored CV</div>
              <div className="mt-0.5 text-[11px] text-zinc-500">Role-specific draft in one click</div>
            </div>
            <button className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-3.5 py-1.5 text-xs font-semibold text-black transition-all hover:shadow-lg hover:shadow-orange-500/20">
              Generate
            </button>
          </div>
        </div>
    </section>
  );
}

/* ── GitHub Card ───────────────────────────────────────────────────────── */

function GitHubCard({ conn, className }: { conn: Connection | undefined; className?: string }) {
  const gh = parseGitHub(conn);
  const syncing = conn?.syncStatus === "SYNCING" || conn?.syncStatus === "PENDING";
  const topProject = gh?.repositories?.top_projects?.[0];
  const repos = gh?.profile?.public_repos ?? 0;
  const prs = gh?.contributions?.total_prs ?? 0;
  const commits = gh?.repositories?.top_projects?.reduce((s, p) => s + (p.total_commits ?? 0), 0) ?? 0;

  return (
    <section className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>GitHub</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Engineering signal</h3>
        </div>
        <div className="text-xs text-zinc-500">{formatDate(conn?.lastSyncedAt ?? null) ?? "Not synced"}</div>
      </div>

        <div className="mt-4">
          {!conn ? (
            <EmptyState icon={GitBranch} text="Connect GitHub to unlock." />
          ) : syncing || !gh ? (
            <SyncingState text={syncing ? "Analyzing GitHub…" : "No data yet."} />
          ) : (
            <>
              <div className="grid gap-2 grid-cols-3">
                {[
                  { icon: GitBranch, label: "Repos", value: repos },
                  { icon: Code2, label: "Commits", value: commits },
                  { icon: GitPullRequest, label: "PRs", value: prs },
                ].map(({ icon: Ic, label, value }) => (
                  <div key={label} className={CARD_INNER}>
                    <Ic className="h-3.5 w-3.5 text-zinc-600 mb-2" />
                    <div className="text-xl font-bold tracking-tight text-white">{value}</div>
                    <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600 mt-0.5">{label}</div>
                  </div>
                ))}
              </div>

              {topProject && (
                <div className={cn(CARD_INNER, "mt-2")}>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-zinc-200">{topProject.name}</div>
                      <div className="text-[11px] text-zinc-600 mt-0.5">{topProject.total_commits} commits</div>
                    </div>
                    {topProject.stars > 0 && (
                      <div className="flex items-center gap-1 text-amber-400 text-xs">
                        <Star className="h-3 w-3" /> {topProject.stars}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
    </section>
  );
}

/* ── LeetCode Card ─────────────────────────────────────────────────────── */

function LeetCodeCard({ conn, className }: { conn: Connection | undefined; className?: string }) {
  const lc = parseLeetCode(conn);
  const syncing = conn?.syncStatus === "SYNCING" || conn?.syncStatus === "PENDING";

  return (
    <section className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>LeetCode</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Problem solving depth</h3>
        </div>
        <div className="text-xs text-zinc-500">{formatDate(conn?.lastSyncedAt ?? null) ?? "Not synced"}</div>
      </div>

        <div className="mt-4">
          {!conn ? (
            <EmptyState icon={Code2} text="Connect LeetCode to unlock." />
          ) : syncing || !lc ? (
            <SyncingState text={syncing ? "Fetching stats…" : "No data yet."} />
          ) : (
            <>
              {/* Total solved hero */}
              <div className={cn(CARD_INNER, "text-center")}>
                <div className="text-4xl font-bold tracking-tight text-white">{lc.total_solved ?? 0}</div>
                <div className="mt-1 text-xs text-zinc-500">problems solved</div>
              </div>

              {/* Difficulty bars */}
              <div className="mt-3 space-y-2.5">
                {[
                  { label: "Easy", value: lc.easy_solved ?? 0, color: "#22c55e" },
                  { label: "Medium", value: lc.medium_solved ?? 0, color: "#eab308" },
                  { label: "Hard", value: lc.hard_solved ?? 0, color: "#ef4444" },
                ].map((row) => {
                  const total = lc.total_solved || 1;
                  return (
                    <div key={row.label}>
                      <div className="mb-1.5 flex items-center justify-between text-xs">
                        <span className="text-zinc-500">{row.label}</span>
                        <span className="font-semibold text-zinc-300">{row.value}</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                        <div
                          className="pillar-bar h-full rounded-full"
                          style={{ width: `${(row.value / total) * 100}%`, background: row.color }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Contest + Rank */}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <div className={CARD_INNER}>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Contest</div>
                  <div className="mt-1.5 text-lg font-bold text-white">{Math.round(lc.contest_rating ?? 0)}</div>
                </div>
                <div className={CARD_INNER}>
                  <div className="text-[10px] uppercase tracking-[0.14em] text-zinc-600">Rank</div>
                  <div className="mt-1.5 text-lg font-bold text-white">
                    {lc.global_ranking ? lc.global_ranking.toLocaleString() : "—"}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
    </section>
  );
}

/* ── Streak Card ───────────────────────────────────────────────────────── */

function StreakCard({ streakDays, className }: { streakDays: number; className?: string }) {
  const squares = Array.from({ length: 28 }, (_, index) => {
    const fromEnd = 27 - index;
    if (fromEnd < streakDays) return "bg-orange-400";
    if (fromEnd < streakDays + 7) return "bg-orange-500/40";
    return "bg-zinc-800";
  });

  return (
    <section className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={sectionEyebrow}>Activity</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Consistency streak</h3>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-sm text-emerald-300">
          <Flame className="h-4 w-4" />
          {streakDays} days
        </div>
      </div>

        {/* Contribution grid */}
        <div className="mt-4 grid grid-cols-7 gap-[5px]">
          {squares.map((cls, i) => (
            <div key={i} className={`aspect-square rounded-[4px] transition-colors duration-200 ${cls}`} />
          ))}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2">
          <div className={CARD_INNER}>
            <div className="text-xl font-bold text-white">{streakDays}</div>
            <div className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wide">Current</div>
          </div>
          <div className={CARD_INNER}>
            <div className="text-xl font-bold text-white">—</div>
            <div className="text-[10px] text-zinc-600 mt-0.5 uppercase tracking-wide">Best</div>
          </div>
        </div>
    </section>
  );
}

function WeakTopicsPanel({ weakTopics, className }: { weakTopics: string[]; className?: string }) {
  const topics = (weakTopics.length ? weakTopics : Object.keys(TOPIC_META)).slice(0, 6);

  return (
    <section className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Focus</div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Weak topics</h3>
        </div>
        <span className="text-sm text-orange-300">Fix these first</span>
      </div>

      <div className="mt-4 space-y-2.5">
        {topics.map((topic) => {
          const meta = TOPIC_META[topic] ?? { color: "#71717a", score: 50 };
          return (
            <div key={topic} className={cn(CARD_INNER, "flex items-center gap-3")}>
              <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: meta.color }} />
              <span className="text-sm text-zinc-300 flex-1">{topic}</span>
              <span className="text-xs font-mono" style={{ color: meta.color }}>{meta.score}%</span>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentActivityPanel({ activities, className }: { activities: ActivityItem[]; className?: string }) {
  const items = activities.length
    ? activities
    : [{ dot: "#525252", html: "Your activity will appear here as you complete missions and interviews", time: "" }];

  return (
    <section className={cn(cardClass, className)}>
      <div>
        <div className={sectionEyebrow}>Feed</div>
        <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Recent activity</h3>
      </div>

      <div className="mt-5 space-y-4">
        {items.map((item, index) => (
          <div key={`${item.time}-${index}`} className="flex gap-4 rounded-2xl border border-white/8 bg-black/20 p-4">
            <div
              className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ background: item.dot }}
            />
            <div className="min-w-0 flex-1">
              <div
                className="text-sm leading-6 text-zinc-300"
                dangerouslySetInnerHTML={{
                  __html: item.html
                    .replace(/<b>/g, '<span class="font-medium text-white">')
                    .replace(/<\/b>/g, "</span>"),
                }}
              />
              {item.time ? <div className="mt-1 text-xs text-zinc-500">{item.time}</div> : null}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

/* ── Shared empty/syncing states ───────────────────────────────────────── */

function EmptyState({ icon: Icon, text }: { icon: typeof Code2; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-white/[0.06] py-8 text-center">
      <Icon className="h-6 w-6 text-zinc-700" />
      <p className="text-sm text-zinc-600">{text}</p>
    </div>
  );
}

function SyncingState({ text }: { text: string }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-orange-500/15 bg-orange-500/[0.05] px-4 py-4 text-sm text-orange-300/80">
      <RefreshCw className="h-4 w-4 animate-spin text-orange-400" />
      {text}
    </div>
  );
}

/* ── Banner ─────────────────────────────────────────────────────────────── */

function Banner({
  kind,
  text,
  action,
  onClick,
  loading,
}: {
  kind: "warning" | "neutral";
  text: string;
  action?: string;
  onClick?: () => void;
  loading?: boolean;
}) {
  return (
    <div className={cn(
      "flex flex-wrap items-center justify-between gap-3 rounded-xl border px-4 py-3",
      kind === "warning"
        ? "border-amber-500/15 bg-amber-500/[0.05] text-amber-300/80"
        : "border-white/[0.06] bg-white/[0.02] text-zinc-400",
    )}>
      <div className="flex items-center gap-2.5 text-sm">
        <Zap className="h-4 w-4 shrink-0" />
        <span>{text}</span>
      </div>
      {action && onClick && (
        <button
          onClick={onClick}
          disabled={loading}
          className="rounded-lg bg-gradient-to-r from-orange-500 to-amber-500 px-4 py-1.5 text-xs font-semibold text-black transition-all hover:shadow-lg hover:shadow-orange-500/20 disabled:opacity-50"
        >
          {loading ? "Running…" : action}
        </button>
      )}
    </div>
  );
}

/* ── Header ─────────────────────────────────────────────────────────────── */

function Header({
  firstName,
  targetRole,
  notificationCount,
  lastRefreshed,
  onRefresh,
  refreshing,
}: {
  firstName: string;
  targetRole: string | null;
  notificationCount: number;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <header className="sticky top-0 z-20 mb-5 rounded-2xl border border-white/[0.05] bg-[#0c0c0c]/80 p-5 backdrop-blur-xl backdrop-saturate-150">
      {/* Subtle top-edge shine */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" />

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            {getGreeting()}, {firstName}
          </h1>
          <p className="mt-1 text-sm text-zinc-500">
            Track readiness, keep missions moving, and land the roles you want.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {targetRole && (
            <span className="hidden sm:inline-flex items-center gap-1.5 rounded-full border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-400">
              <Target className="h-3 w-3 text-orange-400" />
              {targetRole}
            </span>
          )}

          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition-all hover:border-white/[0.1] hover:text-zinc-300 disabled:opacity-50"
            title="Refresh"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
          </button>

          <Link
            href="/notifications"
            className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.06] bg-white/[0.03] text-zinc-500 transition-all hover:border-white/[0.1] hover:text-zinc-300"
          >
            <Bell className="h-3.5 w-3.5" />
            {notificationCount > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-orange-500 px-1 text-[9px] font-bold text-black">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            )}
          </Link>
        </div>
      </div>

      {lastRefreshed && (
        <div className="mt-3 text-[10px] text-zinc-600">
          Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      )}
    </header>
  );
}

/* ── Main Dashboard ────────────────────────────────────────────────────── */

export function DashboardClient(initialData: Props) {
  const [data, setData] = useState<DashboardData>(initialData);
  const [triggering, setTriggering] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);

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
      // keep stale state
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

  const triggerAnalysis = async () => {
    setTriggering(true);
    try {
      const res = await fetch("/api/analyze/trigger", { method: "POST" });
      if (!res.ok) {
        const body = await res.json();
        toast.error(body.error ?? "Failed to trigger analysis");
      } else {
        toast.success("Analysis running — refreshing in 60 seconds.");
        setTimeout(() => fetchDashboard(false), 60_000);
      }
    } catch {
      toast.error("Could not reach AI service");
    } finally {
      setTriggering(false);
    }
  };

  const {
    user, profile, readiness, missions, connections,
    jobMatches, interviewCount, applicationCount,
    notificationCount, recentActivity,
  } = data;

  const firstName = (user.name ?? "Student").split(" ")[0];
  const syncingCount = connections.filter((c) => c.syncStatus === "SYNCING" || c.syncStatus === "PENDING").length;
  const allSynced = connections.length > 0 && syncingCount === 0;
  const needsAnalysis = allSynced && !readiness;
  const activeMissions = missions.filter((m) => m.status === "IN_PROGRESS" || m.status === "AVAILABLE").length;
  const ghConn = connections.find((c) => c.platform === "GITHUB");
  const lcConn = connections.find((c) => c.platform === "LEETCODE");

  const heroStats = useMemo(
    () => [
      { label: "Missions", value: activeMissions, hint: "active now", icon: Target, gradient: "bg-[radial-gradient(ellipse_at_top_left,rgba(249,115,22,0.08),transparent_60%)]" },
      { label: "Interviews", value: interviewCount, hint: "this week", icon: Mic, gradient: "bg-[radial-gradient(ellipse_at_top_left,rgba(34,197,94,0.08),transparent_60%)]" },
      { label: "Jobs", value: jobMatches.length, hint: "top matches", icon: Sparkles, gradient: "bg-[radial-gradient(ellipse_at_top_left,rgba(56,189,248,0.08),transparent_60%)]" },
      { label: "Applications", value: applicationCount, hint: "submitted", icon: ArrowUpRight, gradient: "bg-[radial-gradient(ellipse_at_top_left,rgba(234,179,8,0.08),transparent_60%)]" },
    ],
    [activeMissions, applicationCount, interviewCount, jobMatches.length],
  );

  return (
    <div className="dashboard-root min-h-full bg-[#090909] px-4 py-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Header
          firstName={firstName}
          targetRole={profile.targetRole}
          notificationCount={notificationCount}
          lastRefreshed={lastRefreshed}
          onRefresh={() => fetchDashboard(false)}
          refreshing={refreshing}
        />

        {/* Banners */}
        <div className="space-y-2">
          {syncingCount > 0 && (
            <Banner kind="warning" text="Your profiles are syncing. Fresh data will appear shortly." />
          )}
          {needsAnalysis && (
            <Banner
              kind="neutral"
              text="Profiles synced — run gap analysis to unlock your readiness score."
              action="Run Analysis"
              onClick={triggerAnalysis}
              loading={triggering}
            />
          )}
        </div>

        <div className="mt-6 grid gap-6 xl:grid-cols-12 xl:items-start">
          {/* Main Layout Area */}
          <div className="flex flex-col gap-6 xl:col-span-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {heroStats.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                  hint={stat.hint}
                  icon={stat.icon}
                  gradient={stat.gradient}
                />
              ))}
            </div>

            <MissionsPanel missions={missions} className="w-full" />
            <JobMatchesPanel jobMatches={jobMatches} className="w-full" />
            <RecentActivityPanel activities={recentActivity} className="w-full" />
          </div>

          {/* Right Sidebar */}
          <aside className="flex flex-col gap-6 xl:col-span-4">
            <ReadinessCard readiness={readiness} className="w-full" />
            
            <WeakTopicsPanel weakTopics={readiness?.weakTopics ?? []} className="w-full" />
            
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              <StreakCard streakDays={profile.streakDays} className="w-full" />
              <GitHubCard conn={ghConn} className="w-full" />
              <LeetCodeCard conn={lcConn} className="w-full" />
            </div>

            {profile.dreamCompanies.length ? (
              <section className={cn(cardClass, "mt-2")}>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className={sectionEyebrow}>Targets</div>
                    <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Dream companies</h3>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm text-zinc-300">
                    <Trophy className="h-4 w-4 text-orange-300" />
                    {profile.segment.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {profile.dreamCompanies.map((company) => (
                    <span key={company} className="rounded-full border border-white/8 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300">
                      {company}
                    </span>
                  ))}
                </div>
              </section>
            ) : null}
          </aside>
        </div>
      </div>
    </div>
  );
}

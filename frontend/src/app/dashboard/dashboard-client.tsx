"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  ChevronRight,
  Code2,
  Flame,
  GitBranch,
  GitPullRequest,
  Lock,
  Play,
  RefreshCw,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Zap,
} from "lucide-react";

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

const shellClass =
  "rounded-3xl border border-white/10 bg-[linear-gradient(180deg,rgba(19,19,20,0.96),rgba(11,11,12,0.98))] shadow-[0_18px_70px_rgba(0,0,0,0.32)]";
const cardClass =
  "rounded-[1.6rem] border border-white/8 bg-[linear-gradient(180deg,rgba(24,24,27,0.92),rgba(15,15,18,0.94))] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]";
const sectionEyebrow = "text-[11px] uppercase tracking-[0.24em] text-zinc-500 font-mono";

const TYPE_STYLES: Record<string, string> = {
  BUILD: "border-orange-500/20 bg-orange-500/10 text-orange-300",
  SOLVE: "border-sky-500/20 bg-sky-500/10 text-sky-300",
  COMMUNICATE: "border-emerald-500/20 bg-emerald-500/10 text-emerald-300",
};

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

function cn(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

function StatCard({
  label,
  value,
  hint,
  accent,
}: {
  label: string;
  value: string | number;
  hint: string;
  accent: string;
}) {
  return (
    <div className={cn(cardClass, "p-4")}>
      <div className={sectionEyebrow}>{label}</div>
      <div className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">{value}</div>
      <div className={cn("mt-2 text-sm", accent)}>{hint}</div>
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

function ReadinessCard({ readiness }: { readiness: Readiness | null }) {
  const pillars = readiness
    ? [
        { label: "DSA", value: readiness.dsa, tone: "bg-orange-400" },
        { label: "Development", value: readiness.dev, tone: "bg-emerald-400" },
        { label: "Communication", value: readiness.comm, tone: "bg-amber-300" },
        { label: "Consistency", value: readiness.consistency, tone: "bg-fuchsia-400" },
      ]
    : [];

  return (
    <section className={cn(cardClass, "lg:col-span-4")}>
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

      <div className="mt-8 grid gap-6 xl:grid-cols-[auto_minmax(0,1fr)]">
        <div className="flex items-center gap-5">
          {readiness ? (
            <ScoreRing score={readiness.total} />
          ) : (
            <div className="flex h-28 w-28 items-center justify-center rounded-full border border-white/8 bg-zinc-900 text-4xl text-zinc-600">
              —
            </div>
          )}

          <div>
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
                  {readiness.total >= 75 ? "On track for stronger interviews" : "Needs more prep before top roles"}
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
          <div className="grid gap-4 md:grid-cols-2">
            {pillars.map((pillar) => (
              <div key={pillar.label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="mb-3 flex items-center justify-between text-sm">
                  <span className="text-zinc-300">{pillar.label}</span>
                  <span className="font-medium text-white">{Math.round(pillar.value)}</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                  <div className={cn("h-full rounded-full", pillar.tone)} style={{ width: `${pillar.value}%` }} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {readiness?.weakTopics.length ? (
        <div className="mt-6 border-t border-white/8 pt-5">
          <div className={sectionEyebrow}>Weak Topics</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {readiness.weakTopics.slice(0, 5).map((topic) => (
              <span
                key={topic}
                className="rounded-full border border-white/8 bg-white/[0.04] px-3 py-1.5 text-xs text-zinc-300"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MissionItem({ mission }: { mission: Mission }) {
  const statusTone =
    mission.status === "COMPLETED"
      ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-300"
      : mission.status === "IN_PROGRESS"
        ? "border-orange-500/20 bg-orange-500/10 text-orange-300"
        : mission.status === "AVAILABLE"
          ? "border-sky-500/20 bg-sky-500/10 text-sky-300"
          : "border-white/8 bg-white/[0.03] text-zinc-500";

  const Icon =
    mission.status === "COMPLETED" ? CheckCircle2 : mission.status === "LOCKED" ? Lock : Play;

  return (
    <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
      <div className="flex items-start gap-3">
        <div className={cn("mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl border", statusTone)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-medium text-white">{mission.title}</h3>
            <span className={cn("rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.16em]", TYPE_STYLES[mission.type] ?? "border-white/8 bg-white/[0.04] text-zinc-400")}>
              {mission.type}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap gap-3 text-xs text-zinc-500">
            <span>{mission.estimatedHours}h effort</span>
            {mission.deadline ? <span>Due {formatDate(mission.deadline)}</span> : null}
            <span className="capitalize">{mission.status.toLowerCase().replace("_", " ")}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MissionsPanel({ missions }: { missions: Mission[] }) {
  return (
    <section className={cn(cardClass, "xl:col-span-7")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Roadmap</div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Missions in motion</h3>
        </div>
        <Link href="/roadmap" className="inline-flex items-center gap-1 text-sm text-orange-300 transition-colors hover:text-orange-200">
          View all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {missions.length ? (
          missions.map((mission) => <MissionItem key={mission.id} mission={mission} />)
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center text-sm text-zinc-500">
            Missions appear after gap analysis runs.
          </div>
        )}
      </div>
    </section>
  );
}

function JobMatchesPanel({ jobMatches }: { jobMatches: JobMatch[] }) {
  return (
    <section className={cn(cardClass, "xl:col-span-5")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Jobs</div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Top matches</h3>
        </div>
        <Link href="/jobs" className="inline-flex items-center gap-1 text-sm text-orange-300 transition-colors hover:text-orange-200">
          See all <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 space-y-3">
        {jobMatches.length ? (
          jobMatches.map((job) => (
            <div key={job.id} className="rounded-2xl border border-white/8 bg-black/20 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-sm font-semibold text-white">
                      {job.company[0]}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-white">{job.title}</div>
                      <div className="mt-1 text-xs text-zinc-500">
                        {job.company}
                        {job.location ? ` · ${job.location}` : job.isRemote ? " · Remote" : ""}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-300">
                    {Math.round(job.matchScore)}% match
                  </span>
                  <a
                    href={job.applyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300 transition-colors hover:bg-orange-500/15"
                  >
                    Apply
                  </a>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 px-5 py-8 text-center">
            <div className="text-sm text-zinc-400">No matches yet</div>
            <div className="mt-2 text-sm text-zinc-500">Run analysis to get personalized job matches.</div>
          </div>
        )}
      </div>

      <div className="mt-5 rounded-2xl border border-orange-500/20 bg-orange-500/10 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-white">Generate a tailored CV for any role</div>
            <div className="mt-1 text-sm text-orange-200/80">Auto-generate a role-specific draft in one click.</div>
          </div>
          <button className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-orange-400">
            Auto-generate
          </button>
        </div>
      </div>
    </section>
  );
}

function GitHubCard({ conn }: { conn: Connection | undefined }) {
  const gh = parseGitHub(conn);
  const syncing = conn?.syncStatus === "SYNCING" || conn?.syncStatus === "PENDING";
  const topProject = gh?.repositories?.top_projects?.[0];
  const repos = gh?.profile?.public_repos ?? 0;
  const prs = gh?.contributions?.total_prs ?? 0;
  const commits = gh?.repositories?.top_projects?.reduce((sum, project) => sum + (project.total_commits ?? 0), 0) ?? 0;

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>GitHub</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Engineering signal</h3>
        </div>
        <div className="text-xs text-zinc-500">{formatDate(conn?.lastSyncedAt ?? null) ?? "Not synced"}</div>
      </div>

      <div className="mt-5">
        {!conn ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
            Connect GitHub in your profile to unlock this panel.
          </div>
        ) : syncing || !gh ? (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-6 text-sm text-orange-300">
            {syncing ? "Analyzing your GitHub…" : "No GitHub data yet."}
          </div>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                { icon: GitBranch, label: "Repos", value: repos },
                { icon: Code2, label: "Commits", value: commits },
                { icon: GitPullRequest, label: "PRs", value: prs },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-black/20 p-4">
                  <div className="flex items-center gap-2 text-zinc-500">
                    <Icon className="h-4 w-4 text-orange-300" />
                    <span className="text-[11px] uppercase tracking-[0.18em]">{label}</span>
                  </div>
                  <div className="mt-3 text-2xl font-semibold tracking-[-0.04em] text-white">{value}</div>
                </div>
              ))}
            </div>

            {topProject ? (
              <div className="mt-4 rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate text-sm font-medium text-white">{topProject.name}</div>
                    <div className="mt-1 text-xs text-zinc-500">{topProject.total_commits} commits across recent work</div>
                  </div>
                  {topProject.stars ? (
                    <div className="inline-flex items-center gap-1 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs text-amber-300">
                      <Star className="h-3.5 w-3.5" />
                      {topProject.stars}
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}

function LeetCodeCard({ conn }: { conn: Connection | undefined }) {
  const lc = parseLeetCode(conn);
  const syncing = conn?.syncStatus === "SYNCING" || conn?.syncStatus === "PENDING";

  return (
    <section className={cardClass}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>LeetCode</div>
          <h3 className="mt-2 text-lg font-semibold text-white">Problem solving depth</h3>
        </div>
        <div className="text-xs text-zinc-500">{formatDate(conn?.lastSyncedAt ?? null) ?? "Not synced"}</div>
      </div>

      <div className="mt-5">
        {!conn ? (
          <div className="rounded-2xl border border-dashed border-white/10 px-4 py-8 text-center text-sm text-zinc-500">
            Connect LeetCode in your profile to unlock this panel.
          </div>
        ) : syncing || !lc ? (
          <div className="rounded-2xl border border-orange-500/20 bg-orange-500/10 px-4 py-6 text-sm text-orange-300">
            {syncing ? "Fetching LeetCode stats…" : "No LeetCode data yet."}
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-white/8 bg-black/20 p-5 text-center">
              <div className="text-4xl font-semibold tracking-[-0.06em] text-white">{lc.total_solved ?? 0}</div>
              <div className="mt-2 text-sm text-zinc-500">problems solved</div>
            </div>

            <div className="mt-4 space-y-3">
              {[
                { label: "Easy", value: lc.easy_solved ?? 0, tone: "bg-emerald-400" },
                { label: "Medium", value: lc.medium_solved ?? 0, tone: "bg-amber-300" },
                { label: "Hard", value: lc.hard_solved ?? 0, tone: "bg-rose-400" },
              ].map((row) => {
                const total = lc.total_solved || 1;
                return (
                  <div key={row.label}>
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-zinc-400">{row.label}</span>
                      <span className="text-white">{row.value}</span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                      <div className={cn("h-full rounded-full", row.tone)} style={{ width: `${(row.value / total) * 100}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className={sectionEyebrow}>Contest</div>
                <div className="mt-2 text-xl font-semibold text-white">{Math.round(lc.contest_rating ?? 0)}</div>
              </div>
              <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
                <div className={sectionEyebrow}>Rank</div>
                <div className="mt-2 text-xl font-semibold text-white">
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

function StreakCard({ streakDays }: { streakDays: number }) {
  const squares = Array.from({ length: 28 }, (_, index) => {
    const fromEnd = 27 - index;
    if (fromEnd < streakDays) return "bg-orange-400";
    if (fromEnd < streakDays + 7) return "bg-orange-500/40";
    return "bg-zinc-800";
  });

  return (
    <section className={cardClass}>
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

      <div className="mt-5 grid grid-cols-7 gap-2">
        {squares.map((tone, index) => (
          <div key={index} className={cn("aspect-square rounded-md", tone)} />
        ))}
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="text-2xl font-semibold tracking-[-0.04em] text-white">{streakDays}</div>
          <div className="mt-1 text-sm text-zinc-500">Current streak</div>
        </div>
        <div className="rounded-2xl border border-white/8 bg-black/20 p-4">
          <div className="text-2xl font-semibold tracking-[-0.04em] text-white">—</div>
          <div className="mt-1 text-sm text-zinc-500">Best streak</div>
        </div>
      </div>
    </section>
  );
}

function WeakTopicsPanel({ weakTopics }: { weakTopics: string[] }) {
  const topics = (weakTopics.length ? weakTopics : Object.keys(TOPIC_META)).slice(0, 6);

  return (
    <section className={cn(cardClass, "xl:col-span-5")}>
      <div className="flex items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Focus</div>
          <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Weak topics</h3>
        </div>
        <span className="text-sm text-orange-300">Fix these first</span>
      </div>

      <div className="mt-5 space-y-4">
        {topics.map((topic) => {
          const meta = TOPIC_META[topic] ?? { color: "#f59e0b", score: 50 };
          return (
            <div key={topic}>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-zinc-300">{topic}</span>
                <span style={{ color: meta.color }}>{meta.score}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                <div className="h-full rounded-full" style={{ width: `${meta.score}%`, background: meta.color }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

function RecentActivityPanel({ activities }: { activities: ActivityItem[] }) {
  const items = activities.length
    ? activities
    : [{ dot: "#525252", html: "Your activity will appear here as you complete missions and interviews", time: "" }];

  return (
    <section className={cn(cardClass, "xl:col-span-7")}>
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

function Header({
  firstName,
  targetRole,
  streakDays,
  notificationCount,
  lastRefreshed,
  onRefresh,
  refreshing,
}: {
  firstName: string;
  targetRole: string | null;
  streakDays: number;
  notificationCount: number;
  lastRefreshed: Date | null;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  return (
    <section className={cn(shellClass, "sticky top-0 z-10 mb-6 p-5 backdrop-blur")}>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className={sectionEyebrow}>Dashboard</div>
          <h1 className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
            Welcome back, {firstName}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Track readiness, keep missions moving, and stay close to the roles you want.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {targetRole ? (
            <span className="rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-sm text-zinc-300">
              Target role: <span className="text-white">{targetRole}</span>
            </span>
          ) : null}
          <span className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-300">
            {streakDays}d streak
          </span>
          <button
            onClick={onRefresh}
            disabled={refreshing}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.06] disabled:opacity-60"
            title="Refresh dashboard"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          </button>
          <Link
            href="/notifications"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-zinc-300 transition-colors hover:bg-white/[0.06]"
          >
            <Bell className="h-4 w-4" />
            {notificationCount > 0 ? (
              <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-orange-500 px-1.5 py-0.5 text-center text-[10px] font-bold text-black">
                {notificationCount > 9 ? "9+" : notificationCount}
              </span>
            ) : null}
          </Link>
        </div>
      </div>

      {lastRefreshed ? (
        <div className="mt-4 text-xs text-zinc-500">
          Updated {lastRefreshed.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
        </div>
      ) : null}
    </section>
  );
}

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
  const tone =
    kind === "warning"
      ? "border-amber-500/20 bg-amber-500/10 text-amber-300"
      : "border-white/10 bg-white/[0.04] text-zinc-300";

  return (
    <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-2xl border px-4 py-3", tone)}>
      <div className="flex items-center gap-3 text-sm">
        <Zap className="h-4 w-4" />
        <span>{text}</span>
      </div>
      {action && onClick ? (
        <button
          onClick={onClick}
          disabled={loading}
          className="rounded-full bg-orange-500 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-orange-400 disabled:opacity-60"
        >
          {loading ? "Running..." : action}
        </button>
      ) : null}
    </div>
  );
}

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
      // keep stale state on network issues
    } finally {
      if (!silent) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const syncing = data.connections.some((conn) => conn.syncStatus === "SYNCING" || conn.syncStatus === "PENDING");
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

  const { user, profile, readiness, missions, connections, jobMatches, interviewCount, applicationCount, notificationCount, recentActivity } = data;

  const firstName = (user.name ?? "Student").split(" ")[0];
  const syncingCount = connections.filter((conn) => conn.syncStatus === "SYNCING" || conn.syncStatus === "PENDING").length;
  const allSynced = connections.length > 0 && syncingCount === 0;
  const needsAnalysis = allSynced && !readiness;
  const activeMissions = missions.filter((mission) => mission.status === "IN_PROGRESS" || mission.status === "AVAILABLE").length;
  const ghConn = connections.find((conn) => conn.platform === "GITHUB");
  const lcConn = connections.find((conn) => conn.platform === "LEETCODE");

  const heroStats = useMemo(
    () => [
      {
        label: "Missions",
        value: activeMissions,
        hint: "active now",
        accent: "text-orange-300",
      },
      {
        label: "Interviews",
        value: interviewCount,
        hint: "this week",
        accent: "text-emerald-300",
      },
      {
        label: "Jobs",
        value: jobMatches.length,
        hint: "top matches",
        accent: "text-sky-300",
      },
      {
        label: "Applications",
        value: applicationCount,
        hint: "submitted",
        accent: "text-amber-300",
      },
    ],
    [activeMissions, applicationCount, interviewCount, jobMatches.length]
  );

  return (
    <div className="min-h-full bg-[#090909] px-4 py-4 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <Header
          firstName={firstName}
          targetRole={profile.targetRole}
          streakDays={profile.streakDays}
          notificationCount={notificationCount}
          lastRefreshed={lastRefreshed}
          onRefresh={() => fetchDashboard(false)}
          refreshing={refreshing}
        />

        <div className="space-y-4">
          {syncingCount > 0 ? (
            <Banner kind="warning" text="Your connected profiles are syncing. Fresh dashboard data will appear shortly." />
          ) : null}
          {needsAnalysis ? (
            <Banner
              kind="neutral"
              text="Profiles synced — run gap analysis to unlock your readiness score and roadmap."
              action="Run Analysis"
              onClick={triggerAnalysis}
              loading={triggering}
            />
          ) : null}
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-12">
          <ReadinessCard readiness={readiness} />
          <div className="grid gap-4 sm:grid-cols-2 xl:col-span-8 2xl:grid-cols-4">
            {heroStats.map((stat) => (
              <StatCard
                key={stat.label}
                label={stat.label}
                value={stat.value}
                hint={stat.hint}
                accent={stat.accent}
              />
            ))}
          </div>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-12">
          <MissionsPanel missions={missions} />
          <JobMatchesPanel jobMatches={jobMatches} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-3">
          <GitHubCard conn={ghConn} />
          <LeetCodeCard conn={lcConn} />
          <StreakCard streakDays={profile.streakDays} />
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-12">
          <WeakTopicsPanel weakTopics={readiness?.weakTopics ?? []} />
          <RecentActivityPanel activities={recentActivity} />
        </div>

        {profile.dreamCompanies.length ? (
          <section className={cn(cardClass, "mt-6")}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className={sectionEyebrow}>Targets</div>
                <h3 className="mt-2 text-xl font-semibold tracking-[-0.04em] text-white">Dream company watchlist</h3>
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
      </div>
    </div>
  );
}

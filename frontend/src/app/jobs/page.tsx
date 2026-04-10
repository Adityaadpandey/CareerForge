"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  MapPin, Bookmark, BookmarkCheck, ExternalLink, Briefcase,
  Zap, Building2, Star, TrendingUp, Search, SlidersHorizontal,
  ChevronRight, Trophy, Target, LayoutGrid,
} from "lucide-react";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";

type Job = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  source: string;
  requirementsTags: string[];
  applyUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  matchScore: number | null;
  applicationStatus: string | null;
  isSaved: boolean;
};

type Section = "all" | "top" | "good" | "saved";

function MatchBar({ score }: { score: number }) {
  const color = score >= 75 ? "bg-amber-400" : score >= 50 ? "bg-blue-400" : "bg-zinc-600";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1 rounded-full bg-zinc-800 overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className={`text-xs font-mono font-semibold ${score >= 75 ? "text-amber-400" : score >= 50 ? "text-blue-400" : "text-zinc-500"}`}>
        {score.toFixed(0)}%
      </span>
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    applied: "bg-green-500/10 text-green-400 border-green-500/20",
    pending: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    saved: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  };
  const cls = map[status.toLowerCase()] ?? "bg-zinc-800 text-zinc-500 border-zinc-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${cls}`}>
      {status}
    </span>
  );
}

function JobCard({
  job,
  applying,
  onCardClick,
  onSave,
  onApply,
  highlight,
}: {
  job: Job;
  applying: string | null;
  onCardClick: (id: string) => void;
  onSave: (id: string) => void;
  onApply: (id: string) => void;
  highlight?: boolean;
}) {
  return (
    <div
      onClick={() => onCardClick(job.id)}
      className={`group relative bg-zinc-900/50 border rounded-2xl p-5 cursor-pointer transition-all duration-200
        hover:bg-zinc-900 hover:shadow-lg hover:shadow-black/20
        ${highlight
          ? "border-amber-500/30 hover:border-amber-500/50"
          : "border-zinc-800/60 hover:border-zinc-700"
        }`}
    >
      {highlight && (
        <div className="absolute top-0 left-0 right-0 h-px rounded-t-2xl bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
      )}

      <div className="flex items-start gap-4">
        {/* Company icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 font-bold text-sm
          ${highlight ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" : "bg-zinc-800 text-zinc-400 border border-zinc-700"}`}>
          {job.company.charAt(0).toUpperCase()}
        </div>

        <div className="flex-1 min-w-0">
          {/* Title row */}
          <div className="flex items-start justify-between gap-3 mb-1.5">
            <div>
              <h3 className="text-sm font-semibold text-white group-hover:text-white leading-snug">
                {job.title}
              </h3>
              <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                <span className="text-xs text-zinc-400 font-medium flex items-center gap-1">
                  <Building2 className="w-3 h-3" />{job.company}
                </span>
                {job.location && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />{job.location}
                  </span>
                )}
                {job.isRemote && (
                  <span className="text-[10px] font-mono text-green-400 bg-green-500/10 border border-green-500/20 px-1.5 py-0.5 rounded-full">
                    Remote
                  </span>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => onSave(job.id)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-all"
              >
                {job.isSaved
                  ? <BookmarkCheck className="w-4 h-4 text-amber-400" />
                  : <Bookmark className="w-4 h-4" />}
              </button>

              {!job.applicationStatus ? (
                <button
                  onClick={() => onApply(job.id)}
                  disabled={applying === job.id}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-semibold rounded-lg transition-colors disabled:opacity-50"
                >
                  {applying === job.id
                    ? <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                    : <Zap className="w-3 h-3" />}
                  Quick Apply
                </button>
              ) : (
                <a
                  href={job.applyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-300 hover:text-white hover:border-zinc-600 text-xs rounded-lg transition-colors"
                >
                  Apply <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>

          {/* Match + salary row */}
          <div className="flex items-center gap-4 mt-2">
            {job.matchScore != null && <MatchBar score={job.matchScore} />}
            {job.salaryMin != null && (
              <span className="text-xs text-zinc-500 font-mono">
                ${job.salaryMin.toLocaleString()}
                {job.salaryMax != null ? `–${job.salaryMax.toLocaleString()}` : "+"}
              </span>
            )}
            {job.applicationStatus && <StatusPill status={job.applicationStatus} />}
          </div>

          {/* Tags */}
          {job.requirementsTags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-2.5">
              {job.requirementsTags.slice(0, 6).map((tag) => (
                <span
                  key={tag}
                  className="px-2 py-0.5 rounded-md bg-zinc-800/80 text-zinc-500 text-[10px] font-mono border border-zinc-700/50"
                >
                  {tag}
                </span>
              ))}
              {job.requirementsTags.length > 6 && (
                <span className="px-2 py-0.5 text-[10px] font-mono text-zinc-600">
                  +{job.requirementsTags.length - 6}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  count,
  accent,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  count: number;
  accent?: string;
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ?? "bg-zinc-800 text-zinc-400"}`}>
        {icon}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-white">{title}</h2>
          <span className="px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-500 text-[10px] font-mono border border-zinc-700">
            {count}
          </span>
        </div>
        <p className="text-[11px] text-zinc-600 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

const TABS: { id: Section; label: string; icon: React.ReactNode }[] = [
  { id: "all", label: "All Jobs", icon: <LayoutGrid className="w-3.5 h-3.5" /> },
  { id: "top", label: "Top Picks", icon: <Trophy className="w-3.5 h-3.5" /> },
  { id: "good", label: "Good Match", icon: <Target className="w-3.5 h-3.5" /> },
  { id: "saved", label: "Saved", icon: <Bookmark className="w-3.5 h-3.5" /> },
];

export default function JobsPage() {
  const [applying, setApplying] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState<Section>("all");
  const qc = useQueryClient();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    queryKey: ["jobs"],
    queryFn: () => axios.get<{ jobs: Job[] }>("/api/jobs").then((r) => r.data),
  });

  const saveMutation = useMutation({
    mutationFn: (jobId: string) => axios.post(`/api/jobs/${jobId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["jobs"] }),
  });

  const applyMutation = useMutation({
    mutationFn: (jobId: string) => axios.post(`/api/jobs/${jobId}/apply`),
    onSuccess: () => {
      toast.success("CV + cover letter generated! Review and apply.");
      setApplying(null);
      qc.invalidateQueries({ queryKey: ["jobs"] });
    },
    onError: () => {
      toast.error("Failed to generate application.");
      setApplying(null);
    },
  });

  const jobs = data?.jobs ?? [];

  const filtered = jobs.filter((j) => {
    const q = search.toLowerCase();
    return !q || j.title.toLowerCase().includes(q) || j.company.toLowerCase().includes(q);
  });

  const topPicks = filtered.filter((j) => (j.matchScore ?? 0) >= 75);
  const goodMatch = filtered.filter((j) => { const s = j.matchScore ?? 0; return s >= 50 && s < 75; });
  const allOther = filtered.filter((j) => (j.matchScore ?? 0) < 50);
  const savedJobs = filtered.filter((j) => j.isSaved);

  const visibleJobs = activeTab === "top" ? topPicks
    : activeTab === "good" ? goodMatch
    : activeTab === "saved" ? savedJobs
    : filtered;

  const stats = [
    { label: "Total Matched", value: jobs.length, icon: <LayoutGrid className="w-4 h-4" />, color: "text-zinc-400" },
    { label: "Top Picks", value: jobs.filter((j) => (j.matchScore ?? 0) >= 75).length, icon: <Trophy className="w-4 h-4" />, color: "text-amber-400" },
    { label: "Applied", value: jobs.filter((j) => j.applicationStatus).length, icon: <TrendingUp className="w-4 h-4" />, color: "text-green-400" },
    { label: "Saved", value: jobs.filter((j) => j.isSaved).length, icon: <Bookmark className="w-4 h-4" />, color: "text-blue-400" },
  ];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 min-w-0 px-6 py-8 md:px-10 md:py-10 max-w-4xl">

        {/* Header */}
        <div className="mb-8">
          <p className="text-[10px] font-mono tracking-[0.2em] text-zinc-600 uppercase mb-2">Job Pipeline</p>
          <h1 className="text-3xl font-light text-white tracking-tight mb-1">
            Your Opportunities
          </h1>
          <p className="text-sm text-zinc-500">
            AI-matched roles ranked by your profile fit
          </p>
        </div>

        {/* Stats row */}
        {!isLoading && jobs.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-8">
            {stats.map((s) => (
              <div key={s.label} className="bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-4">
                <div className={`mb-2 ${s.color}`}>{s.icon}</div>
                <div className="text-2xl font-light text-white">{s.value}</div>
                <div className="text-[11px] text-zinc-600 font-mono mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Search + Tabs */}
        {!isLoading && jobs.length > 0 && (
          <div className="flex items-center gap-3 mb-6 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-600" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by title or company…"
                className="w-full pl-9 pr-4 py-2 bg-zinc-900/60 border border-zinc-800 rounded-xl text-sm text-zinc-300 placeholder-zinc-600 focus:outline-none focus:border-zinc-600 transition-colors"
              />
            </div>

            <div className="flex items-center gap-1 bg-zinc-900/60 border border-zinc-800 rounded-xl p-1">
              {TABS.map((tab) => {
                const count = tab.id === "all" ? filtered.length
                  : tab.id === "top" ? topPicks.length
                  : tab.id === "good" ? goodMatch.length
                  : savedJobs.length;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                      ${activeTab === tab.id
                        ? "bg-zinc-800 text-white shadow-sm"
                        : "text-zinc-500 hover:text-zinc-300"
                      }`}
                  >
                    {tab.icon}
                    {tab.label}
                    <span className={`text-[10px] font-mono ${activeTab === tab.id ? "text-zinc-400" : "text-zinc-700"}`}>
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Loading skeletons */}
        {isLoading && (
          <div className="space-y-3">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-28 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 animate-pulse" />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-5">
              <Briefcase className="w-7 h-7 text-zinc-700" />
            </div>
            <h2 className="text-lg font-light text-white mb-2">No jobs yet</h2>
            <p className="text-zinc-500 text-sm max-w-xs leading-relaxed">
              Jobs are fetched and matched after your profile analysis completes. Check back soon.
            </p>
          </div>
        )}

        {/* All jobs tab — sectioned view */}
        {!isLoading && activeTab === "all" && filtered.length > 0 && (
          <div className="space-y-10">
            {topPicks.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Trophy className="w-4 h-4" />}
                  title="Top Picks"
                  subtitle="75%+ match — you're a strong candidate"
                  count={topPicks.length}
                  accent="bg-amber-500/10 text-amber-400"
                />
                <div className="space-y-3">
                  {topPicks.map((job) => (
                    <JobCard key={job.id} job={job} applying={applying} highlight
                      onCardClick={(id) => router.push(`/jobs/${id}`)}
                      onSave={(id) => saveMutation.mutate(id)}
                      onApply={(id) => { setApplying(id); applyMutation.mutate(id); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {goodMatch.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Target className="w-4 h-4" />}
                  title="Good Match"
                  subtitle="50–74% match — worth exploring with some prep"
                  count={goodMatch.length}
                  accent="bg-blue-500/10 text-blue-400"
                />
                <div className="space-y-3">
                  {goodMatch.map((job) => (
                    <JobCard key={job.id} job={job} applying={applying}
                      onCardClick={(id) => router.push(`/jobs/${id}`)}
                      onSave={(id) => saveMutation.mutate(id)}
                      onApply={(id) => { setApplying(id); applyMutation.mutate(id); }}
                    />
                  ))}
                </div>
              </div>
            )}

            {allOther.length > 0 && (
              <div>
                <SectionHeader
                  icon={<Star className="w-4 h-4" />}
                  title="All Eligible"
                  subtitle="Roles you meet the baseline requirements for"
                  count={allOther.length}
                  accent="bg-zinc-800 text-zinc-500"
                />
                <div className="space-y-3">
                  {allOther.map((job) => (
                    <JobCard key={job.id} job={job} applying={applying}
                      onCardClick={(id) => router.push(`/jobs/${id}`)}
                      onSave={(id) => saveMutation.mutate(id)}
                      onApply={(id) => { setApplying(id); applyMutation.mutate(id); }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Filtered tab views */}
        {!isLoading && activeTab !== "all" && (
          <div className="space-y-3">
            {visibleJobs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
                  <SlidersHorizontal className="w-5 h-5 text-zinc-700" />
                </div>
                <p className="text-zinc-500 text-sm">
                  {activeTab === "saved" ? "No saved jobs yet." : "No jobs in this category."}
                </p>
              </div>
            ) : (
              visibleJobs.map((job) => (
                <JobCard key={job.id} job={job} applying={applying}
                  highlight={activeTab === "top"}
                  onCardClick={(id) => router.push(`/jobs/${id}`)}
                  onSave={(id) => saveMutation.mutate(id)}
                  onApply={(id) => { setApplying(id); applyMutation.mutate(id); }}
                />
              ))
            )}
          </div>
        )}
      </main>
    </div>
  );
}

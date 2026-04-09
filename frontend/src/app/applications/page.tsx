"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import { ExternalLink, FileText, Briefcase, ChevronDown, Loader2 } from "lucide-react";
import { useState } from "react";

type Application = {
  id: string;
  matchScore: number;
  status: string;
  cvGenerated: string | null;
  coverLetter: string | null;
  appliedAt: string | null;
  notes: string | null;
  createdAt: string;
  job: {
    title: string;
    company: string;
    location: string | null;
    applyUrl: string;
  };
};

const STATUS_COLORS: Record<string, string> = {
  DRAFT: "bg-zinc-800 text-zinc-400 border-zinc-700",
  APPLIED: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  VIEWED: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  INTERVIEWING: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  OFFERED: "bg-green-500/10 text-green-400 border-green-500/20",
  REJECTED: "bg-red-500/10 text-red-400 border-red-500/20",
  WITHDRAWN: "bg-zinc-800 text-zinc-600 border-zinc-700",
};

const STATUSES = ["DRAFT", "APPLIED", "VIEWED", "INTERVIEWING", "OFFERED", "REJECTED", "WITHDRAWN"];

function ApplicationCard({ app }: { app: Application }) {
  const [expanded, setExpanded] = useState(false);
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (status: string) =>
      axios.patch(`/api/applications/${app.id}`, { status }),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["applications"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden">
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h3 className="text-sm font-medium text-white">{app.job.title}</h3>
              <span
                className={`px-2 py-0.5 rounded-full text-xs font-mono border ${STATUS_COLORS[app.status] ?? STATUS_COLORS.DRAFT}`}
              >
                {app.status}
              </span>
              <span className="text-xs font-mono text-zinc-500">
                {app.matchScore.toFixed(0)}% match
              </span>
            </div>
            <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono">
              <span>{app.job.company}</span>
              {app.job.location && <span>· {app.job.location}</span>}
              <span>· {new Date(app.createdAt).toLocaleDateString()}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Status changer */}
            <select
              value={app.status}
              onChange={(e) => statusMutation.mutate(e.target.value)}
              disabled={statusMutation.isPending}
              className="bg-zinc-800 border border-zinc-700 text-zinc-400 text-xs rounded-lg px-2 py-1.5 focus:outline-none focus:border-amber-500/50"
            >
              {STATUSES.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>

            <a
              href={app.job.applyUrl}
              target="_blank"
              rel="noreferrer"
              className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>

            {(app.cvGenerated || app.coverLetter) && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-white transition-colors"
              >
                <ChevronDown
                  className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
                />
              </button>
            )}
          </div>
        </div>
      </div>

      {expanded && (app.cvGenerated || app.coverLetter) && (
        <div className="border-t border-zinc-800/60 p-5 space-y-4">
          {app.cvGenerated && (
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
                Generated CV
              </p>
              <pre className="text-xs text-zinc-300 bg-zinc-950 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {app.cvGenerated}
              </pre>
            </div>
          )}
          {app.coverLetter && (
            <div>
              <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-2">
                Cover Letter
              </p>
              <pre className="text-xs text-zinc-300 bg-zinc-950 rounded-xl p-4 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
                {app.coverLetter}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function ApplicationsPage() {
  const { data, isLoading } = useQuery<Application[]>({
    queryKey: ["applications"],
    queryFn: () => axios.get<Application[]>("/api/applications").then((r) => r.data),
  });

  const apps = data ?? [];

  const grouped = {
    active: apps.filter((a) => ["APPLIED", "VIEWED", "INTERVIEWING"].includes(a.status)),
    offers: apps.filter((a) => a.status === "OFFERED"),
    drafts: apps.filter((a) => a.status === "DRAFT"),
    closed: apps.filter((a) => ["REJECTED", "WITHDRAWN"].includes(a.status)),
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-4xl">
        <div className="mb-6">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Tracker</p>
          <h1 className="text-2xl text-white font-light">Applications</h1>
        </div>

        {/* Stats */}
        {!isLoading && apps.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: "Active", count: grouped.active.length, color: "text-blue-400" },
              { label: "Offers", count: grouped.offers.length, color: "text-green-400" },
              { label: "Drafts", count: grouped.drafts.length, color: "text-zinc-400" },
              { label: "Closed", count: grouped.closed.length, color: "text-zinc-600" },
            ].map(({ label, count, color }) => (
              <div key={label} className="bg-zinc-900/40 border border-zinc-800/60 rounded-xl p-4">
                <p className={`text-2xl font-light ${color}`}>{count}</p>
                <p className="text-xs text-zinc-500 font-mono mt-1">{label}</p>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        )}

        {!isLoading && apps.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Briefcase className="w-10 h-10 text-zinc-700 mb-4" />
            <h2 className="text-lg text-white font-light mb-2">No applications yet</h2>
            <p className="text-zinc-500 text-sm max-w-sm">
              Generate a CV for a job in the Jobs page to start tracking applications.
            </p>
          </div>
        )}

        {!isLoading && apps.length > 0 && (
          <div className="space-y-6">
            {grouped.offers.length > 0 && (
              <section>
                <p className="text-xs font-mono text-green-400 uppercase tracking-widest mb-3">
                  Offers ({grouped.offers.length})
                </p>
                <div className="space-y-3">
                  {grouped.offers.map((a) => <ApplicationCard key={a.id} app={a} />)}
                </div>
              </section>
            )}

            {grouped.active.length > 0 && (
              <section>
                <p className="text-xs font-mono text-blue-400 uppercase tracking-widest mb-3">
                  In Progress ({grouped.active.length})
                </p>
                <div className="space-y-3">
                  {grouped.active.map((a) => <ApplicationCard key={a.id} app={a} />)}
                </div>
              </section>
            )}

            {grouped.drafts.length > 0 && (
              <section>
                <p className="text-xs font-mono text-zinc-500 uppercase tracking-widest mb-3">
                  Drafts ({grouped.drafts.length})
                </p>
                <div className="space-y-3">
                  {grouped.drafts.map((a) => <ApplicationCard key={a.id} app={a} />)}
                </div>
              </section>
            )}

            {grouped.closed.length > 0 && (
              <section>
                <p className="text-xs font-mono text-zinc-600 uppercase tracking-widest mb-3">
                  Closed ({grouped.closed.length})
                </p>
                <div className="space-y-3">
                  {grouped.closed.map((a) => <ApplicationCard key={a.id} app={a} />)}
                </div>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

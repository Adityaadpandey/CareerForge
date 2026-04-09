"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import {
  MapPin, Bookmark, BookmarkCheck, ExternalLink, Briefcase,
  ChevronRight, Zap, Building2,
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

function MatchBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const color = score >= 70 ? "bg-green-500/10 text-green-400 border-green-500/20"
    : score >= 50 ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
    : "bg-zinc-800 text-zinc-500 border-zinc-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${color}`}>
      {score.toFixed(0)}% match
    </span>
  );
}

export default function JobsPage() {
  const [applying, setApplying] = useState<string | null>(null);
  const qc = useQueryClient();

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
    onSuccess: (_, jobId) => {
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

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-5xl">
        <div className="mb-6">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Job Pipeline</p>
          <h1 className="text-2xl text-white font-light">Matched Opportunities</h1>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-24 rounded-2xl bg-zinc-900/60 border border-zinc-800/60 animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && jobs.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Briefcase className="w-10 h-10 text-zinc-700 mb-4" />
            <h2 className="text-lg text-white font-light mb-2">No jobs yet</h2>
            <p className="text-zinc-500 text-sm max-w-sm">
              Jobs are fetched and matched after your profile analysis completes.
              Check back soon.
            </p>
          </div>
        )}

        <div className="space-y-3">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 hover:border-zinc-700 transition-colors"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="text-sm font-medium text-white">{job.title}</h3>
                    <MatchBadge score={job.matchScore} />
                    {job.applicationStatus && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                        {job.applicationStatus}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono flex-wrap">
                    <span className="flex items-center gap-1">
                      <Building2 className="w-3 h-3" />{job.company}
                    </span>
                    {job.location && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />{job.location}
                      </span>
                    )}
                    {job.isRemote && <span className="text-green-500">Remote</span>}
                    {job.salaryMin && (
                      <span>${job.salaryMin.toLocaleString()}–${job.salaryMax?.toLocaleString() ?? "?"}</span>
                    )}
                  </div>

                  {job.requirementsTags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {job.requirementsTags.slice(0, 5).map((tag) => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500 text-[10px] font-mono"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => saveMutation.mutate(job.id)}
                    className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
                  >
                    {job.isSaved ? (
                      <BookmarkCheck className="w-4 h-4 text-amber-400" />
                    ) : (
                      <Bookmark className="w-4 h-4" />
                    )}
                  </button>

                  {!job.applicationStatus ? (
                    <button
                      onClick={() => {
                        setApplying(job.id);
                        applyMutation.mutate(job.id);
                      }}
                      disabled={applying === job.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                    >
                      {applying === job.id ? (
                        <div className="w-3 h-3 border-2 border-black/30 border-t-black rounded-full animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      Generate CV
                    </button>
                  ) : (
                    <a
                      href={job.applyUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white text-xs rounded-lg transition-colors"
                    >
                      Apply
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

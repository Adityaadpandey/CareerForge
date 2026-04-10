"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import type { CvData, CoverLetterData } from "@/components/pdf/types";
import {
  ArrowLeft,
  MapPin,
  Building2,
  Zap,
  Bookmark,
  BookmarkCheck,
  ExternalLink,
  CheckCircle2,
  XCircle,
  Loader2,
  X,
  Download,
  Code2,
  Users,
  Briefcase,
  LayoutGrid,
  Play,
  FileText,
  Mail,
  Mic,
} from "lucide-react";

// ── Types ────────────────────────────────────────────────────

type JobDetail = {
  id: string;
  title: string;
  company: string;
  location: string | null;
  isRemote: boolean;
  applyUrl: string;
  requirementsTags: string[];
  requirementsText: string;
  salaryMin: number | null;
  salaryMax: number | null;
  matchScore: number | null;
  applicationStatus: string | null;
  isSaved: boolean;
};

type SkillAnalysis = {
  matched: string[];
  gaps: string[];
  suggestions: string[];
};

type InterviewType = "TECHNICAL" | "SYSTEM_DESIGN" | "BEHAVIORAL" | "HR" | "MIXED";

const INTERVIEW_TYPES: { type: InterviewType; label: string; icon: React.ElementType }[] = [
  { type: "TECHNICAL", label: "Technical", icon: Code2 },
  { type: "SYSTEM_DESIGN", label: "System Design", icon: LayoutGrid },
  { type: "BEHAVIORAL", label: "Behavioral", icon: Users },
  { type: "HR", label: "HR", icon: Briefcase },
  { type: "MIXED", label: "Mixed", icon: Zap },
];

// ── Helpers ──────────────────────────────────────────────────

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sub-components ───────────────────────────────────────────

function MatchBadge({ score }: { score: number | null }) {
  if (!score) return null;
  const color =
    score >= 70
      ? "bg-green-500/10 text-green-400 border-green-500/20"
      : score >= 50
      ? "bg-amber-500/10 text-amber-400 border-amber-500/20"
      : "bg-zinc-800 text-zinc-500 border-zinc-700";
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-mono border ${color}`}>
      {score.toFixed(0)}% match
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`bg-zinc-800/60 rounded animate-pulse ${className ?? ""}`} />;
}

function PdfSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[10px] font-bold text-amber-400 uppercase tracking-widest pl-1.5 border-l-2 border-amber-400 mb-2">
        {label}
      </p>
      {children}
    </div>
  );
}

function SkillRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-3 text-xs mb-1">
      <span className="font-bold text-zinc-200 w-24 shrink-0">{label}</span>
      <span className="text-zinc-400">{value}</span>
    </div>
  );
}

function CvPreview({ data }: { data: CvData }) {
  const contact = [data.email, data.phone, data.linkedin, data.github]
    .filter(Boolean)
    .join("  ·  ");
  return (
    <div className="space-y-6 font-mono">
      <div>
        <p className="text-2xl font-bold text-white">{data.name}</p>
        <p className="text-xs text-zinc-400 mt-1">{contact}</p>
        <div className="border-b border-amber-500 mt-3" />
      </div>
      <PdfSection label="Summary">
        <p className="text-sm text-zinc-300 leading-relaxed">{data.summary}</p>
      </PdfSection>
      <PdfSection label="Skills">
        {data.skills.languages.length > 0 && (
          <SkillRow label="Languages" value={data.skills.languages.join(", ")} />
        )}
        {data.skills.frameworks.length > 0 && (
          <SkillRow label="Frameworks" value={data.skills.frameworks.join(", ")} />
        )}
        {data.skills.tools.length > 0 && (
          <SkillRow label="Tools" value={data.skills.tools.join(", ")} />
        )}
      </PdfSection>
      <PdfSection label="Projects">
        {data.projects.map((p, i) => (
          <div key={i} className="mb-4">
            <div className="flex items-baseline justify-between">
              <span className="text-sm font-bold text-white">{p.name}</span>
              <span className="text-xs text-zinc-400">{p.tech.join(" · ")}</span>
            </div>
            <ul className="mt-1 space-y-0.5">
              {p.bullets.map((b, j) => (
                <li key={j} className="text-xs text-zinc-300 pl-3">• {b}</li>
              ))}
            </ul>
          </div>
        ))}
      </PdfSection>
      <PdfSection label="Education">
        <p className="text-sm font-bold text-white">{data.education.degree}</p>
        <p className="text-xs text-zinc-400">
          {data.education.institution} · Expected {data.education.year}
        </p>
      </PdfSection>
    </div>
  );
}

function ClPreview({ data }: { data: CoverLetterData }) {
  const contact = [data.email, data.phone].filter(Boolean).join("  ·  ");
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  return (
    <div className="space-y-5 font-mono">
      <div>
        <p className="text-xl font-bold text-white">{data.name}</p>
        <p className="text-xs text-zinc-400 mt-1">{contact}</p>
        <div className="border-b border-amber-500 mt-3" />
      </div>
      <p className="text-xs text-zinc-500">{today}</p>
      <p className="text-sm font-bold text-zinc-200">{data.greeting}</p>
      {data.paragraphs.map((p, i) => (
        <p key={i} className="text-sm text-zinc-300 leading-relaxed">{p}</p>
      ))}
      <div>
        <p className="text-sm text-zinc-300">{data.closing}</p>
        <p className="text-sm font-bold text-white mt-4">{data.name}</p>
      </div>
    </div>
  );
}

function DocumentModal({
  title,
  kind,
  cvData,
  clData,
  company,
  legacyText,
  onClose,
}: {
  title: string;
  kind: "cv" | "cl";
  cvData?: CvData;
  clData?: CoverLetterData;
  company: string;
  legacyText?: string;
  onClose: () => void;
}) {
  const [downloading, setDownloading] = useState(false);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      const slug = company.toLowerCase().replace(/\s+/g, "-");
      if (kind === "cv" && cvData) {
        const { pdf } = await import("@react-pdf/renderer");
        const { CVDocument } = await import("@/components/pdf/cv-document");
        const blob = await pdf(<CVDocument data={cvData} />).toBlob();
        triggerDownload(blob, `cv-${slug}.pdf`);
      } else if (kind === "cl" && clData) {
        const { pdf } = await import("@react-pdf/renderer");
        const { CoverLetterDocument } = await import(
          "@/components/pdf/cover-letter-document"
        );
        const blob = await pdf(<CoverLetterDocument data={clData} />).toBlob();
        triggerDownload(blob, `cover-letter-${slug}.pdf`);
      }
    } catch {
      toast.error("Failed to create PDF");
    } finally {
      setDownloading(false);
    }
  };

  const canDownload = !legacyText && ((kind === "cv" && !!cvData) || (kind === "cl" && !!clData));

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-3xl max-h-[88vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 shrink-0">
          <h2 className="text-sm font-medium text-white">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={handleDownload}
              disabled={downloading || !canDownload}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Download className="w-3 h-3" />
              )}
              Download PDF
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-zinc-500 hover:text-white transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Modal body */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {legacyText ? (
            <pre className="text-sm text-zinc-300 font-mono whitespace-pre-wrap leading-relaxed">
              {legacyText}
            </pre>
          ) : kind === "cv" && cvData ? (
            <CvPreview data={cvData} />
          ) : kind === "cl" && clData ? (
            <ClPreview data={clData} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── Main page ────────────────────────────────────────────────

export default function JobDetailPage() {
  const { id: jobId } = useParams<{ id: string }>();
  const router = useRouter();
  const qc = useQueryClient();

  const [cvModal, setCvModal] = useState(false);
  const [clModal, setClModal] = useState(false);
  const [interviewType, setInterviewType] = useState<InterviewType>("TECHNICAL");
  const [cvData, setCvData] = useState<CvData | null>(null);
  const [clData, setClData] = useState<CoverLetterData | null>(null);

  // ── Job data ──────────────────────────────────────────────
  const { data: job, isLoading: jobLoading } = useQuery<JobDetail>({
    queryKey: ["job", jobId],
    queryFn: () =>
      axios.get<JobDetail>(`/api/jobs/${jobId}`).then((r) => r.data),
  });

  // ── Live description (parallel) ───────────────────────────
  const { data: descData, isLoading: descLoading } = useQuery<{
    description: string;
    fallback: boolean;
  }>({
    queryKey: ["job-description", jobId],
    queryFn: () =>
      axios.post(`/api/jobs/${jobId}/description`).then((r) => r.data),
    retry: false,
  });

  // ── Skill analysis (parallel) ─────────────────────────────
  const {
    data: skillData,
    isLoading: skillLoading,
    refetch: refetchSkills,
  } = useQuery<SkillAnalysis>({
    queryKey: ["job-skills", jobId],
    queryFn: () =>
      axios.post(`/api/jobs/${jobId}/skill-analysis`).then((r) => r.data),
    retry: false,
  });

  // ── Save ──────────────────────────────────────────────────
  const saveMutation = useMutation({
    mutationFn: () => axios.post(`/api/jobs/${jobId}/save`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["job", jobId] }),
  });

  // ── Generate CV ───────────────────────────────────────────
  const cvMutation = useMutation({
    mutationFn: () =>
      axios
        .post<{ cv: CvData }>(`/api/jobs/${jobId}/generate-cv`)
        .then((r) => r.data),
    onSuccess: (data) => {
      setCvData(data.cv);
      toast.success("CV generated!");
      setCvModal(true);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Failed to generate CV"),
  });

  // ── Generate Cover Letter ─────────────────────────────────
  const clMutation = useMutation({
    mutationFn: () =>
      axios
        .post<{ cover_letter: CoverLetterData }>(
          `/api/jobs/${jobId}/generate-cover-letter`
        )
        .then((r) => r.data),
    onSuccess: (data) => {
      setClData(data.cover_letter);
      toast.success("Cover letter generated!");
      setClModal(true);
      qc.invalidateQueries({ queryKey: ["job", jobId] });
    },
    onError: () => toast.error("Failed to generate cover letter"),
  });

  // ── Start interview ───────────────────────────────────────
  const interviewMutation = useMutation({
    mutationFn: () =>
      axios
        .post<{ id: string }>("/api/interviews", {
          type: interviewType,
          jobId,
          company: job?.company,
          role: job?.title,
        })
        .then((r) => r.data),
    onSuccess: (session) => router.push(`/interview/${session.id}/call`),
    onError: () => toast.error("Failed to start interview"),
  });

  const effectiveCvData = cvData;
  const effectiveClData = clData;
  const legacyCvText = undefined;
  const legacyClText = undefined;

  // ── Loading state ─────────────────────────────────────────
  if (jobLoading) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-4 w-28" />
          <div className="space-y-3">
            <Skeleton className="h-8 w-72" />
            <Skeleton className="h-4 w-48" />
          </div>
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="flex min-h-screen bg-[#0a0a0a]">
        <Sidebar />
        <main className="flex-1 p-6 flex items-center justify-center">
          <p className="text-zinc-500 text-sm">Job not found.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-4xl mx-auto space-y-8">

        {/* ── Back ─────────────────────────────────────────── */}
        <Link
          href="/jobs"
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to jobs
        </Link>

        {/* ── Header card ──────────────────────────────────── */}
        <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <h1 className="text-xl text-white font-medium">{job.title}</h1>
                <MatchBadge score={job.matchScore} />
                {job.applicationStatus && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                    {job.applicationStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-zinc-500 font-mono flex-wrap mb-3">
                <span className="flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {job.company}
                </span>
                {job.location && (
                  <span className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {job.location}
                  </span>
                )}
                {job.isRemote && <span className="text-green-500">Remote</span>}
                {job.salaryMin && (
                  <span>
                    ${job.salaryMin.toLocaleString()}–$
                    {job.salaryMax?.toLocaleString() ?? "?"}
                  </span>
                )}
              </div>
              {job.requirementsTags.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {job.requirementsTags.slice(0, 10).map((tag) => (
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
            <div className="flex items-center gap-2 shrink-0">
              <button
                onClick={() => saveMutation.mutate()}
                className="w-8 h-8 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors"
              >
                {job.isSaved ? (
                  <BookmarkCheck className="w-4 h-4 text-amber-400" />
                ) : (
                  <Bookmark className="w-4 h-4" />
                )}
              </button>
              <a
                href={job.applyUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-white text-xs rounded-lg transition-colors"
              >
                Apply <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>

        {/* ── Actions row ──────────────────────────────────── */}
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              if (effectiveCvData || legacyCvText) { setCvModal(true); return; }
              cvMutation.mutate();
            }}
            disabled={cvMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-zinc-300 hover:text-white text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {cvMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <FileText className="w-4 h-4" />
            )}
            {effectiveCvData || legacyCvText ? "Preview CV" : "Generate CV"}
          </button>
          <button
            onClick={() => {
              if (effectiveClData || legacyClText) { setClModal(true); return; }
              clMutation.mutate();
            }}
            disabled={clMutation.isPending}
            className="flex items-center gap-2 px-4 py-2.5 bg-zinc-900 border border-zinc-700 hover:border-amber-500/40 text-zinc-300 hover:text-white text-sm rounded-xl transition-colors disabled:opacity-50"
          >
            {clMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Mail className="w-4 h-4" />
            )}
            {effectiveClData || legacyClText ? "Preview Cover Letter" : "Generate Cover Letter"}
          </button>
        </div>

        {/* ── Job Description ───────────────────────────────── */}
        <section>
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Job Description
          </p>
          {descLoading ? (
            <div className="space-y-2.5">
              {[...Array(6)].map((_, i) => (
                <Skeleton
                  key={i}
                  className={`h-4 ${
                    i % 3 === 2 ? "w-4/6" : i % 2 === 0 ? "w-full" : "w-5/6"
                  }`}
                />
              ))}
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
              {descData?.fallback && (
                <p className="text-[10px] text-zinc-600 font-mono mb-3 uppercase tracking-wider">
                  Using cached description
                </p>
              )}
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                {descData?.description ?? job.requirementsText}
              </div>
            </div>
          )}
        </section>

        {/* ── Skills Analysis ───────────────────────────────── */}
        <section>
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Skills Analysis
          </p>
          {skillLoading ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 space-y-5">
              <div>
                <Skeleton className="h-3 w-28 mb-3" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(5)].map((_, i) => (
                    <Skeleton key={i} className="h-7 w-20 rounded-full" />
                  ))}
                </div>
              </div>
              <div>
                <Skeleton className="h-3 w-24 mb-3" />
                <div className="flex flex-wrap gap-2">
                  {[...Array(4)].map((_, i) => (
                    <Skeleton key={i} className="h-7 w-24 rounded-full" />
                  ))}
                </div>
              </div>
            </div>
          ) : skillData ? (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 space-y-5">
              {skillData.matched.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
                    <p className="text-xs font-mono text-green-400 uppercase tracking-wider">
                      You have ({skillData.matched.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skillData.matched.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-xs bg-green-500/10 text-green-400 border border-green-500/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skillData.gaps.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-2.5">
                    <XCircle className="w-3.5 h-3.5 text-amber-400" />
                    <p className="text-xs font-mono text-amber-400 uppercase tracking-wider">
                      Work on ({skillData.gaps.length})
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {skillData.gaps.map((s) => (
                      <span
                        key={s}
                        className="px-2.5 py-1 rounded-full text-xs bg-amber-500/10 text-amber-400 border border-amber-500/20"
                      >
                        {s}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              {skillData.suggestions.length > 0 && (
                <div className="border-t border-zinc-800/60 pt-4">
                  <p className="text-xs font-mono text-zinc-500 uppercase tracking-wider mb-2.5">
                    Suggestions
                  </p>
                  <ul className="space-y-2">
                    {skillData.suggestions.map((s, i) => (
                      <li
                        key={i}
                        className="text-xs text-zinc-400 flex items-start gap-2 leading-relaxed"
                      >
                        <span className="text-amber-500 mt-0.5 shrink-0">→</span>
                        {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 text-center">
              <p className="text-sm text-zinc-500 mb-2">Analysis unavailable.</p>
              <button
                onClick={() => refetchSkills()}
                className="text-xs text-amber-400 hover:underline"
              >
                Try again
              </button>
            </div>
          )}
        </section>

        {/* ── Mock Interview ────────────────────────────────── */}
        <section className="pb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-3">
            Mock Interview
          </p>
          <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
            <div className="flex items-start gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Mic className="w-4 h-4 text-amber-400" />
              </div>
              <div>
                <p className="text-sm font-medium text-white">
                  Interview at {job.company}
                </p>
                <p className="text-xs text-zinc-500 mt-0.5">
                  AI adopts {job.company}&apos;s interview style with questions
                  tailored to this role
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mb-5">
              {INTERVIEW_TYPES.map(({ type, label, icon: Icon }) => (
                <button
                  key={type}
                  onClick={() => setInterviewType(type)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-medium transition-colors ${
                    interviewType === type
                      ? "bg-amber-500/10 border-amber-500/30 text-amber-400"
                      : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-300"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {label}
                </button>
              ))}
            </div>
            <button
              onClick={() => interviewMutation.mutate()}
              disabled={interviewMutation.isPending}
              className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
            >
              {interviewMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Play className="w-4 h-4" />
              )}
              Start Interview
            </button>
          </div>
        </section>

      </main>

      {/* ── Document modals ──────────────────────────────────── */}
      {cvModal && (
        <DocumentModal
          title="Generated CV"
          kind="cv"
          cvData={effectiveCvData ?? undefined}
          company={job.company}
          legacyText={legacyCvText}
          onClose={() => setCvModal(false)}
        />
      )}
      {clModal && (
        <DocumentModal
          title="Cover Letter"
          kind="cl"
          clData={effectiveClData ?? undefined}
          company={job.company}
          legacyText={legacyClText}
          onClose={() => setClModal(false)}
        />
      )}
    </div>
  );
}

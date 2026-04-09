"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useState } from "react";
import { Search, Flame } from "lucide-react";
import { AdminSidebar } from "@/components/admin/admin-sidebar";

type Student = {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
  segment: string;
  streak: number;
  targetRole: string | null;
  readiness: number | null;
  missionsCompleted: number;
  onboardingDone: boolean;
};

type Stats = { students: Student[]; totalStudents: number };

const SEGMENT_COLORS: Record<string, string> = {
  RISING_STAR: "text-green-400 bg-green-500/10 border-green-500/20",
  CAPABLE: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  AT_RISK: "text-amber-400 bg-amber-500/10 border-amber-500/20",
  CRITICAL: "text-red-400 bg-red-500/10 border-red-500/20",
  UNASSESSED: "text-zinc-400 bg-zinc-800 border-zinc-700",
};

function ReadinessBar({ score }: { score: number | null }) {
  if (score === null) return <span className="text-zinc-600 text-xs">—</span>;
  const color = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";
  return (
    <div className="flex items-center gap-2">
      <div className="w-20 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-400">{score}</span>
    </div>
  );
}

const SEGMENTS = ["ALL", "RISING_STAR", "CAPABLE", "AT_RISK", "CRITICAL", "UNASSESSED"];
const SEGMENT_LABELS: Record<string, string> = {
  ALL: "All",
  RISING_STAR: "Rising Star",
  CAPABLE: "Capable",
  AT_RISK: "At Risk",
  CRITICAL: "Critical",
  UNASSESSED: "Unassessed",
};

export default function AdminStudentsPage() {
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState("ALL");
  const [sortKey, setSortKey] = useState<"readiness" | "missionsCompleted" | "streak">("readiness");

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => axios.get<Stats>("/api/admin/stats").then((r) => r.data),
    refetchInterval: 60_000,
  });

  const students = [...(data?.students ?? [])]
    .filter((s) => {
      const q = search.toLowerCase();
      const matchesSearch = !q || s.name?.toLowerCase().includes(q) || s.email.toLowerCase().includes(q);
      const matchesSeg = segFilter === "ALL" || s.segment === segFilter;
      return matchesSearch && matchesSeg;
    })
    .sort((a, b) => (b[sortKey] ?? 0) - (a[sortKey] ?? 0));

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <AdminSidebar />
      <main className="flex-1 p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">TPC Portal</p>
          <h1 className="text-2xl text-white font-light">Students</h1>
          {!isLoading && (
            <p className="text-xs text-zinc-600 mt-1">{data?.totalStudents ?? 0} total</p>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3 mb-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email…"
              className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-700 w-56 transition-colors"
            />
          </div>
          <div className="flex gap-1.5 flex-wrap">
            {SEGMENTS.map((seg) => (
              <button
                key={seg}
                onClick={() => setSegFilter(seg)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
                  segFilter === seg
                    ? "bg-amber-500 text-black border-amber-500"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-700 hover:text-zinc-400"
                }`}
              >
                {SEGMENT_LABELS[seg]}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-xs text-zinc-600">Sort:</span>
            {(["readiness", "missionsCompleted", "streak"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setSortKey(k)}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-colors ${
                  sortKey === k
                    ? "bg-zinc-800 text-white border-zinc-700"
                    : "bg-transparent text-zinc-500 border-zinc-800 hover:border-zinc-700"
                }`}
              >
                {k === "readiness" ? "Readiness" : k === "missionsCompleted" ? "Missions" : "Streak"}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60">
                {["Student", "Segment", "Readiness", "Missions", "Target Role", "Streak"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-[10px] font-mono text-zinc-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-600 text-sm">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-zinc-600 text-sm">
                    No students found.
                  </td>
                </tr>
              )}
              {students.map((s) => (
                <tr
                  key={s.id}
                  className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <Link href={`/admin/students/${s.id}`} className="flex items-center gap-3">
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt="" className="w-7 h-7 rounded-full border border-zinc-700 shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-800 shrink-0" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-white truncate">{s.name ?? "—"}</p>
                        <p className="text-xs text-zinc-600 truncate">{s.email}</p>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono border ${SEGMENT_COLORS[s.segment]}`}>
                      {s.segment.replace("_", " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <ReadinessBar score={s.readiness} />
                  </td>
                  <td className="px-4 py-3 text-sm text-zinc-400 font-mono">{s.missionsCompleted}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 max-w-[140px] truncate">{s.targetRole ?? "—"}</td>
                  <td className="px-4 py-3">
                    {s.streak > 0 ? (
                      <span className="flex items-center gap-1 text-xs font-mono text-orange-400">
                        <Flame className="w-3 h-3" />{s.streak}d
                      </span>
                    ) : (
                      <span className="text-zinc-700 text-xs">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

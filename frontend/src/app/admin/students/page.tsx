"use client";

import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import Link from "next/link";
import { useState } from "react";
import { Users, Zap, GraduationCap, LayoutDashboard, Search } from "lucide-react";

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

type Stats = { students: Student[] };

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
      <div className="w-20 h-1.5 bg-zinc-800 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs font-mono text-zinc-400">{score}</span>
    </div>
  );
}

export default function AdminStudentsPage() {
  const [search, setSearch] = useState("");
  const [segFilter, setSegFilter] = useState<string>("ALL");

  const { data, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => axios.get<Stats>("/api/admin/stats").then((r) => r.data),
  });

  const students = (data?.students ?? []).filter((s) => {
    const matchesSearch =
      !search ||
      s.name?.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase());
    const matchesSeg = segFilter === "ALL" || s.segment === segFilter;
    return matchesSearch && matchesSeg;
  });

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Sidebar */}
      <aside className="hidden md:flex flex-col w-56 min-h-screen bg-[#0d0d0d] border-r border-zinc-800/60">
        <div className="flex items-center gap-2 px-5 py-5 border-b border-zinc-800/60">
          <div className="w-6 h-6 bg-amber-500 rounded-sm flex items-center justify-center shrink-0">
            <Zap className="w-3 h-3 text-black" fill="black" />
          </div>
          <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">Admin</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <Link href="/admin/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors">
            <LayoutDashboard className="w-4 h-4" />Overview
          </Link>
          <Link href="/admin/students" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm bg-zinc-800/80 text-white">
            <Users className="w-4 h-4 text-amber-400" />Students
          </Link>
        </nav>
        <div className="px-3 py-4 border-t border-zinc-800/60">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/40 transition-colors">
            <GraduationCap className="w-4 h-4" />Student view
          </Link>
        </div>
      </aside>

      <main className="flex-1 p-6 md:p-8">
        <div className="mb-6">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">TPC Portal</p>
          <h1 className="text-2xl text-white font-light">Students</h1>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name or email..."
              className="pl-9 pr-4 py-2 bg-zinc-900 border border-zinc-800 rounded-lg text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-zinc-600 w-56"
            />
          </div>
          <div className="flex gap-1.5">
            {["ALL", "RISING_STAR", "CAPABLE", "AT_RISK", "CRITICAL", "UNASSESSED"].map((seg) => (
              <button
                key={seg}
                onClick={() => setSegFilter(seg)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors ${
                  segFilter === seg
                    ? "bg-amber-500 text-black border-amber-500"
                    : "bg-zinc-900 text-zinc-500 border-zinc-800 hover:border-zinc-600"
                }`}
              >
                {seg === "ALL" ? "All" : seg.replace("_", " ")}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-zinc-800/60">
                {["Student", "Segment", "Readiness", "Missions", "Role", "Streak"].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-mono text-zinc-600 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600 text-sm">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && students.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-zinc-600 text-sm">
                    No students found.
                  </td>
                </tr>
              )}
              {students.map((s) => (
                <tr key={s.id} className="border-b border-zinc-800/40 last:border-0 hover:bg-zinc-800/20 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {s.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.image} alt="" className="w-7 h-7 rounded-full border border-zinc-700" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-zinc-800" />
                      )}
                      <div>
                        <p className="text-sm text-white">{s.name ?? "—"}</p>
                        <p className="text-xs text-zinc-600">{s.email}</p>
                      </div>
                    </div>
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
                  <td className="px-4 py-3 text-xs text-zinc-500">{s.targetRole ?? "—"}</td>
                  <td className="px-4 py-3 text-xs text-zinc-500 font-mono">
                    {s.streak > 0 ? `${s.streak}d` : "—"}
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

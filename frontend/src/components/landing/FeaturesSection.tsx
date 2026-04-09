"use client";

import { useRef, useState } from "react";
import { motion, useInView } from "framer-motion";

/* ─── Mini radar chart (Gap Analysis preview) ─────────────────────────── */
function RadarPreview() {
  const pillars = [
    { label: "DSA", current: 0.68, target: 0.9 },
    { label: "Dev", current: 0.81, target: 0.92 },
    { label: "Comm", current: 0.54, target: 0.85 },
    { label: "Consist.", current: 0.76, target: 0.88 },
    { label: "Projects", current: 0.62, target: 0.9 },
  ];
  const size = 130;
  const cx = size / 2;
  const cy = size / 2;
  const r = 48;

  function toXY(angle: number, radius: number) {
    const a = angle - Math.PI / 2;
    return { x: cx + radius * Math.cos(a), y: cy + radius * Math.sin(a) };
  }

  const n = pillars.length;
  const angles = pillars.map((_, i) => (2 * Math.PI * i) / n);

  const currentPoints = pillars
    .map((p, i) => toXY(angles[i], r * p.current))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  const targetPoints = pillars
    .map((p, i) => toXY(angles[i], r * p.target))
    .map((p) => `${p.x},${p.y}`)
    .join(" ");

  return (
    <div className="flex flex-col items-center gap-2">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid circles */}
        {[0.3, 0.6, 0.9].map((f) => (
          <polygon
            key={f}
            points={angles.map((a) => { const p = toXY(a, r * f); return `${p.x},${p.y}`; }).join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.05)"
            strokeWidth="1"
          />
        ))}
        {/* Axes */}
        {angles.map((a, i) => {
          const p = toXY(a, r);
          return <line key={i} x1={cx} y1={cy} x2={p.x} y2={p.y} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />;
        })}
        {/* Target polygon */}
        <polygon points={targetPoints} fill="rgba(245,158,11,0.06)" stroke="rgba(245,158,11,0.2)" strokeWidth="1" strokeDasharray="3,2" />
        {/* Current polygon */}
        <motion.polygon
          points={currentPoints}
          fill="rgba(249,115,22,0.18)"
          stroke="rgba(249,115,22,0.6)"
          strokeWidth="1.5"
          initial={{ opacity: 0, scale: 0.5 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          style={{ transformOrigin: `${cx}px ${cy}px` }}
        />
        {/* Labels */}
        {pillars.map((p, i) => {
          const labelPos = toXY(angles[i], r + 14);
          return (
            <text
              key={p.label}
              x={labelPos.x}
              y={labelPos.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="fill-zinc-500"
              style={{ fontSize: 8, fontFamily: "var(--font-geist-mono, monospace)" }}
            >
              {p.label}
            </text>
          );
        })}
      </svg>
      <div className="flex items-center gap-3 text-[9px] font-mono text-zinc-600">
        <span className="flex items-center gap-1"><span className="w-3 h-px bg-orange-500/60 inline-block" /> Current</span>
        <span className="flex items-center gap-1"><span className="w-3 h-px border-t border-amber-500/40 border-dashed inline-block" /> Target</span>
      </div>
    </div>
  );
}

/* ─── Mini interview conversation preview ─────────────────────────────── */
function InterviewPreview() {
  const msgs = [
    { role: "ai", text: "Walk me through a time you resolved a conflict on your team." },
    { role: "user", text: "During a sprint, two engineers disagreed on architecture. I scheduled a 30-min decision session..." },
    { role: "ai", text: "Good use of STAR. Your structure was clear. Work on quantifying the outcome — what shipped?" },
  ];

  return (
    <div className="space-y-2 py-1">
      {msgs.map((m, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: m.role === "ai" ? -10 : 10 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.15, duration: 0.4 }}
          className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
        >
          <div
            className={`max-w-[85%] rounded-xl px-3 py-2 text-[10px] leading-relaxed ${
              m.role === "ai"
                ? "bg-zinc-800/60 text-zinc-300 rounded-tl-sm"
                : "bg-amber-500/15 text-amber-200 border border-amber-500/15 rounded-tr-sm"
            }`}
          >
            {m.role === "ai" && (
              <span className="block text-[8px] font-mono text-amber-500/60 mb-0.5 uppercase tracking-wider">CareerForge AI</span>
            )}
            {m.text}
          </div>
        </motion.div>
      ))}
      <div className="flex items-center gap-1 mt-2">
        <div className="flex-1 h-[1px] rounded bg-zinc-800" />
        <span className="text-[9px] font-mono text-zinc-600">Sentiment: Positive · Structure: 8/10</span>
        <div className="flex-1 h-[1px] rounded bg-zinc-800" />
      </div>
    </div>
  );
}

/* ─── Mini job match preview ──────────────────────────────────────────── */
function JobMatchPreview() {
  const jobs = [
    { company: "Google", role: "SWE Intern", match: 94, color: "emerald" },
    { company: "Atlassian", role: "Backend Intern", match: 87, color: "blue" },
    { company: "Flipkart", role: "SDE I", match: 79, color: "amber" },
  ];

  return (
    <div className="space-y-2">
      {jobs.map((j, i) => (
        <motion.div
          key={j.company}
          initial={{ opacity: 0, y: 6 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.1, duration: 0.4 }}
          className="flex items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-900/40 px-2.5 py-2"
        >
          <div className="w-6 h-6 rounded-md bg-zinc-800 flex items-center justify-center flex-shrink-0">
            <span className="text-[8px] font-bold text-zinc-300">{j.company[0]}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-zinc-300 font-medium truncate">{j.company} · {j.role}</p>
          </div>
          <span className={`text-[10px] font-mono font-bold tabular-nums ${j.color === "emerald" ? "text-emerald-400" : j.color === "blue" ? "text-blue-400" : "text-amber-400"}`}>
            {j.match}%
          </span>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Mini roadmap preview ────────────────────────────────────────────── */
function RoadmapPreview() {
  const missions = [
    { label: "Binary Trees: LCA & Traversals", done: true, tag: "DSA" },
    { label: "Build REST API with auth", done: true, tag: "Dev" },
    { label: "System Design: URL Shortener", done: false, tag: "Design" },
    { label: "Behavioral Round Prep", done: false, tag: "Comm" },
  ];

  return (
    <div className="space-y-2">
      {missions.map((m, i) => (
        <motion.div
          key={m.label}
          initial={{ opacity: 0, x: -8 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          transition={{ delay: i * 0.08 }}
          className="flex items-center gap-2"
        >
          <div className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center ${m.done ? "bg-amber-500/20 border border-amber-500/40" : "bg-zinc-800 border border-zinc-700"}`}>
            {m.done && <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />}
          </div>
          <p className={`text-[10px] flex-1 truncate ${m.done ? "text-zinc-500 line-through" : "text-zinc-300"}`}>{m.label}</p>
          <span className="text-[8px] font-mono text-zinc-600 flex-shrink-0">{m.tag}</span>
        </motion.div>
      ))}
    </div>
  );
}

/* ─── Bento card ──────────────────────────────────────────────────────── */
type CardProps = {
  children: React.ReactNode;
  className?: string;
  glowColor?: string;
  delay?: number;
};

function BentoCard({ children, className = "", glowColor = "amber", delay = 0 }: CardProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setPos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  const glowRgb = glowColor === "amber" ? "245,158,11" : glowColor === "blue" ? "59,130,246" : "249,115,22";

  return (
    <motion.div
      initial={{ opacity: 0, y: 28 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-40px" }}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className={className}
    >
      <div
        ref={ref}
        className="relative h-full rounded-2xl border border-zinc-800/50 bg-[#0d0d0d] overflow-hidden cursor-default transition-[border-color] duration-300 hover:border-zinc-700/70"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
      >
        {/* Spotlight */}
        {hovered && (
          <div
            className="pointer-events-none absolute inset-0 transition-opacity duration-300"
            style={{ background: `radial-gradient(280px circle at ${pos.x}px ${pos.y}px, rgba(${glowRgb},0.07), transparent 65%)` }}
          />
        )}
        {/* Top accent line */}
        <div className="absolute top-0 left-8 right-8 h-[1px] bg-gradient-to-r from-transparent via-zinc-700/40 to-transparent" />
        {children}
      </div>
    </motion.div>
  );
}

/* ─── Pill tag ────────────────────────────────────────────────────────── */
function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-zinc-800 bg-zinc-900/80 px-2.5 py-0.5 text-[10px] font-mono text-zinc-500">
      <span className="w-1 h-1 rounded-full bg-amber-500/60" />
      {children}
    </span>
  );
}

/* ─── Features section ────────────────────────────────────────────────── */
export default function FeaturesSection() {
  return (
    <section id="features" className="relative px-6 md:px-10 lg:px-14 py-28 max-w-7xl mx-auto">
      {/* Section header */}
      <motion.div
        className="text-center mb-16"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <Tag>THE FULL PIPELINE</Tag>
        <h2 className="mt-5 text-3xl md:text-4xl lg:text-5xl font-light text-white tracking-tight leading-tight">
          Everything you need to{" "}
          <span
            className="font-serif italic bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            land your dream job
          </span>
        </h2>
        <p className="mt-4 text-zinc-500 max-w-xl mx-auto text-base">
          Six interconnected AI agents working in concert — from raw profiles to offer letters.
        </p>
      </motion.div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">

        {/* ── Row 1 ── */}
        {/* Gap Analysis — large (col-span-2) */}
        <BentoCard className="md:col-span-2" delay={0.05}>
          <div className="p-7 h-full flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Tag>AI Agents</Tag>
                <h3 className="mt-3 text-xl font-medium text-white">Gap Analysis</h3>
                <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed max-w-xs">
                  Connects GitHub, LeetCode, Codeforces & LinkedIn. Scores DSA, Dev, Communication, and Consistency pillars. Tells you exactly what&apos;s missing.
                </p>
              </div>
              <div className="flex-shrink-0 pl-6 hidden sm:block">
                <RadarPreview />
              </div>
            </div>
            <div className="mt-auto flex items-center gap-3 text-[11px] font-mono text-zinc-600">
              <span>4 pillars scored</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Real-time sync</span>
              <span className="w-1 h-1 rounded-full bg-zinc-700" />
              <span>Profile intelligence</span>
            </div>
          </div>
        </BentoCard>

        {/* Readiness Score — small */}
        <BentoCard delay={0.1}>
          <div className="p-7 h-full flex flex-col items-center justify-between">
            <div className="w-full">
              <Tag>Live metric</Tag>
              <h3 className="mt-3 text-lg font-medium text-white">Readiness Score</h3>
              <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">
                A single 0–100 score that updates as you complete missions and improve.
              </p>
            </div>
            <div className="my-4 flex flex-col items-center">
              {/* Mini score ring */}
              <div className="relative w-[90px] h-[90px]">
                <svg width="90" height="90" viewBox="0 0 90 90" className="absolute inset-0">
                  <circle cx="45" cy="45" r="36" fill="none" stroke="rgba(245,158,11,0.08)" strokeWidth="6" />
                  <motion.circle
                    cx="45" cy="45" r="36"
                    fill="none"
                    stroke="url(#miniGrad)"
                    strokeWidth="6"
                    strokeLinecap="round"
                    strokeDasharray={226}
                    initial={{ strokeDashoffset: 226 }}
                    whileInView={{ strokeDashoffset: 226 * 0.27 }}
                    viewport={{ once: true }}
                    transition={{ duration: 1.5, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
                    transform="rotate(-90 45 45)"
                  />
                  <defs>
                    <linearGradient id="miniGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#f59e0b" />
                      <stop offset="100%" stopColor="#f97316" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-light text-white">73</span>
                  <span className="text-[8px] font-mono text-zinc-600">/ 100</span>
                </div>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] font-mono text-zinc-600">
                <span className="text-emerald-400">Rising Star ↑</span>
                <span>top 34%</span>
              </div>
            </div>
          </div>
        </BentoCard>

        {/* ── Row 2 ── */}
        {/* Adaptive Roadmap — small */}
        <BentoCard delay={0.15}>
          <div className="p-7 h-full flex flex-col">
            <Tag>Personalized</Tag>
            <h3 className="mt-3 text-lg font-medium text-white">Adaptive Roadmap</h3>
            <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">
              Mission-based plan with deadlines calibrated to your graduation date.
            </p>
            <div className="mt-5 flex-1">
              <RoadmapPreview />
            </div>
          </div>
        </BentoCard>

        {/* Mock Interviews — large (col-span-2) */}
        <BentoCard className="md:col-span-2" glowColor="orange" delay={0.2}>
          <div className="p-7 h-full flex flex-col">
            <div className="flex items-start justify-between mb-4">
              <div>
                <Tag>Conversational AI</Tag>
                <h3 className="mt-3 text-xl font-medium text-white">Mock Interviews</h3>
                <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed max-w-xs">
                  AI interviewer for technical, system design, and behavioral rounds. Debrief with sentiment scores and weak-spot breakdown.
                </p>
              </div>
            </div>
            <div className="flex-1 rounded-xl border border-zinc-800/60 bg-zinc-950/50 p-4 min-h-[140px]">
              <InterviewPreview />
            </div>
          </div>
        </BentoCard>

        {/* ── Row 3 ── */}
        {/* Job Matching — small */}
        <BentoCard delay={0.25}>
          <div className="p-7 h-full flex flex-col">
            <Tag>Daily scrape</Tag>
            <h3 className="mt-3 text-lg font-medium text-white">Job Matching</h3>
            <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed">
              Scrapes LinkedIn, Wellfound & Naukri daily. One-click tailored CV per role.
            </p>
            <div className="mt-5 flex-1">
              <JobMatchPreview />
            </div>
          </div>
        </BentoCard>

        {/* University Dashboard — large (col-span-2) */}
        <BentoCard className="md:col-span-2" glowColor="blue" delay={0.3}>
          <div className="p-7 h-full flex flex-col">
            <Tag>TPO Admin</Tag>
            <h3 className="mt-3 text-xl font-medium text-white">University Dashboard</h3>
            <p className="mt-1.5 text-sm text-zinc-500 leading-relaxed max-w-sm">
              TPO admins see all students by segment, set company drives, flag at-risk students, and push interventions — without chasing spreadsheets.
            </p>
            {/* Mini table */}
            <div className="mt-5 rounded-xl border border-zinc-800/60 bg-zinc-950/50 overflow-hidden">
              <div className="grid grid-cols-4 px-4 py-2 border-b border-zinc-800/40 text-[9px] font-mono text-zinc-600 uppercase tracking-wider">
                <span>Student</span><span>Score</span><span>Segment</span><span>Status</span>
              </div>
              {[
                { name: "Arjun S.", score: 73, seg: "Rising Star", status: "On Track", c: "text-emerald-400" },
                { name: "Priya M.", score: 41, seg: "At-Risk", status: "Needs Help", c: "text-red-400" },
                { name: "Rohan K.", score: 88, seg: "Capable", status: "Interviewing", c: "text-amber-400" },
              ].map((s, i) => (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                  className="grid grid-cols-4 px-4 py-2 border-b border-zinc-800/20 last:border-0 text-[10px]"
                >
                  <span className="text-zinc-300 font-medium">{s.name}</span>
                  <span className="text-zinc-400 font-mono">{s.score}</span>
                  <span className="text-zinc-500">{s.seg}</span>
                  <span className={s.c}>{s.status}</span>
                </motion.div>
              ))}
            </div>
          </div>
        </BentoCard>

      </div>
    </section>
  );
}

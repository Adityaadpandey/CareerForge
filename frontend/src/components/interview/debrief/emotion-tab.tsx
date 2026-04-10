"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, RefreshCw, Brain, Mic, Eye } from "lucide-react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────

type HumeEmotion = { name: string; score: number };
type HumeMoment = { time: number; emotions: HumeEmotion[] };
type HumePredictions = {
  faceMoments: HumeMoment[];
  prosodyMoments: HumeMoment[];
  topFaceEmotions: HumeEmotion[];
  topProsodyEmotions: HumeEmotion[];
};
type PollResponse = {
  status: "completed" | "processing" | "pending" | "error";
  analysis?: HumePredictions;
};

interface Props {
  interviewId: string;
  initialAnalysis: Record<string, unknown> | null;
  humeJobId: string | null;
}

// ─── Colour palette ───────────────────────────────────────────

const PALETTE: Record<string, string> = {
  Joy:           "#facc15",
  Happiness:     "#fde68a",
  Satisfaction:  "#4ade80",
  Confidence:    "#60a5fa",
  Calmness:      "#38bdf8",
  Concentration: "#22d3ee",
  Determination: "#2dd4bf",
  Interest:      "#a78bfa",
  Anxiety:       "#fb923c",
  Nervousness:   "#f97316",
  Fear:          "#ef4444",
  Sadness:       "#818cf8",
  Confusion:     "#c084fc",
  Contempt:      "#94a3b8",
  Disgust:       "#a3e635",
  Anger:         "#f43f5e",
};
function color(name: string) { return PALETTE[name] ?? "#71717a"; }

function fmt(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

// ─── Convert moment array → recharts flat data ────────────────

function toChartData(moments: HumeMoment[], topN: string[]) {
  return moments.map((m) => {
    const row: Record<string, number | string> = { time: parseFloat(m.time.toFixed(1)), label: fmt(m.time) };
    for (const name of topN) {
      row[name] = parseFloat(
        (m.emotions.find((e) => e.name === name)?.score ?? 0).toFixed(3)
      );
    }
    return row;
  });
}

function topEmotionNames(moments: HumeMoment[], n = 5): string[] {
  const totals: Record<string, number> = {};
  for (const m of moments) {
    for (const e of m.emotions) {
      totals[e.name] = (totals[e.name] ?? 0) + e.score;
    }
  }
  return Object.entries(totals)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([name]) => name);
}

// ─── Chart component ──────────────────────────────────────────

function EmotionChart({
  moments,
  title,
  icon,
  accentClass,
}: {
  moments: HumeMoment[];
  title: string;
  icon: React.ReactNode;
  accentClass: string;
}) {
  if (moments.length === 0) return null;

  const top = topEmotionNames(moments, 5);
  const data = toChartData(moments, top);

  return (
    <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5">
      <div className={`flex items-center gap-2 mb-5 ${accentClass}`}>
        {icon}
        <span className="text-sm font-medium">{title}</span>
      </div>

      <ResponsiveContainer width="100%" height={220}>
        <AreaChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
          <defs>
            {top.map((name) => (
              <linearGradient key={name} id={`grad-${name}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%"  stopColor={color(name)} stopOpacity={0.25} />
                <stop offset="95%" stopColor={color(name)} stopOpacity={0.02} />
              </linearGradient>
            ))}
          </defs>

          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            domain={[0, 1]}
            tick={{ fontSize: 10, fill: "#52525b" }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v: number) => `${Math.round(v * 100)}%`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "#18181b",
              border: "1px solid #27272a",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "#a1a1aa", marginBottom: 4 }}
            itemStyle={{ color: "#d4d4d8" }}
            formatter={(val) => [`${((Number(val) || 0) * 100).toFixed(1)}%`]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 12, color: "#71717a" }}
          />

          {top.map((name) => (
            <Area
              key={name}
              type="monotone"
              dataKey={name}
              stroke={color(name)}
              strokeWidth={2}
              fill={`url(#grad-${name})`}
              dot={false}
              activeDot={{ r: 4, strokeWidth: 0 }}
            />
          ))}
        </AreaChart>
      </ResponsiveContainer>

      {/* Peak moments */}
      <PeakMoments moments={moments} top={top} />
    </div>
  );
}

// ─── Peak moments ─────────────────────────────────────────────

function PeakMoments({ moments, top }: { moments: HumeMoment[]; top: string[] }) {
  const peaks: { name: string; time: number; score: number }[] = [];

  for (const name of top) {
    let best = { time: 0, score: 0 };
    for (const m of moments) {
      const e = m.emotions.find((e) => e.name === name);
      if (e && e.score > best.score) best = { time: m.time, score: e.score };
    }
    if (best.score > 0.15) peaks.push({ name, ...best });
  }

  if (peaks.length === 0) return null;

  return (
    <div className="mt-4 pt-4 border-t border-zinc-800/60">
      <p className="text-xs text-zinc-600 font-mono uppercase tracking-widest mb-3">Peak moments</p>
      <div className="flex flex-wrap gap-2">
        {peaks.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-1.5 bg-zinc-800/50 rounded-lg px-2.5 py-1.5"
          >
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color(p.name) }} />
            <span className="text-xs text-zinc-300 capitalize">{p.name}</span>
            <span className="text-xs text-zinc-600 font-mono">peaked @ {fmt(p.time)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Overall summary bars ─────────────────────────────────────

function SummaryBars({ emotions, label }: { emotions: HumeEmotion[]; label: string }) {
  return (
    <div>
      <p className="text-xs text-zinc-500 font-mono uppercase tracking-widest mb-3">{label}</p>
      <div className="space-y-2.5">
        {emotions.slice(0, 6).map((e) => (
          <div key={e.name}>
            <div className="flex justify-between mb-1">
              <span className="text-xs text-zinc-400 capitalize">{e.name}</span>
              <span className="text-xs font-mono" style={{ color: color(e.name) }}>
                {Math.round(e.score * 100)}%
              </span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${e.score * 100}%`, backgroundColor: color(e.name) }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Insight paragraph ────────────────────────────────────────

function Insight({ face, prosody }: { face: HumeEmotion[]; prosody: HumeEmotion[] }) {
  const topFace = face[0]?.name ?? "neutral";
  const topVoice = prosody[0]?.name ?? "neutral";
  const nervousness = [...face, ...prosody].find((e) =>
    ["Anxiety", "Nervousness", "Fear"].includes(e.name)
  )?.score ?? 0;
  const confidence = [...face, ...prosody].find((e) =>
    ["Confidence", "Determination", "Satisfaction"].includes(e.name)
  )?.score ?? 0;

  let text = `Your face mostly expressed ${topFace.toLowerCase()}, while your voice conveyed ${topVoice.toLowerCase()} throughout the interview. `;
  if (nervousness > 0.3)
    text += "Noticeable nervousness was detected — focus on slow, deliberate breathing before answering. ";
  if (confidence > 0.25)
    text += "Your confidence came through well.";
  else
    text += "Practice projecting confidence: steady pace, upright posture, and direct eye contact.";

  return (
    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
      <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-2">Hume Insight</p>
      <p className="text-sm text-zinc-300 leading-relaxed">{text}</p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────

export function EmotionTab({ interviewId, initialAnalysis, humeJobId }: Props) {
  const [analysis, setAnalysis] = useState<HumePredictions | null>(
    initialAnalysis as unknown as HumePredictions | null
  );
  const [status, setStatus] = useState<"completed" | "processing" | "pending" | "error">(
    initialAnalysis ? "completed" : humeJobId ? "processing" : "pending"
  );
  const [polling, setPolling] = useState(false);

  const poll = useCallback(async () => {
    setPolling(true);
    try {
      const res = await fetch(`/api/interviews/${interviewId}/hume`);
      const data = (await res.json()) as PollResponse;
      setStatus(data.status);
      if (data.status === "completed" && data.analysis) {
        setAnalysis(data.analysis);
      }
    } catch { /* silent */ }
    finally { setPolling(false); }
  }, [interviewId]);

  useEffect(() => {
    if (status === "processing") {
      const t = setInterval(poll, 15000);
      return () => clearInterval(t);
    }
  }, [status, poll]);

  if (status === "pending" && !humeJobId) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center gap-3">
        <Brain className="w-8 h-8 text-zinc-600" />
        <p className="text-sm text-zinc-500">Emotion analysis will begin once your recording is ready.</p>
      </div>
    );
  }

  if (status !== "completed" || !analysis) {
    return (
      <div className="flex flex-col items-center justify-center h-48 text-center gap-4">
        <Loader2 className="w-7 h-7 animate-spin text-amber-400" />
        <div>
          <p className="text-sm text-white">Analyzing your emotions...</p>
          <p className="text-xs text-zinc-500 mt-1">Hume AI is processing your recording. Takes 2–5 minutes.</p>
        </div>
        <button
          onClick={poll}
          disabled={polling}
          className="flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${polling ? "animate-spin" : ""}`} />
          Check now
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Overall summary */}
      <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-2xl p-5 grid grid-cols-2 gap-8">
        {analysis.topFaceEmotions.length > 0 && (
          <SummaryBars emotions={analysis.topFaceEmotions} label="Face (avg)" />
        )}
        {analysis.topProsodyEmotions.length > 0 && (
          <SummaryBars emotions={analysis.topProsodyEmotions} label="Voice (avg)" />
        )}
      </div>

      {/* Face timeline */}
      <EmotionChart
        moments={analysis.faceMoments}
        title="Facial Expression Over Time"
        icon={<Eye className="w-4 h-4" />}
        accentClass="text-purple-400"
      />

      {/* Voice timeline */}
      <EmotionChart
        moments={analysis.prosodyMoments}
        title="Voice Emotion Over Time"
        icon={<Mic className="w-4 h-4" />}
        accentClass="text-blue-400"
      />

      {/* Insight */}
      <Insight face={analysis.topFaceEmotions} prosody={analysis.topProsodyEmotions} />
    </div>
  );
}

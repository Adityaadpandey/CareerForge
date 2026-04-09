"use client";

import { useCallback } from "react";
import {
  ReactFlow,
  Node,
  Edge,
  Background,
  Controls,
  MiniMap,
  NodeProps,
  Handle,
  Position,
  useNodesState,
  useEdgesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Code2, Hammer, MessageSquare, CheckCircle2, Lock, Play, Clock, ExternalLink } from "lucide-react";
import { toast } from "sonner";

type Mission = {
  id: string;
  title: string;
  description: string;
  type: string;
  status: string;
  estimatedHours: number;
  orderIndex: number;
  prerequisiteIds: string[];
  deadline: string | null;
  resources: { title: string; url: string; type: string }[];
};

const TYPE_ICON: Record<string, typeof Code2> = {
  BUILD: Hammer,
  SOLVE: Code2,
  COMMUNICATE: MessageSquare,
};

const STATUS_COLOR: Record<string, string> = {
  COMPLETED: "border-green-500/50 bg-green-500/5",
  IN_PROGRESS: "border-amber-500/50 bg-amber-500/5",
  AVAILABLE: "border-blue-500/50 bg-blue-500/5",
  LOCKED: "border-zinc-800/60 bg-zinc-900/30 opacity-60",
};

function MissionNode({ data }: NodeProps) {
  const mission = data.mission as Mission;
  const TypeIcon = TYPE_ICON[mission.type] ?? Code2;
  const statusColor = STATUS_COLOR[mission.status] ?? STATUS_COLOR.LOCKED;

  const markComplete = async () => {
    try {
      const res = await fetch(`/api/missions/${mission.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "COMPLETED" }),
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) throw new Error();
      toast.success("Mission completed! Interview queued.");
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error("Failed to update mission.");
    }
  };

  const startMission = async () => {
    try {
      await fetch(`/api/missions/${mission.id}/status`, {
        method: "PATCH",
        body: JSON.stringify({ status: "IN_PROGRESS" }),
        headers: { "Content-Type": "application/json" },
      });
      toast.success("Mission started!");
      setTimeout(() => window.location.reload(), 800);
    } catch {
      toast.error("Failed to start mission.");
    }
  };

  return (
    <div className={`w-64 rounded-xl border p-4 shadow-xl ${statusColor} backdrop-blur-sm`}>
      <Handle type="target" position={Position.Top} className="!bg-zinc-700 !border-zinc-600" />

      <div className="flex items-start gap-3 mb-3">
        <div className="w-7 h-7 rounded-lg bg-zinc-800/80 flex items-center justify-center shrink-0">
          <TypeIcon className="w-3.5 h-3.5 text-zinc-400" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-mono text-zinc-500 uppercase tracking-wide">{mission.type}</p>
          <p className="text-sm text-white font-medium leading-tight mt-0.5">{mission.title}</p>
        </div>
      </div>

      <p className="text-xs text-zinc-500 leading-relaxed mb-3 line-clamp-2">{mission.description}</p>

      <div className="flex items-center gap-2 text-xs font-mono text-zinc-600 mb-3">
        <Clock className="w-3 h-3" />
        <span>{mission.estimatedHours}h</span>
        {mission.deadline && (
          <span className="ml-auto text-zinc-700">
            {new Date(mission.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
          </span>
        )}
      </div>

      {/* Resources */}
      {mission.resources.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-3">
          {mission.resources.slice(0, 2).map((r, i) => (
            <a
              key={i}
              href={r.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-zinc-800/60 text-zinc-500 hover:text-zinc-300 text-[10px] font-mono transition-colors"
            >
              <ExternalLink className="w-2.5 h-2.5" />
              {r.title.slice(0, 20)}
            </a>
          ))}
        </div>
      )}

      {/* Actions */}
      {mission.status === "AVAILABLE" && (
        <button
          onClick={startMission}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-mono hover:bg-blue-500/20 transition-colors"
        >
          <Play className="w-3 h-3" />
          Start Mission
        </button>
      )}
      {mission.status === "IN_PROGRESS" && (
        <button
          onClick={markComplete}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg bg-green-500/10 border border-green-500/30 text-green-400 text-xs font-mono hover:bg-green-500/20 transition-colors"
        >
          <CheckCircle2 className="w-3 h-3" />
          Mark Complete
        </button>
      )}
      {mission.status === "COMPLETED" && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-green-400 text-xs font-mono">
          <CheckCircle2 className="w-3 h-3" />
          Completed
        </div>
      )}
      {mission.status === "LOCKED" && (
        <div className="flex items-center justify-center gap-1.5 py-1.5 text-zinc-600 text-xs font-mono">
          <Lock className="w-3 h-3" />
          Complete prerequisites first
        </div>
      )}

      <Handle type="source" position={Position.Bottom} className="!bg-zinc-700 !border-zinc-600" />
    </div>
  );
}

const nodeTypes = { mission: MissionNode };

export function RoadmapClient({ missions }: { missions: Mission[] }) {
  const buildGraph = useCallback(() => {
    const nodes: Node[] = missions.map((m, i) => ({
      id: m.id,
      type: "mission",
      position: { x: (i % 3) * 300 + 50, y: Math.floor(i / 3) * 240 + 50 },
      data: { mission: m },
    }));

    const edges: Edge[] = [];
    missions.forEach((m) => {
      m.prerequisiteIds.forEach((prereqId) => {
        edges.push({
          id: `${prereqId}-${m.id}`,
          source: prereqId,
          target: m.id,
          style: { stroke: "#3f3f46", strokeWidth: 1.5 },
          animated: m.status === "AVAILABLE",
        });
      });
    });

    return { nodes, edges };
  }, [missions]);

  const { nodes: initialNodes, edges: initialEdges } = buildGraph();
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-12">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <Map className="w-6 h-6 text-zinc-700" />
        </div>
        <h2 className="text-xl text-white font-light mb-2">Roadmap being generated</h2>
        <p className="text-zinc-500 text-sm max-w-sm">
          Your mission roadmap will appear here once the gap analysis is complete.
          This usually takes 1–2 minutes after onboarding.
        </p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full">
      <div className="absolute top-6 left-6 z-10">
        <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Mission Roadmap</p>
        <div className="flex items-center gap-3 text-xs font-mono text-zinc-600">
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500/60" />Completed</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500/60" />In Progress</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-500/60" />Available</span>
          <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-zinc-700" />Locked</span>
        </div>
      </div>

      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        fitView
        className="bg-[#0a0a0a]"
        style={{ background: "#0a0a0a" }}
      >
        <Background color="#1f1f1f" gap={32} />
        <Controls className="!bg-zinc-900 !border-zinc-800 !shadow-none" />
        <MiniMap
          className="!bg-zinc-900 !border-zinc-800"
          nodeColor={(n) => {
            const s = (n.data.mission as Mission).status;
            return s === "COMPLETED" ? "#22c55e" : s === "IN_PROGRESS" ? "#f59e0b" : s === "AVAILABLE" ? "#3b82f6" : "#3f3f46";
          }}
        />
      </ReactFlow>
    </div>
  );
}

// Placeholder icon for empty state
function Map({ className }: { className?: string }) {
  return <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" /></svg>;
}

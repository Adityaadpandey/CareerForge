"use client";

import { useState } from "react";
import { Code2, Hammer, MessageSquare, CheckCircle2, Lock, Play, Clock, ExternalLink, Map as MapIcon, ChevronRight, BookOpen, PlayCircle, FileText, Terminal, MonitorPlay, FileCode2, Send, Bot, User } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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

const STATUS_STYLE: Record<string, { border: string; bg: string; text: string; dot: string; labelBg: string }> = {
  COMPLETED: {
    border: "border-green-500/50",
    bg: "bg-green-500/5 hover:bg-green-500/10",
    text: "text-green-500",
    dot: "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)]",
    labelBg: "bg-green-500/10 text-green-400 border-green-500/20",
  },
  IN_PROGRESS: {
    border: "border-amber-500/50",
    bg: "bg-amber-500/5 hover:bg-amber-500/10",
    text: "text-amber-500",
    dot: "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.6)]",
    labelBg: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  },
  AVAILABLE: {
    border: "border-blue-500/50",
    bg: "bg-blue-500/5 hover:bg-blue-500/10 ring-1 ring-inset ring-blue-500/20",
    text: "text-blue-500",
    dot: "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.6)]",
    labelBg: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  },
  LOCKED: {
    border: "border-zinc-800/80",
    bg: "bg-zinc-900/40 opacity-70",
    text: "text-zinc-600",
    dot: "bg-zinc-800",
    labelBg: "bg-zinc-800 text-zinc-500 border-transparent",
  },
};

const RESOURCE_ICON: Record<string, typeof ExternalLink> = {
  video: PlayCircle,
  article: BookOpen,
  docs: FileText,
  repo: Terminal,
  course: MonitorPlay,
};

const RESOURCE_COLOR: Record<string, string> = {
  video: "text-red-400 group-hover:text-red-300",
  article: "text-blue-400 group-hover:text-blue-300",
  docs: "text-emerald-400 group-hover:text-emerald-300",
  repo: "text-zinc-300 group-hover:text-white",
  course: "text-purple-400 group-hover:text-purple-300",
};

function MissionMentorChat({ missionId }: { missionId: string }) {
  const [messages, setMessages] = useState<{id: string, role: string, content: string}[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage = { id: Date.now().toString(), role: "user", content: input };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    setIsLoading(true);

    try {
      const res = await fetch(`/api/missions/${missionId}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: newMessages }),
      });

      if (!res.ok) throw new Error("Failed to fetch");
      const reader = res.body?.getReader();
      const decoder = new TextDecoder();
      if (!reader) return;

      setMessages((prev) => [...prev, { id: Date.now().toString() + "bot", role: "assistant", content: "" }]);

      let done = false;
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        if (value) {
          const textChunk = decoder.decode(value);
          // Simple stripping of Vercel AI SDK text stream protocol headers (e.g., '0:"chunk"\n')
          // Assuming it sends raw text stream, toTextStreamResponse() just sends raw text!
          setMessages((prev) => {
             const last = prev[prev.length - 1];
             return [...prev.slice(0, -1), { ...last, content: last.content + textChunk }];
          });
        }
      }
    } catch (e) {
      console.error(e);
      toast.error("Mentor connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="mt-12 pt-8 border-t border-zinc-800/80">
      <div className="flex items-center gap-2 mb-6">
        <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
          <Bot className="w-4 h-4 text-amber-500" />
        </div>
        <div>
          <h4 className="text-sm font-medium text-white">Project Mentor</h4>
          <p className="text-[10px] text-zinc-500 font-mono tracking-wide">Context-Aware AI Lead</p>
        </div>
      </div>

      <div className="flex flex-col gap-4 mb-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="text-center p-6 border border-zinc-800/50 rounded-xl bg-zinc-900/20">
            <p className="text-sm text-zinc-400 leading-relaxed mb-2">
              Stuck on this mission? I know your exact skill gaps and the codebase status.
            </p>
            <p className="text-xs text-zinc-500">
              Ask me for architectural hints, unblocking workflows, or concept explanations!
            </p>
          </div>
        ) : (
          messages.map((m) => (
            <div key={m.id} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${m.role === "user" ? "bg-zinc-800 text-zinc-400" : "bg-amber-500/10 text-amber-500"}`}>
                {m.role === "user" ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
              </div>
              <div className={`flex-1 overflow-hidden px-4 py-3 rounded-xl text-sm leading-relaxed ${m.role === "user" ? "bg-zinc-800 text-zinc-200" : "bg-zinc-900 border border-zinc-800/60 text-zinc-300"}`}>
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    code: ({ inline, children, ...props }: unknown) => {
                      // const match = /language-(\w+)/.exec(className || "");
                      return !inline ? (
                        <div className="my-2 p-2 rounded bg-zinc-950 border border-zinc-800 overflow-x-auto text-xs font-mono text-zinc-300">
                          <code {...props}>{children}</code>
                        </div>
                      ) : (
                         <code className="px-1.5 py-0.5 rounded bg-zinc-950 text-blue-300 font-mono text-[11px]" {...props}>{children}</code>
                      );
                    },
                    p: ({...props}) => <p className="mb-2 last:mb-0" {...props} />
                  }}
                >
                  {m.content}
                </ReactMarkdown>
              </div>
            </div>
          ))
        )}
        {isLoading && (
           <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 bg-amber-500/10 text-amber-500">
                <Bot className="w-3.5 h-3.5 animate-pulse" />
              </div>
              <div className="flex-1 px-4 py-3 rounded-xl bg-zinc-900 border border-zinc-800/60 flex items-center gap-1.5">
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{animationDelay: '0ms'}} />
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{animationDelay: '150ms'}} />
                 <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce" style={{animationDelay: '300ms'}} />
              </div>
           </div>
        )}
      </div>

      <form onSubmit={handleSubmit} className="relative">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your mentor for guidance..."
          className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-4 pr-12 py-3 text-sm text-white placeholder-zinc-500 focus:outline-none focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/50 transition-all"
        />
        <button 
           type="submit" 
           disabled={isLoading || !input.trim()}
           className="absolute right-2 top-2 bottom-2 w-8 flex items-center justify-center rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5 ml-0.5" />
        </button>
      </form>
    </div>
  );
}

export function RoadmapClient({ missions }: { missions: Mission[] }) {
  const [selectedMission, setSelectedMission] = useState<Mission | null>(null);

  if (missions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[70vh] text-center p-12">
        <div className="w-16 h-16 rounded-2xl bg-zinc-900 border border-zinc-800 flex items-center justify-center mb-4">
          <MapIcon className="w-6 h-6 text-zinc-700" />
        </div>
        <h2 className="text-xl text-white font-light mb-2">Roadmap being generated</h2>
        <p className="text-zinc-500 text-sm max-w-sm">
          Your mission roadmap will appear here once the gap analysis is complete.
          This usually takes 1–2 minutes after onboarding.
        </p>
      </div>
    );
  }

  // Sort by order_index just to be totally safe
  const sortedMissions = [...missions].sort((a, b) => a.orderIndex - b.orderIndex);

  return (
    <div className="min-h-screen w-full bg-[#0a0a0a] pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-[#0a0a0a]/80 backdrop-blur-xl border-b border-zinc-800/50 px-8 py-5">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-medium text-white tracking-tight">Your Action Plan</h1>
            <p className="text-sm text-zinc-500 mt-1">Linear progression of exact missions mapped to your skill gaps.</p>
          </div>
          <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-zinc-500">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-green-500" />Done</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-500" />Active</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500" />Next</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-zinc-800" />Locked</span>
          </div>
        </div>
      </div>

      {/* Timeline Wrapper */}
      <div className="max-w-4xl mx-auto px-4 sm:px-8 mt-12 relative">
        {/* Core vertical line running down */}
        <div className="absolute top-4 bottom-12 left-8 sm:left-12 w-[2px] bg-zinc-800/60 rounded-full" />

        <div className="flex flex-col gap-10">
          {sortedMissions.map((mission) => {
            const TypeIcon = TYPE_ICON[mission.type] ?? Code2;
            const style = STATUS_STYLE[mission.status] ?? STATUS_STYLE.LOCKED;

            return (
              <div key={mission.id} className="relative flex items-start gap-6 group">
                
                {/* Node Dot on Timeline */}
                <div className="relative z-10 shrink-0 mt-3 sm:mt-5 ml-2.5 sm:ml-[1.125rem]">
                  <div className={`w-3 h-3 rounded-full border border-zinc-950 ${style.dot} transition-colors duration-300`} />
                  {/* Subtle pulsing ring for active available mission */}
                  {mission.status === "AVAILABLE" && (
                    <div className="absolute top-0 left-0 w-3 h-3 rounded-full bg-blue-500 animate-ping opacity-40" />
                  )}
                  {mission.status === "IN_PROGRESS" && (
                    <div className="absolute top-0 left-0 w-3 h-3 rounded-full bg-amber-500 animate-ping opacity-40" />
                  )}
                </div>

                {/* Card Envelope */}
                <div 
                  onClick={() => setSelectedMission(mission)}
                  className={`relative flex-1 rounded-2xl border ${style.border} ${style.bg} p-5 sm:p-6 cursor-pointer shadow-lg transition-all duration-300 hover:shadow-xl hover:-translate-y-0.5`}
                >
                  <div className="flex items-center justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-zinc-900 flex items-center justify-center border border-zinc-800 shrink-0">
                        <TypeIcon className={`w-4 h-4 ${style.text}`} />
                      </div>
                      <div>
                        <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-mono tracking-widest uppercase border ${style.labelBg} mb-1.5`}>
                          {mission.status.replace("_", " ")}
                        </span>
                        <h3 className="text-lg text-white font-medium leading-tight group-hover:text-blue-100 transition-colors">
                          {mission.title}
                        </h3>
                      </div>
                    </div>
                    {/* View prompt chevron */}
                    <div className="hidden sm:flex shrink-0 w-8 h-8 items-center justify-center rounded-full bg-zinc-800/30 text-zinc-500 group-hover:bg-zinc-800 group-hover:text-zinc-300 transition-all">
                       <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>

                  <p className="text-sm text-zinc-500 leading-relaxed mb-5 line-clamp-2 pr-10">
                    {mission.description.replace(/#/g, '')}
                  </p>

                  <div className="flex items-center justify-between border-t border-zinc-800/60 pt-4 mt-auto">
                    <div className="flex items-center gap-4 text-xs font-mono text-zinc-500">
                      <div className="flex items-center gap-1.5 bg-zinc-900/50 px-2 py-1 rounded">
                        <Clock className="w-3.5 h-3.5" />
                        <span>{mission.estimatedHours}h estimated</span>
                      </div>
                      {mission.deadline && (
                        <div className="hidden sm:block text-zinc-600">
                          Due: {new Date(mission.deadline).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </div>
                      )}
                    </div>
                    
                    {mission.resources?.length > 0 && (
                      <div className="hidden sm:flex items-center gap-1.5">
                        <span className="text-[10px] text-zinc-600 uppercase tracking-widest font-mono">Resources:</span>
                        <div className="flex flex-wrap gap-2">
                          {mission.resources.slice(0, 3).map((r, i) => {
                            const RIcon = RESOURCE_ICON[r.type?.toLowerCase()] ?? FileCode2;
                            const RColor = RESOURCE_COLOR[r.type?.toLowerCase()] ?? "text-zinc-400";
                            return (
                              <div key={i} title={r.title} className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-700/80 transition-colors">
                                <RIcon className={`w-3 h-3 ${RColor.split(" ")[0]}`} />
                                <span className="text-[10px] text-zinc-400 max-w-[80px] truncate">{r.title}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Detail Drawer (Sheet) */}
      <Sheet open={!!selectedMission} onOpenChange={(open) => !open && setSelectedMission(null)}>
        {selectedMission && (
          <SheetContent className="flex flex-col bg-zinc-950/95 backdrop-blur-xl border-l border-zinc-800/50 shadow-[-20px_0_50px_-20px_rgba(0,0,0,0.8)] w-full sm:w-[700px] lg:w-[900px] xl:w-[1100px] 2xl:w-[1200px] sm:max-w-none p-0 overflow-hidden">
            <div className="shrink-0 bg-zinc-950/70 backdrop-blur-2xl z-20 border-b border-zinc-800/40 p-6 sm:p-8 shadow-sm">
              <SheetHeader>
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <span className="px-2.5 py-1 rounded text-[10px] font-mono tracking-widest uppercase bg-zinc-900 shadow-inner text-zinc-400 border border-zinc-800/50">
                    {selectedMission.type}
                  </span>
                  <span className={`px-2.5 py-1 rounded text-[10px] font-mono tracking-widest uppercase border shadow-inner ${STATUS_STYLE[selectedMission.status]?.labelBg}`}>
                    {selectedMission.status.replace('_', ' ')}
                  </span>
                </div>
                <SheetTitle className="text-2xl lg:text-3xl text-zinc-50 font-semibold tracking-tight leading-tight">
                  {selectedMission.title}
                </SheetTitle>
              </SheetHeader>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 sm:p-8">
              <div className="prose prose-invert max-w-none text-zinc-300 leading-relaxed tracking-wide">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    h3: ({...props}) => <h3 className="text-xl font-medium text-zinc-100 mt-10 mb-4 tracking-tight" {...props} />,
                    ul: ({...props}) => <ul className="list-disc pl-6 space-y-2 mt-4 mb-6 text-zinc-300 marker:text-zinc-600" {...props} />,
                    li: ({...props}) => <li className="pl-2 leading-loose" {...props} />,
                    code: ({className, children, inline, ...props}: unknown) => {
                      const match = /language-(\w+)/.exec(className || "");
                      const isInline = inline || (!match && !String(children).includes("\n"));
                      return isInline ? (
                        <code className="px-1.5 py-0.5 mx-0.5 rounded-md bg-zinc-800/80 text-blue-300 font-mono text-[13px] border border-zinc-700/50" {...props}>
                          {children}
                        </code>
                      ) : (
                        <div className="my-6 shadow-xl rounded-xl overflow-hidden border border-zinc-700/40">
                           <div className="flex items-center px-4 py-2 bg-zinc-900 border-b border-zinc-800">
                             <div className="flex gap-1.5">
                               <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                               <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                               <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                             </div>
                             {match?.[1] && <span className="ml-auto text-[10px] uppercase font-mono text-zinc-500">{match[1]}</span>}
                           </div>
                           <code className="block p-5 bg-[#0a0a0a] text-zinc-300 font-mono text-sm overflow-x-auto leading-relaxed" {...props}>
                             {children}
                           </code>
                        </div>
                      );
                    },
                    strong: ({...props}) => <strong className="font-semibold text-zinc-100" {...props} />,
                    p: ({...props}) => <p className="mb-6 leading-loose" {...props} />
                  }}
                >
                  {selectedMission.description}
                </ReactMarkdown>
              </div>

              {selectedMission.resources.length > 0 && (
                <div className="mt-12 pt-6 border-t border-zinc-900">
                  <h4 className="text-sm font-medium text-white mb-4">Recommended Resources</h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {selectedMission.resources.map((r, i) => {
                      const RIcon = RESOURCE_ICON[r.type?.toLowerCase()] ?? FileCode2;
                      const RColor = RESOURCE_COLOR[r.type?.toLowerCase()] ?? "text-zinc-400";
                      return (
                        <a
                          key={i}
                          href={r.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex flex-col gap-3 p-4 rounded-xl bg-zinc-900/40 hover:bg-zinc-800/80 border border-zinc-800/60 hover:border-zinc-700 transition-all group"
                        >
                          <div className="flex items-start justify-between">
                            <div className={`w-8 h-8 rounded-lg bg-zinc-950 flex items-center justify-center border border-zinc-800 shadow-inner ${RColor.split(" ")[0]} group-hover:scale-110 transition-transform`}>
                              <RIcon className="w-4 h-4" />
                            </div>
                            <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-zinc-300 transition-colors" />
                          </div>
                          <div>
                            <p className="text-[10px] uppercase tracking-widest text-zinc-500 font-mono mb-1">{r.type}</p>
                            <p className="text-sm font-medium text-zinc-300 group-hover:text-white line-clamp-2 transition-colors leading-snug">{r.title}</p>
                          </div>
                        </a>
                      );
                    })}
                  </div>
                </div>
              )}
              
              <MissionMentorChat missionId={selectedMission.id} />
              
              <div className="h-6" />
            </div>
            
            {/* Context-Aware Action Footer */}
            <div className="shrink-0 border-t border-zinc-800/50 bg-zinc-950/80 p-6 backdrop-blur-xl z-20">
              <div className="w-full max-w-xl mx-auto shadow-2xl">
                {selectedMission.status === "AVAILABLE" && (
                  <button
                    onClick={async () => {
                      try {
                        const res = await fetch(`/api/missions/${selectedMission.id}/status`, {
                          method: "PATCH",
                          body: JSON.stringify({ status: "IN_PROGRESS" }),
                          headers: { "Content-Type": "application/json" },
                        });
                        if (!res.ok) throw new Error();
                        toast.success("Mission started!");
                        setTimeout(() => window.location.reload(), 500);
                      } catch {
                         toast.error("Failed to start mission");
                      }
                    }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium shadow-lg shadow-blue-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Accept Mission
                  </button>
                )}
                {selectedMission.status === "IN_PROGRESS" && (
                  <button
                     onClick={async () => {
                        try {
                          const res = await fetch(`/api/missions/${selectedMission.id}/status`, {
                            method: "PATCH",
                            body: JSON.stringify({ status: "COMPLETED" }),
                            headers: { "Content-Type": "application/json" },
                          });
                          if (!res.ok) throw new Error();
                          toast.success("Mission completed! Interview queued.");
                          setTimeout(() => window.location.reload(), 1000);
                        } catch {
                           toast.error("Failed to complete mission");
                        }
                     }}
                    className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-600 hover:bg-green-500 text-white text-sm font-medium shadow-lg shadow-green-900/20 transition-all hover:-translate-y-0.5 active:translate-y-0"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    Mark as Completed
                  </button>
                )}
                {selectedMission.status === "LOCKED" && (
                   <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-zinc-900 text-zinc-500 text-sm font-medium border border-zinc-800">
                     <Lock className="w-4 h-4" />
                     Locked (Complete Prerequisites)
                   </div>
                )}
                {selectedMission.status === "COMPLETED" && (
                   <div className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-green-500/10 text-green-500 text-sm font-medium border border-green-500/20">
                     <CheckCircle2 className="w-4 h-4" />
                     Mission Completed
                   </div>
                )}
              </div>
            </div>
          </SheetContent>
        )}
      </Sheet>
    </div>
  );
}

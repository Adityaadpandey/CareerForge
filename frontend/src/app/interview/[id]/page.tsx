"use client";

import { useState, useRef, useEffect } from "react";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { Send, Mic, Square, ChevronRight, Zap, Bot, User } from "lucide-react";
import Link from "next/link";

type Message = {
  role: "ai" | "student";
  content: string;
  timestamp: string;
};

export default function InterviewPage() {
  const { id } = useParams<{ id: string }>();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [state, setState] = useState("OPENING");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  // Load existing session
  useEffect(() => {
    fetch(`/api/interviews/${id}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.transcript && Array.isArray(data.transcript)) {
          setMessages(data.transcript as Message[]);
        }
        if (data.status === "COMPLETED") setDone(true);
      });
  }, [id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading || done) return;

    const userMsg: Message = { role: "student", content: text, timestamp: new Date().toISOString() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch(`/api/interviews/${id}/message`, {
        method: "POST",
        body: JSON.stringify({ message: text }),
        headers: { "Content-Type": "application/json" },
      });
      const data = await res.json();

      const aiMsg: Message = { role: "ai", content: data.message, timestamp: new Date().toISOString() };
      setMessages((prev) => [...prev, aiMsg]);
      setState(data.state ?? state);
      if (data.done) setDone(true);
    } catch {
      toast.error("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const endInterview = async () => {
    if (loading) return;
    setLoading(true);
    try {
      await fetch(`/api/interviews/${id}/end`, { method: "POST" });
      setDone(true);
      toast.success("Interview complete! Generating your debrief...");
    } catch {
      toast.error("Failed to end interview.");
    } finally {
      setLoading(false);
    }
  };

  const STATE_LABELS: Record<string, string> = {
    OPENING: "Opening",
    TECHNICAL: "Technical",
    PROBING: "Probing",
    BEHAVIORAL: "Behavioral",
    CLOSING: "Closing",
    DEBRIEF: "Debrief",
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {/* Main chat */}
      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
              <Zap className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-white font-medium">Mock Interview</p>
              <p className="text-xs text-zinc-500 font-mono">{STATE_LABELS[state] ?? state}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {done ? (
              <Link
                href={`/interview/${id}/debrief`}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-500 hover:bg-amber-400 text-black text-xs font-medium rounded-lg transition-colors"
              >
                View Debrief
                <ChevronRight className="w-3 h-3" />
              </Link>
            ) : messages.length > 2 ? (
              <button
                onClick={endInterview}
                className="flex items-center gap-1.5 px-3 py-1.5 border border-zinc-700 text-zinc-400 hover:text-red-400 hover:border-red-400/50 text-xs rounded-lg transition-colors"
              >
                <Square className="w-3 h-3" />
                End Interview
              </button>
            ) : null}
          </div>
        </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
          {messages.length === 0 && !loading && (
            <div className="text-center py-12">
              <Bot className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
              <p className="text-zinc-500 text-sm">
                Type your first message to start the interview.
              </p>
            </div>
          )}

          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex gap-3 ${msg.role === "student" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  msg.role === "ai"
                    ? "bg-amber-500/10 border border-amber-500/30"
                    : "bg-zinc-800 border border-zinc-700"
                }`}
              >
                {msg.role === "ai" ? (
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                ) : (
                  <User className="w-3.5 h-3.5 text-zinc-400" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "ai"
                    ? "bg-zinc-900 border border-zinc-800/60 text-zinc-100"
                    : "bg-zinc-800 text-white"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
                <Bot className="w-3.5 h-3.5 text-amber-400" />
              </div>
              <div className="bg-zinc-900 border border-zinc-800/60 rounded-2xl px-4 py-3">
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-zinc-600 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s` }}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        {!done && (
          <div className="px-6 py-4 border-t border-zinc-800/60">
            <div className="flex gap-2 items-end">
              <textarea
                ref={textRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    sendMessage();
                  }
                }}
                placeholder="Type your answer… (Enter to send, Shift+Enter for new line)"
                rows={2}
                className="flex-1 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-zinc-700 resize-none"
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-10 h-10 flex items-center justify-center rounded-xl bg-amber-500 hover:bg-amber-400 text-black disabled:opacity-30 disabled:cursor-not-allowed transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-zinc-700 mt-2 font-mono text-center">
              Interview state: {STATE_LABELS[state] ?? state}
            </p>
          </div>
        )}

        {done && (
          <div className="px-6 py-4 border-t border-zinc-800/60 text-center">
            <p className="text-zinc-500 text-sm mb-3">Interview complete.</p>
            <Link
              href={`/interview/${id}/debrief`}
              className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
            >
              View Debrief
              <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

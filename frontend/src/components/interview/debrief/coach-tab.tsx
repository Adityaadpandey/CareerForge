"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { Send, Bot, User, Loader2 } from "lucide-react";

interface Props {
  interviewId: string;
}

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

const SUGGESTED = [
  "What was my biggest weakness?",
  "How can I improve my technical answers?",
  "What did my emotions say about my confidence?",
  "Give me a 3-step plan to do better next time.",
];

export function CoachTab({ interviewId }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      const userMsg: Message = { id: crypto.randomUUID(), role: "user", content: text };
      const assistantId = crypto.randomUUID();

      setMessages((prev) => [...prev, userMsg]);
      setInput("");
      setIsLoading(true);

      // Optimistic placeholder
      setMessages((prev) => [
        ...prev,
        { id: assistantId, role: "assistant", content: "" },
      ]);

      try {
        const res = await fetch(`/api/interviews/${interviewId}/chat`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...messages, userMsg].map((m) => ({
              role: m.role,
              content: m.content,
            })),
          }),
        });

        if (!res.body) throw new Error("No stream");

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let accumulated = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          accumulated += decoder.decode(value, { stream: true });
          const current = accumulated;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId ? { ...m, content: current } : m
            )
          );
        }
      } catch {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? { ...m, content: "Sorry, something went wrong. Please try again." }
              : m
          )
        );
      } finally {
        setIsLoading(false);
      }
    },
    [interviewId, isLoading, messages]
  );

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendMessage(input);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-160px)]">
      {/* Message area */}
      <div className="flex-1 overflow-y-auto space-y-4 pb-4">
        {/* Welcome screen */}
        {messages.length === 0 && (
          <div className="text-center py-10">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mx-auto mb-4">
              <Bot className="w-6 h-6 text-amber-400" />
            </div>
            <p className="text-sm text-white font-medium mb-1">AI Interview Coach</p>
            <p className="text-xs text-zinc-500 max-w-xs mx-auto">
              Ask anything about your performance — scores, specific moments, how to
              improve, or what your emotions revealed.
            </p>
            <div className="mt-6 flex flex-col gap-2 max-w-sm mx-auto">
              {SUGGESTED.map((s) => (
                <button
                  key={s}
                  onClick={() => sendMessage(s)}
                  className="text-left text-sm text-zinc-400 hover:text-white border border-zinc-800 hover:border-zinc-600 rounded-xl px-4 py-2.5 transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        {messages.map((m) => {
          const isUser = m.role === "user";
          return (
            <div key={m.id} className={`flex gap-3 ${isUser ? "flex-row-reverse" : ""}`}>
              <div
                className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 ${
                  isUser
                    ? "bg-zinc-700"
                    : "bg-amber-500/10 border border-amber-500/20"
                }`}
              >
                {isUser ? (
                  <User className="w-3.5 h-3.5 text-zinc-300" />
                ) : (
                  <Bot className="w-3.5 h-3.5 text-amber-400" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  isUser
                    ? "bg-zinc-800 text-zinc-200 rounded-tr-sm"
                    : "bg-zinc-900/80 border border-zinc-800/60 text-zinc-300 rounded-tl-sm"
                }`}
              >
                {m.content || (
                  <Loader2 className="w-4 h-4 animate-spin text-zinc-500" />
                )}
              </div>
            </div>
          );
        })}

        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <form
        onSubmit={onSubmit}
        className="flex gap-2 pt-4 border-t border-zinc-800/60"
      >
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask your coach anything..."
          disabled={isLoading}
          className="flex-1 bg-zinc-900/60 border border-zinc-800/60 rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/40 disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={isLoading || !input.trim()}
          className="p-2.5 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:cursor-not-allowed rounded-xl transition-colors"
        >
          <Send className="w-4 h-4 text-black" />
        </button>
      </form>
    </div>
  );
}

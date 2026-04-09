"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import axios from "axios";
import { Sidebar } from "@/components/shared/sidebar";
import { Bell, Check, Loader2 } from "lucide-react";

type Notification = {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
};

const TYPE_ICONS: Record<string, string> = {
  MISSION_AVAILABLE: "🗺️",
  INTERVIEW_READY: "🎤",
  JOB_MATCH: "💼",
  RISK_FLAG: "⚠️",
  STREAK_BROKEN: "🔥",
  ROADMAP_UPDATED: "📊",
  OFFER_RECEIVED: "🎉",
};

export default function NotificationsPage() {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery<Notification[]>({
    queryKey: ["notifications"],
    queryFn: () => axios.get<Notification[]>("/api/notifications").then((r) => r.data),
  });

  const markRead = useMutation({
    mutationFn: (id: string) => axios.patch("/api/notifications", { id }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const notifications = data ?? [];

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-3xl">
        <div className="mb-8">
          <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">Inbox</p>
          <h1 className="text-2xl text-white font-light">Notifications</h1>
        </div>

        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-6 h-6 text-zinc-600 animate-spin" />
          </div>
        )}

        {!isLoading && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <Bell className="w-10 h-10 text-zinc-700 mb-4" />
            <h2 className="text-lg text-white font-light mb-2">All caught up</h2>
            <p className="text-zinc-500 text-sm">No unread notifications.</p>
          </div>
        )}

        <div className="space-y-2">
          {notifications.map((n) => (
            <div
              key={n.id}
              className="flex items-start gap-4 p-4 bg-zinc-900/40 border border-zinc-800/60 rounded-xl hover:border-zinc-700 transition-colors"
            >
              <span className="text-xl shrink-0 mt-0.5">{TYPE_ICONS[n.type] ?? "🔔"}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">{n.title}</p>
                <p className="text-xs text-zinc-500 mt-0.5">{n.body}</p>
                <p className="text-xs text-zinc-700 font-mono mt-1">
                  {new Date(n.createdAt).toLocaleString()}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {n.actionUrl && (
                  <a
                    href={n.actionUrl}
                    className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                  >
                    View →
                  </a>
                )}
                <button
                  onClick={() => markRead.mutate(n.id)}
                  disabled={markRead.isPending}
                  className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-700 text-zinc-500 hover:text-green-400 hover:border-green-500/30 transition-colors disabled:opacity-40"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}

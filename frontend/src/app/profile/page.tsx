"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession, signIn as nextAuthSignIn } from "next-auth/react";
import axios from "axios";
import { useRef, useState, useEffect } from "react";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";
import { Sidebar } from "@/components/shared/sidebar";
import {
  User,
  Link2,
  Target,
  Building2,
  GraduationCap,
  Clock,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Loader2,
  Upload,
} from "lucide-react";

const profileSchema = z.object({
  department: z.string().min(1, "Required"),
  graduationYear: z.string().min(4, "Required"),
  githubUsername: z.string().optional(),
  leetcodeHandle: z.string().optional(),
  codeforcesHandle: z.string().optional(),
  linkedinUrl: z.string().url("Enter a valid URL").optional().or(z.literal("")),
  targetRole: z.string().optional(),
  dreamCompanies: z.string().optional(),
  timelineWeeks: z.string().optional(),
  hoursPerWeek: z.string().optional(),
});

type ProfileForm = z.infer<typeof profileSchema>;

type Profile = {
  department: string | null;
  graduationYear: number | null;
  githubUsername: string | null;
  leetcodeHandle: string | null;
  codeforcesHandle: string | null;
  linkedinUrl: string | null;
  targetRole: string | null;
  dreamCompanies: string[];
  timelineWeeks: number | null;
  hoursPerWeek: number | null;
  segment: string;
  streakDays: number;
  onboardingDone: boolean;
  platformConnections: Array<{
    platform: string;
    syncStatus: string;
    lastSyncedAt: string | null;
  }>;

};

const PLATFORM_LABELS: Record<string, string> = {
  GITHUB: "GitHub",
  LEETCODE: "LeetCode",
  CODEFORCES: "Codeforces",
  LINKEDIN: "LinkedIn",
  RESUME: "Resume",
};

const STATUS_COLOR: Record<string, string> = {
  DONE: "text-green-400",
  SYNCING: "text-amber-400",
  PENDING: "text-zinc-500",
  FAILED: "text-red-400",
};

const STATUS_ICON: Record<string, React.ReactNode> = {
  DONE: <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />,
  SYNCING: <Loader2 className="w-3.5 h-3.5 text-amber-400 animate-spin" />,
  PENDING: <Clock className="w-3.5 h-3.5 text-zinc-500" />,
  FAILED: <XCircle className="w-3.5 h-3.5 text-red-400" />,
};

const SYNC_COOLDOWN_MS = 24 * 60 * 60 * 1000;

function SyncButton({
  lastSyncedAt,
  isPending,
  onSync,
}: {
  lastSyncedAt: string | null;
  isPending: boolean;
  onSync: () => void;
}) {
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    setNow(Date.now());
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  const cooled = (lastSyncedAt && now)
    ? now - new Date(lastSyncedAt).getTime() < SYNC_COOLDOWN_MS
    : false;
  const hrsLeft = (cooled && lastSyncedAt && now)
    ? Math.ceil((SYNC_COOLDOWN_MS - (now - new Date(lastSyncedAt).getTime())) / 3_600_000)
    : 0;

  return (
    <button
      onClick={onSync}
      disabled={isPending || cooled}
      title={cooled ? `Next sync available in ${hrsLeft}h` : "Re-sync"}
      className="w-7 h-7 flex items-center justify-center rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
    >
      <RefreshCw className="w-3.5 h-3.5" />
    </button>
  );
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);
  const [linkedinInput, setLinkedinInput] = useState("");
  const [showLinkedinInput, setShowLinkedinInput] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  const { data: profile, isLoading } = useQuery<Profile>({
    queryKey: ["profile"],
    queryFn: () => axios.get<Profile>("/api/profile").then((r) => r.data),
  });

  const { data: linkedinStatus } = useQuery<{ configured: boolean }>({
    queryKey: ["linkedin-status"],
    queryFn: () => axios.get("/api/profile/linkedin/status").then((r) => r.data),
    staleTime: Infinity,
  });

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProfileForm>({
    resolver: standardSchemaResolver(profileSchema),
    values: profile
      ? {
          department: profile.department ?? "",
          graduationYear: String(
            profile.graduationYear ?? new Date().getFullYear() + 2,
          ),
          githubUsername: profile.githubUsername ?? "",
          leetcodeHandle: profile.leetcodeHandle ?? "",
          codeforcesHandle: profile.codeforcesHandle ?? "",
          linkedinUrl: profile.linkedinUrl ?? "",
          targetRole: profile.targetRole ?? "",
          dreamCompanies: profile.dreamCompanies.join(", "),
          timelineWeeks: profile.timelineWeeks
            ? String(profile.timelineWeeks)
            : "",
          hoursPerWeek: profile.hoursPerWeek
            ? String(profile.hoursPerWeek)
            : "",
        }
      : undefined,
  });

  const saveMutation = useMutation({
    mutationFn: (data: ProfileForm) =>
      axios.patch("/api/profile", {
        ...data,
        graduationYear: data.graduationYear
          ? parseInt(data.graduationYear, 10)
          : undefined,
        timelineWeeks: data.timelineWeeks
          ? parseInt(data.timelineWeeks, 10)
          : undefined,
        hoursPerWeek: data.hoursPerWeek
          ? parseInt(data.hoursPerWeek, 10)
          : undefined,
        dreamCompanies: data.dreamCompanies
          ? data.dreamCompanies
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [],
      }),
    onSuccess: () => {
      toast.success("Profile updated");
      setEditing(false);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: () => toast.error("Failed to save profile"),
  });

  const syncMutation = useMutation({
    mutationFn: (platform: string) =>
      axios.post("/api/profile/sync", { platform }),
    onSuccess: (_, platform) => {
      toast.success(`${PLATFORM_LABELS[platform]} sync queued`);
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      toast.error(msg ?? "Failed to queue sync");
    },
  });

  const linkedinUrlMutation = useMutation({
    mutationFn: (url: string) =>
      axios.post("/api/profile/linkedin", { linkedinUrl: url }),
    onSuccess: () => {
      toast.success("LinkedIn sync queued — takes ~60 seconds");
      setShowLinkedinInput(false);
      setLinkedinInput("");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: unknown) =>
      toast.error(
        (err as { response?: { data?: { error?: string } } })?.response?.data
          ?.error ?? "Failed to connect LinkedIn"
      ),
  });

  const resumeMutation = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData();
      form.append("resume", file);
      return axios.post("/api/profile/resume", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
    },
    onSuccess: () => {
      toast.success("Resume upload queued — parsing with AI takes ~60 seconds");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (err: unknown) =>
      toast.error((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? "Resume upload failed"),
  });

  const handleResumeFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast.error("Only PDF files are accepted");
      return;
    }
    resumeMutation.mutate(file);
    // Reset input so same file can be re-uploaded
    e.target.value = "";
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <Sidebar />
      <main className="flex-1 p-6 md:p-8 max-w-3xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <p className="text-xs font-mono tracking-widest text-zinc-500 uppercase mb-1">
              Account
            </p>
            <h1 className="text-2xl text-white font-light">Profile</h1>
          </div>
          <button
            onClick={() => setEditing((e) => !e)}
            className="px-4 py-2 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-sm rounded-lg transition-colors"
          >
            {editing ? "Cancel" : "Edit"}
          </button>
        </div>

        {/* Identity card */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 mb-4">
          <div className="flex items-center gap-4 mb-6">
            {session?.user?.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={session.user.image}
                alt="avatar"
                className="w-14 h-14 rounded-full border border-zinc-700"
              />
            ) : (
              <div className="w-14 h-14 rounded-full bg-zinc-800 flex items-center justify-center">
                <User className="w-6 h-6 text-zinc-500" />
              </div>
            )}
            <div>
              <p className="text-white font-medium">
                {session?.user?.name ?? "—"}
              </p>
              <p className="text-zinc-500 text-sm">
                {session?.user?.email ?? "—"}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-mono text-amber-400">
                  {profile?.segment?.replace("_", " ") ?? "UNASSESSED"}
                </span>
                {(profile?.streakDays ?? 0) > 0 && (
                  <span className="text-xs text-zinc-500">
                    · {profile?.streakDays}d streak
                  </span>
                )}
              </div>
            </div>
          </div>

          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <div
                  key={i}
                  className="h-8 bg-zinc-800/60 rounded animate-pulse"
                />
              ))}
            </div>
          ) : editing ? (
            <form
              onSubmit={handleSubmit((d) => saveMutation.mutate(d))}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    Department
                  </label>
                  <input
                    {...register("department")}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                    placeholder="e.g. Computer Science"
                  />
                  {errors.department && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.department.message}
                    </p>
                  )}
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    Graduation Year
                  </label>
                  <input
                    {...register("graduationYear")}
                    type="number"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    GitHub Username
                  </label>
                  <input
                    {...register("githubUsername")}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                    placeholder="octocat"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    LeetCode Handle
                  </label>
                  <input
                    {...register("leetcodeHandle")}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                    placeholder="user123"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    Codeforces Handle
                  </label>
                  <input
                    {...register("codeforcesHandle")}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    LinkedIn URL
                  </label>
                  <input
                    {...register("linkedinUrl")}
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                    placeholder="https://linkedin.com/in/..."
                  />
                  {errors.linkedinUrl && (
                    <p className="text-red-400 text-xs mt-1">
                      {errors.linkedinUrl.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                  Target Role
                </label>
                <input
                  {...register("targetRole")}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                  placeholder="e.g. Software Engineer"
                />
              </div>

              <div>
                <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                  Dream Companies (comma-separated)
                </label>
                <input
                  {...register("dreamCompanies")}
                  className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-amber-500/50 focus:outline-none"
                  placeholder="Google, Stripe, Anthropic"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    Timeline (weeks)
                  </label>
                  <input
                    {...register("timelineWeeks")}
                    type="number"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-zinc-500 font-mono uppercase tracking-wider block mb-1">
                    Hours per week
                  </label>
                  <input
                    {...register("hoursPerWeek")}
                    type="number"
                    className="w-full bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500/50 focus:outline-none"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={saveMutation.isPending}
                className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
              >
                {saveMutation.isPending ? "Saving…" : "Save changes"}
              </button>
            </form>
          ) : (
            <div className="space-y-3">
              {[
                {
                  icon: <GraduationCap className="w-4 h-4" />,
                  label: "Department",
                  value: profile?.department,
                },
                {
                  icon: <GraduationCap className="w-4 h-4" />,
                  label: "Graduation",
                  value: profile?.graduationYear?.toString(),
                },
                {
                  icon: <Target className="w-4 h-4" />,
                  label: "Target Role",
                  value: profile?.targetRole,
                },
                {
                  icon: <Building2 className="w-4 h-4" />,
                  label: "Dream Companies",
                  value: profile?.dreamCompanies?.join(", ") || null,
                },
                {
                  icon: <Clock className="w-4 h-4" />,
                  label: "Timeline",
                  value: profile?.timelineWeeks
                    ? `${profile.timelineWeeks} weeks · ${profile.hoursPerWeek ?? "?"} hrs/wk`
                    : null,
                },
                {
                  icon: <Link2 className="w-4 h-4" />,
                  label: "LinkedIn",
                  value: profile?.linkedinUrl || null,
                },
              ].map(({ icon, label, value }) => (
                <div key={label} className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-600 shrink-0">{icon}</span>
                  <span className="text-zinc-500 w-32 shrink-0">{label}</span>
                  <span className="text-white truncate">
                    {value || <span className="text-zinc-600">—</span>}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Platform connections */}
        <div className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6">
          <h2 className="text-sm font-medium text-white mb-4">
            Platform Connections
          </h2>

          {/* Hidden file input for resume */}
          <input
            ref={resumeInputRef}
            type="file"
            accept="application/pdf"
            className="hidden"
            onChange={handleResumeFile}
          />

          {(
            ["GITHUB", "LEETCODE", "CODEFORCES", "LINKEDIN", "RESUME"] as const
          ).map((platform) => {
            const conn = profile?.platformConnections?.find(
              (c) => c.platform === platform,
            );
            const status = conn?.syncStatus ?? "PENDING";

            return (
              <div
                key={platform}
                className="border-b border-zinc-800/40 last:border-0"
              >
                <div className="flex items-center justify-between py-3">
                  <div className="flex items-center gap-3">
                    {STATUS_ICON[status]}
                    <div>
                      <p className="text-sm text-white">
                        {PLATFORM_LABELS[platform]}
                      </p>
                      {conn?.lastSyncedAt && (
                        <p className="text-xs text-zinc-600">
                          Last synced{" "}
                          {new Date(conn.lastSyncedAt).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-mono ${STATUS_COLOR[status]}`}
                    >
                      {status}
                    </span>

                    {/* Platform-specific action buttons */}
                    {platform === "LINKEDIN" ? (
                      linkedinStatus?.configured ? (
                        // OAuth flow (when LinkedIn app is configured)
                        <button
                          onClick={() =>
                            nextAuthSignIn("linkedin", { callbackUrl: "/profile" })
                          }
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-500 hover:text-blue-400 hover:border-blue-500/30 text-xs transition-colors"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          {conn?.syncStatus === "DONE" ? "Re-sync" : "Connect"}
                        </button>
                      ) : (
                        // URL fallback (when OAuth not configured)
                        <button
                          onClick={() => setShowLinkedinInput((v) => !v)}
                          className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-500 hover:text-blue-400 hover:border-blue-500/30 text-xs transition-colors"
                        >
                          <Link2 className="w-3.5 h-3.5" />
                          {conn?.syncStatus === "DONE" ? "Re-sync" : "Connect"}
                        </button>
                      )
                    ) : platform === "RESUME" ? (
                      <button
                        onClick={() => resumeInputRef.current?.click()}
                        disabled={resumeMutation.isPending}
                        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-zinc-800 text-zinc-500 hover:text-amber-400 hover:border-amber-500/30 text-xs transition-colors disabled:opacity-40"
                      >
                        {resumeMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5" />
                        )}
                        {resumeMutation.isPending ? "Uploading…" : "Upload PDF"}
                      </button>
                    ) : (
                      <SyncButton
                        lastSyncedAt={conn?.lastSyncedAt ?? null}
                        isPending={syncMutation.isPending}
                        onSync={() => syncMutation.mutate(platform)}
                      />
                    )}
                  </div>
                </div>

                {/* LinkedIn URL input — shown when OAuth not configured */}
                {platform === "LINKEDIN" &&
                  !linkedinStatus?.configured &&
                  showLinkedinInput && (
                    <div className="pb-3 flex gap-2">
                      <input
                        type="url"
                        value={linkedinInput}
                        onChange={(e) => setLinkedinInput(e.target.value)}
                        placeholder="https://linkedin.com/in/yourname"
                        className="flex-1 bg-zinc-800/60 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-600 focus:border-blue-500/50 focus:outline-none"
                      />
                      <button
                        onClick={() => {
                          if (linkedinInput.trim())
                            linkedinUrlMutation.mutate(linkedinInput.trim());
                        }}
                        disabled={
                          linkedinUrlMutation.isPending || !linkedinInput.trim()
                        }
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-medium rounded-lg transition-colors disabled:opacity-50"
                      >
                        {linkedinUrlMutation.isPending ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          "Sync"
                        )}
                      </button>
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

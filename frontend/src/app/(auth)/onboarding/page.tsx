"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema";
import { z } from "zod";
import { toast } from "sonner";
import { signIn as nextAuthSignIn, useSession } from "next-auth/react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";
import { BrandLogo } from "@/components/shared/brand-logo";

import {
  Code2,
  Upload,
  Target,
  Clock,
  ChevronRight,
  ChevronLeft,
  Check,
  Zap,
  X,
  Link2,
  Loader2,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.374 0 0 5.373 0 12c0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0 1 12 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
    </svg>
  );
}

const ROLES = [
  "SDE", "Frontend Engineer", "Backend Engineer", "Full Stack Engineer",
  "Data Engineer", "ML Engineer", "DevOps Engineer", "Product Manager",
  "Data Analyst", "Security Engineer",
];

const COMPANIES = [
  "Google", "Meta", "Microsoft", "Amazon", "Apple", "Netflix", "Stripe",
  "Zepto", "Swiggy", "Zomato", "Razorpay", "CRED", "Atlassian", "Adobe",
  "Salesforce", "Coinbase", "Notion", "Linear", "Vercel",
];

const schema = z.object({
  leetcodeHandle: z.string().optional(),
  codeforcesHandle: z.string().optional(),
  targetRole: z.string().min(1, "Pick a target role"),
  dreamCompanies: z.array(z.string()).min(1, "Pick at least one company"),
  timelineWeeks: z.number().min(1).max(52),
  hoursPerWeek: z.number().min(1).max(80),
});

type FormData = z.infer<typeof schema>;

const STEPS = [
  { icon: GithubIcon, title: "GitHub Connected", desc: "Your GitHub account is linked" },
  { icon: Code2, title: "Coding Profiles", desc: "LeetCode & Codeforces" },
  { icon: Link2, title: "LinkedIn", desc: "Connect your professional profile" },
  { icon: Upload, title: "Resume", desc: "Upload your CV" },
  { icon: Target, title: "Target Role", desc: "Where do you want to go?" },
  { icon: Clock, title: "Timeline", desc: "How much time do you have?" },
];

const SESSION_KEY = "ob_step";

export default function OnboardingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { update: updateSession } = useSession();

  const [step, setStep] = useState(0);
  const [resumeFile, setResumeFile] = useState<File | null>(null);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [linkedinOAuthDone, setLinkedinOAuthDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Restore step from sessionStorage after LinkedIn OAuth redirect
  useEffect(() => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved) {
      setStep(Number(saved));
      sessionStorage.removeItem(SESSION_KEY);
    }
  }, []);

  // Detect LinkedIn OAuth return
  useEffect(() => {
    if (searchParams.get("li") === "1") {
      setLinkedinOAuthDone(true);
      // Clean up URL
      router.replace("/onboarding");
    }
  }, [searchParams, router]);

  const { data: linkedinStatus } = useQuery<{ configured: boolean; linked: boolean }>({
    queryKey: ["linkedin-status-ob"],
    queryFn: () => axios.get("/api/profile/linkedin/status").then((r) => r.data),
    staleTime: 30_000,
  });

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: standardSchemaResolver(schema),
    defaultValues: {
      dreamCompanies: [],
      timelineWeeks: 12,
      hoursPerWeek: 10,
    },
  });

  const dreamCompanies = watch("dreamCompanies");
  const targetRole = watch("targetRole");

  const toggleCompany = (company: string) => {
    const current = dreamCompanies ?? [];
    if (current.includes(company)) {
      setValue("dreamCompanies", current.filter((c) => c !== company));
    } else if (current.length < 5) {
      setValue("dreamCompanies", [...current, company]);
    }
  };

  const handleLinkedInOAuth = () => {
    sessionStorage.setItem(SESSION_KEY, String(step + 1));
    nextAuthSignIn("linkedin", { callbackUrl: "/onboarding?li=1" });
  };

  const onSubmit = async (data: FormData) => {
    if (step !== STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          leetcodeHandle: data.leetcodeHandle || null,
          codeforcesHandle: data.codeforcesHandle || null,
          linkedinUrl: linkedinUrl.trim() || null,
          targetRole: data.targetRole,
          dreamCompanies: data.dreamCompanies,
          timelineWeeks: data.timelineWeeks,
          hoursPerWeek: data.hoursPerWeek,
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { error?: string }).error ?? "Failed to submit");
      }

      const { profileId } = await res.json() as { profileId: string };

      // Upload resume in background if provided
      if (resumeFile) {
        const form = new FormData();
        form.append("resume", resumeFile);
        fetch("/api/profile/resume", { method: "POST", body: form }).catch(() => {});
      }

      // Refresh session so dashboard picks up new profile
      await updateSession();

      router.push("/onboarding/status");
    } catch {
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
    }
  };

  const linkedinLinked = linkedinOAuthDone || linkedinStatus?.linked;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/60">
        <BrandLogo markClassName="h-8 w-8 rounded-xl" textClassName="text-xs tracking-[0.2em]" />
        <span className="font-mono text-xs text-zinc-600">Step {step + 1} of {STEPS.length}</span>
      </div>

      {/* Progress bar */}
      <div className="h-px bg-zinc-800">
        <div
          className="h-full bg-amber-500 transition-all duration-500 ease-out"
          style={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
        />
      </div>

      <div className="flex flex-1 max-w-5xl mx-auto w-full">
        {/* Sidebar steps */}
        <div className="hidden md:flex flex-col gap-1 w-64 p-8 border-r border-zinc-800/60">
          {STEPS.map((s, i) => (
            <div
              key={i}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                i === step ? "bg-zinc-900 text-white" : i < step ? "text-zinc-500" : "text-zinc-700"
              }`}
            >
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                  i < step ? "bg-amber-500" : i === step ? "border-2 border-amber-500" : "border border-zinc-700"
                }`}
              >
                {i < step ? (
                  <Check className="w-2.5 h-2.5 text-black" />
                ) : (
                  <span className="text-[9px] font-mono text-current">{i + 1}</span>
                )}
              </div>
              <div>
                <p className="text-xs font-medium leading-none">{s.title}</p>
                <p className={`text-[10px] mt-0.5 ${i === step ? "text-zinc-500" : "text-zinc-700"}`}>
                  {s.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Main content */}
        <div className="flex-1 p-8 md:p-12 flex flex-col justify-between">
          <form onSubmit={handleSubmit(onSubmit)} className="flex-1 flex flex-col">
            <div className="flex-1">
              {/* Step 0: GitHub confirmed */}
              {step === 0 && (
                <StepWrapper
                  title="GitHub is connected"
                  subtitle="We'll use your public GitHub activity to analyze your projects and contribution history."
                >
                  <div className="flex items-center gap-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/50">
                    <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center">
                      <GithubIcon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="text-white text-sm font-medium">GitHub account linked</p>
                      <p className="text-zinc-500 text-xs mt-0.5">
                        Public repos, commits, and contribution graph will be analyzed
                      </p>
                    </div>
                    <div className="ml-auto w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                      <Check className="w-2.5 h-2.5 text-green-400" />
                    </div>
                  </div>
                  <InfoBox>
                    We only access public data. We never read private repos or commit to anything on your behalf.
                  </InfoBox>
                </StepWrapper>
              )}

              {/* Step 1: Coding profiles */}
              {step === 1 && (
                <StepWrapper
                  title="Connect your coding profiles"
                  subtitle="LeetCode stats help us evaluate your DSA readiness. Codeforces is optional."
                >
                  <div className="space-y-4">
                    <Field label="LeetCode handle" optional>
                      <input
                        {...register("leetcodeHandle")}
                        placeholder="e.g. john_doe"
                        className={inputCn}
                      />
                    </Field>
                    <Field label="Codeforces handle" optional>
                      <input
                        {...register("codeforcesHandle")}
                        placeholder="e.g. john1337"
                        className={inputCn}
                      />
                    </Field>
                  </div>
                  <InfoBox>
                    Skip if you don&apos;t have these — we&apos;ll weight other signals more heavily.
                  </InfoBox>
                </StepWrapper>
              )}

              {/* Step 2: LinkedIn */}
              {step === 2 && (
                <StepWrapper
                  title="Connect LinkedIn"
                  subtitle="We pull your work experience, education, and skills to build a richer career profile."
                >
                  {linkedinLinked ? (
                    // Connected state
                    <div className="flex items-center gap-4 p-5 rounded-xl border border-blue-500/20 bg-blue-500/5">
                      <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center">
                        <Link2 className="w-5 h-5 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">LinkedIn connected</p>
                        <p className="text-zinc-500 text-xs mt-0.5">
                          Your experience and skills will be imported automatically
                        </p>
                      </div>
                      <div className="ml-auto w-5 h-5 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-green-400" />
                      </div>
                    </div>
                  ) : linkedinStatus?.configured ? (
                    // OAuth available
                    <div className="space-y-4">
                      <button
                        type="button"
                        onClick={handleLinkedInOAuth}
                        className="w-full flex items-center justify-center gap-3 p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 hover:border-blue-500/30 hover:bg-blue-500/5 transition-all group"
                      >
                        <div className="w-8 h-8 rounded-lg bg-[#0077B5] flex items-center justify-center shrink-0">
                          <Link2 className="w-4 h-4 text-white" />
                        </div>
                        <div className="text-left">
                          <p className="text-sm text-white group-hover:text-blue-300 transition-colors">
                            Connect with LinkedIn
                          </p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            OAuth — secure, no password needed
                          </p>
                        </div>
                        <ChevronRight className="w-4 h-4 text-zinc-600 group-hover:text-blue-400 ml-auto transition-colors" />
                      </button>
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-zinc-800" />
                        </div>
                        <div className="relative flex justify-center">
                          <span className="bg-[#0a0a0a] px-3 text-xs text-zinc-600">or skip for now</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    // URL fallback (OAuth not configured)
                    <Field label="LinkedIn profile URL" optional>
                      <input
                        type="url"
                        value={linkedinUrl}
                        onChange={(e) => setLinkedinUrl(e.target.value)}
                        placeholder="https://linkedin.com/in/yourname"
                        className={inputCn}
                      />
                    </Field>
                  )}
                  <InfoBox>
                    Optional — skip if you prefer. You can always connect LinkedIn from your profile page later.
                  </InfoBox>
                </StepWrapper>
              )}

              {/* Step 3: Resume upload */}
              {step === 3 && (
                <StepWrapper
                  title="Upload your resume"
                  subtitle="We extract your skills, projects, and experience to build your profile."
                >
                  <label
                    className={`relative flex flex-col items-center justify-center gap-3 h-40 rounded-xl border-2 border-dashed cursor-pointer transition-colors ${
                      resumeFile
                        ? "border-amber-500/50 bg-amber-500/5"
                        : "border-zinc-800 hover:border-zinc-700 bg-zinc-900/30"
                    }`}
                  >
                    <input
                      type="file"
                      accept=".pdf"
                      className="sr-only"
                      onChange={(e) => setResumeFile(e.target.files?.[0] ?? null)}
                    />
                    {resumeFile ? (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                          <Check className="w-4 h-4 text-amber-500" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-white">{resumeFile.name}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">
                            {(resumeFile.size / 1024).toFixed(0)} KB · Click to replace
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="w-8 h-8 rounded-lg bg-zinc-800 flex items-center justify-center">
                          <Upload className="w-4 h-4 text-zinc-400" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm text-zinc-300">Drop PDF here or click to browse</p>
                          <p className="text-xs text-zinc-600 mt-0.5">Max 10 MB</p>
                        </div>
                      </>
                    )}
                  </label>
                  <InfoBox>Optional but recommended — significantly improves your ATS score and CV generation quality.</InfoBox>
                </StepWrapper>
              )}

              {/* Step 4: Target role */}
              {step === 4 && (
                <StepWrapper
                  title="What's your target role?"
                  subtitle="Pick the role you're aiming for and up to 5 dream companies."
                >
                  <div className="space-y-6">
                    <Field label="Target role" error={errors.targetRole?.message}>
                      <div className="flex flex-wrap gap-2">
                        {ROLES.map((role) => (
                          <button
                            type="button"
                            key={role}
                            onClick={() => setValue("targetRole", role)}
                            className={`px-3 py-1.5 rounded-full text-xs font-mono border transition-all ${
                              targetRole === role
                                ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                : "border-zinc-800 text-zinc-500 hover:border-zinc-700 hover:text-zinc-400"
                            }`}
                          >
                            {role}
                          </button>
                        ))}
                      </div>
                    </Field>

                    <Field
                      label="Dream companies"
                      optional
                      error={errors.dreamCompanies?.message}
                    >
                      <div className="flex flex-wrap gap-2">
                        {COMPANIES.map((company) => {
                          const selected = dreamCompanies?.includes(company);
                          return (
                            <button
                              type="button"
                              key={company}
                              onClick={() => toggleCompany(company)}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs border transition-all ${
                                selected
                                  ? "border-amber-500 bg-amber-500/10 text-amber-400"
                                  : "border-zinc-800 text-zinc-500 hover:border-zinc-700"
                              }`}
                            >
                              {selected && <Check className="w-2.5 h-2.5" />}
                              {company}
                            </button>
                          );
                        })}
                      </div>
                      {(dreamCompanies?.length ?? 0) > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {dreamCompanies.map((c) => (
                            <span
                              key={c}
                              className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 text-xs"
                            >
                              {c}
                              <button type="button" onClick={() => toggleCompany(c)}>
                                <X className="w-2.5 h-2.5" />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </Field>
                  </div>
                </StepWrapper>
              )}

              {/* Step 5: Timeline */}
              {step === 5 && (
                <StepWrapper
                  title="Plan your timeline"
                  subtitle="We'll pace your missions based on how much time you have."
                >
                  <div className="space-y-6">
                    <Field label="Weeks until placement / internship">
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono text-zinc-500">
                          <span>4 weeks</span>
                          <span className="text-amber-400">{watch("timelineWeeks")} weeks</span>
                          <span>52 weeks</span>
                        </div>
                        <input
                          type="range"
                          min={4}
                          max={52}
                          step={2}
                          {...register("timelineWeeks", { valueAsNumber: true })}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    </Field>

                    <Field label="Hours per week available for prep">
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-mono text-zinc-500">
                          <span>2 hrs</span>
                          <span className="text-amber-400">{watch("hoursPerWeek")} hrs/week</span>
                          <span>40 hrs</span>
                        </div>
                        <input
                          type="range"
                          min={2}
                          max={40}
                          step={2}
                          {...register("hoursPerWeek", { valueAsNumber: true })}
                          className="w-full accent-amber-500"
                        />
                      </div>
                    </Field>

                    <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-900/50 font-mono text-xs text-zinc-500 space-y-1">
                      <p className="text-zinc-400 text-sm">Your plan summary</p>
                      <p>⟶ {watch("timelineWeeks")} weeks × {watch("hoursPerWeek")} hrs = ~{watch("timelineWeeks") * watch("hoursPerWeek")} total prep hours</p>
                      <p>⟶ Target: <span className="text-amber-400">{targetRole || "not set"}</span></p>
                      <p>⟶ Companies: <span className="text-amber-400">{dreamCompanies?.join(", ") || "none selected"}</span></p>
                      {(linkedinLinked || linkedinUrl) && (
                        <p>⟶ LinkedIn: <span className="text-blue-400">connected</span></p>
                      )}
                      {resumeFile && (
                        <p>⟶ Resume: <span className="text-green-400">{resumeFile.name}</span></p>
                      )}
                    </div>
                  </div>
                </StepWrapper>
              )}
            </div>

            {/* Navigation */}
            <div className="flex items-center justify-between pt-8 border-t border-zinc-800/60 mt-8">
              <button
                type="button"
                onClick={() => setStep((s) => Math.max(0, s - 1))}
                disabled={step === 0}
                className="flex items-center gap-2 px-4 py-2 text-sm text-zinc-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="w-4 h-4" />
                Back
              </button>

              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStep((s) => s + 1);
                  }}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
                >
                  {step === 2 && !linkedinLinked ? "Skip" : "Continue"}
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex items-center gap-2 px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Zap className="w-4 h-4" />
                  )}
                  {submitting ? "Analyzing..." : "Start Analysis"}
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// ── Small helpers ──────────────────────────────────────────────────────────

const inputCn =
  "w-full bg-zinc-900 border border-zinc-800 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-amber-500/50 transition-colors font-mono";

function StepWrapper({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl text-white font-light tracking-tight">{title}</h2>
        <p className="text-zinc-500 text-sm mt-1">{subtitle}</p>
      </div>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({
  label,
  optional,
  error,
  children,
}: {
  label: string;
  optional?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <label className="text-xs font-mono tracking-wide text-zinc-400 uppercase">
          {label}
        </label>
        {optional && (
          <span className="text-[10px] text-zinc-600 font-mono">optional</span>
        )}
      </div>
      {children}
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2.5 p-3 rounded-lg bg-zinc-900/50 border border-zinc-800/60">
      <div className="w-1 h-1 rounded-full bg-amber-500 mt-1.5 shrink-0" />
      <p className="text-xs text-zinc-500 leading-relaxed">{children}</p>
    </div>
  );
}

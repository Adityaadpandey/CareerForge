import Link from "next/link";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-zinc-800/50">
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 bg-amber-500 rounded-sm flex items-center justify-center">
            <svg className="w-3 h-3 text-black" fill="currentColor" viewBox="0 0 24 24">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>
          <span className="font-mono text-xs tracking-widest text-amber-500 uppercase">CareerForge</span>
        </div>
        <Link
          href="/login"
          className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-lg transition-colors"
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="relative flex flex-col items-center justify-center text-center px-6 pt-24 pb-20">
        {/* Background glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-[600px] h-[300px] bg-amber-500/5 rounded-full blur-3xl" />
        </div>

        <div className="relative z-10 max-w-3xl">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-500/20 bg-amber-500/5 text-amber-400 text-xs font-mono mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
            AI-Powered Career Intelligence · HackAI 2025
          </div>

          <h1 className="text-5xl md:text-6xl font-light leading-tight tracking-tight mb-6">
            From student to
            <br />
            <span className="text-amber-400">hired</span> — intelligently.
          </h1>

          <p className="text-zinc-400 text-lg leading-relaxed max-w-xl mx-auto mb-10">
            CareerForge analyzes your GitHub, LeetCode, and resume to find gaps,
            generate a personalized roadmap, and coach you through mock interviews —
            all autonomously.
          </p>

          <div className="flex items-center justify-center gap-4">
            <Link
              href="/login"
              className="px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors"
            >
              Start for free
            </Link>
            <Link
              href="/login"
              className="px-6 py-3 border border-zinc-700 hover:border-zinc-500 text-zinc-400 hover:text-white text-sm rounded-xl transition-colors"
            >
              See dashboard →
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="px-8 py-16 max-w-6xl mx-auto">
        <p className="text-center text-xs font-mono tracking-widest text-zinc-600 uppercase mb-12">
          The full pipeline
        </p>
        <div className="grid md:grid-cols-3 gap-4">
          {[
            {
              icon: "📊",
              title: "Gap Analysis",
              desc: "Connects to GitHub, LeetCode, Codeforces & LinkedIn. Scores your DSA, Dev, Communication, and Consistency pillars. Tells you exactly what's missing.",
            },
            {
              icon: "🗺️",
              title: "Adaptive Roadmap",
              desc: "AI generates a mission-based roadmap with deadlines calibrated to your graduation date. Missions unlock as prerequisites complete.",
            },
            {
              icon: "🎤",
              title: "Mock Interviews",
              desc: "Conversational AI interviewer for technical, system design, and behavioral rounds. Debrief with sentiment scores, weak spots, and a question-by-question breakdown.",
            },
            {
              icon: "💼",
              title: "Job Matching",
              desc: "Scrapes LinkedIn, Wellfound, and Naukri daily. Ranks jobs by match score. One-click generates a tailored CV and cover letter per role.",
            },
            {
              icon: "📈",
              title: "Readiness Score",
              desc: "A single 0–100 readiness number that updates as you complete missions, practice, and improve consistency. Segment: Rising Star, Capable, At-Risk, Critical.",
            },
            {
              icon: "🏛️",
              title: "University Dashboard",
              desc: "TPO admins see all students by segment, set company drives, flag at-risk students, and push interventions — without chasing spreadsheets.",
            },
          ].map((f) => (
            <div
              key={f.title}
              className="bg-zinc-900/40 border border-zinc-800/60 rounded-2xl p-6 hover:border-zinc-700 transition-colors"
            >
              <div className="text-2xl mb-3">{f.icon}</div>
              <h3 className="text-white text-sm font-medium mb-2">{f.title}</h3>
              <p className="text-zinc-500 text-sm leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA */}
      <section className="px-8 py-16 text-center border-t border-zinc-800/50">
        <h2 className="text-3xl font-light text-white mb-4">
          Your career deserves a system.
        </h2>
        <p className="text-zinc-500 text-sm mb-8">Sign in with GitHub to get started in 60 seconds.</p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-6 py-3 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          Continue with GitHub
        </Link>
      </section>

      {/* Footer */}
      <footer className="px-8 py-6 border-t border-zinc-800/50 flex items-center justify-between">
        <span className="font-mono text-xs text-zinc-600 uppercase tracking-widest">CareerForge</span>
        <span className="text-xs text-zinc-700">HackAI 2025 · Built with Next.js + LangGraph</span>
      </footer>
    </div>
  );
}

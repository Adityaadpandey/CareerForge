"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

const STEPS = [
  {
    number: "01",
    title: "Connect",
    description: "Link your GitHub, LeetCode, Codeforces, and LinkedIn profiles. We pull your data securely — no passwords stored.",
    detail: "GitHub · LeetCode · Codeforces · LinkedIn",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m9.856-4.51a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
      </svg>
    ),
  },
  {
    number: "02",
    title: "Analyze",
    description: "AI agents scan your profiles and score 4 pillars: DSA, Development, Communication, and Consistency. You get a readiness score instantly.",
    detail: "4 pillars · 0–100 score · Segment label",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
      </svg>
    ),
  },
  {
    number: "03",
    title: "Plan",
    description: "Get a mission-based roadmap calibrated to your graduation date. Each mission has a deadline, a pillar, and clear deliverables.",
    detail: "Missions · Deadlines · Prerequisites",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c-.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
      </svg>
    ),
  },
  {
    number: "04",
    title: "Practice",
    description: "Complete missions, do mock interviews with the AI interviewer, and get detailed performance breakdowns with sentiment analysis.",
    detail: "Mock interviews · Sentiment scores · Weak-spot reports",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M15.59 14.37a6 6 0 01-5.84 7.38v-4.8m5.84-2.58a14.98 14.98 0 006.16-12.12A14.98 14.98 0 009.631 8.41m5.96 5.96a14.926 14.926 0 01-5.841 2.58m-.119-8.54a6 6 0 00-7.381 5.84h4.8m2.581-5.84a14.927 14.927 0 00-2.58 5.84m2.699 2.7c-.103.021-.207.041-.311.06a15.09 15.09 0 01-2.448-2.448 14.9 14.9 0 01.06-.312m-2.24 2.39a4.493 4.493 0 00-1.757 4.306 4.493 4.493 0 004.306-1.758M16.5 9a1.5 1.5 0 11-3 0 1.5 1.5 0 013 0z" />
      </svg>
    ),
  },
  {
    number: "05",
    title: "Land",
    description: "Get matched to jobs ranked by fit score. Auto-generate a tailored resume and cover letter per role. One-click apply.",
    detail: "Daily job scraping · CV generation · Cover letter",
    icon: (
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
      </svg>
    ),
  },
];

export default function HowItWorksSection() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start 85%", "end 45%"],
  });
  const lineHeight = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);

  return (
    <section id="how-it-works" className="relative px-6 md:px-10 lg:px-14 py-28 max-w-5xl mx-auto">
      {/* Section header */}
      <motion.div
        className="text-center mb-24"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] font-mono text-zinc-500 mb-4">
          <span className="w-1 h-1 rounded-full bg-amber-500" />
          HOW IT WORKS
        </span>
        <h2 className="text-3xl md:text-4xl lg:text-5xl font-light text-white tracking-tight">
          Five steps to{" "}
          <span
            className="font-serif italic bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            career clarity
          </span>
        </h2>
      </motion.div>

      {/* Timeline */}
      <div ref={containerRef} className="relative">
        {/* Track */}
        <div className="absolute left-5 md:left-1/2 md:-translate-x-1/2 top-0 bottom-0 w-px bg-zinc-800/50" />
        {/* Animated fill */}
        <motion.div
          className="absolute left-5 md:left-1/2 md:-translate-x-1/2 top-0 w-px bg-gradient-to-b from-amber-500 to-orange-500"
          style={{ height: lineHeight }}
        />

        <div className="space-y-20 md:space-y-24">
          {STEPS.map((step, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={step.number}
                initial={{ opacity: 0, x: isLeft ? -24 : 24 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.6, delay: 0.08 }}
                className={`relative flex items-start gap-6 ${isLeft ? "md:flex-row" : "md:flex-row-reverse"} flex-row`}
              >
                {/* Content card */}
                <div className={`flex-1 ml-14 md:ml-0 ${isLeft ? "md:text-right md:pr-14" : "md:text-left md:pl-14"}`}>
                  <div className="group inline-block">
                    <div className="p-5 rounded-2xl border border-zinc-800/50 bg-[#0d0d0d] hover:border-zinc-700/60 transition-all duration-400 max-w-sm">
                      <div className="flex items-center gap-2 mb-3 flex-wrap">
                        <span className="text-amber-500/50 font-mono text-xs">{step.number}</span>
                        <span className="flex-1 text-[10px] font-mono text-zinc-700 truncate">{step.detail}</span>
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">{step.title}</h3>
                      <p className="text-sm text-zinc-500 leading-relaxed">{step.description}</p>
                    </div>
                  </div>
                </div>

                {/* Center node */}
                <div className="absolute left-5 md:left-1/2 -translate-x-1/2 z-10">
                  <motion.div
                    className="w-10 h-10 rounded-full border-2 border-zinc-800 bg-zinc-950 flex items-center justify-center text-amber-500"
                    whileInView={{
                      borderColor: "rgba(245,158,11,0.7)",
                      boxShadow: "0 0 0 4px rgba(245,158,11,0.08), 0 0 20px rgba(245,158,11,0.15)",
                    }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.5, delay: 0.2 }}
                  >
                    {step.icon}
                  </motion.div>
                </div>

                {/* Spacer */}
                <div className="hidden md:block flex-1" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

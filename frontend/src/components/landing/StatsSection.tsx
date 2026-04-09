"use client";

import { useRef, useEffect, useState } from "react";
import { motion, useInView } from "framer-motion";

type StatItem = {
  value: number;
  suffix: string;
  label: string;
  sub: string;
};

const STATS: StatItem[] = [
  { value: 2500, suffix: "+", label: "Students Onboarded", sub: "Across 80+ colleges" },
  { value: 85, suffix: "%", label: "Placement Rate", sub: "vs 62% national avg" },
  { value: 50, suffix: "+", label: "Partner Companies", sub: "Actively hiring from us" },
  { value: 4.9, suffix: "★", label: "Average Rating", sub: "Based on 600+ reviews" },
];

function Counter({ value, suffix, isInView }: { value: number; suffix: string; isInView: boolean }) {
  const [count, setCount] = useState(0);
  const isDecimal = value % 1 !== 0;

  useEffect(() => {
    if (!isInView) return;
    const duration = 2000;
    const start = Date.now();
    const timer = setInterval(() => {
      const progress = Math.min((Date.now() - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const cur = value * eased;
      setCount(isDecimal ? parseFloat(cur.toFixed(1)) : Math.floor(cur));
      if (progress >= 1) clearInterval(timer);
    }, 16);
    return () => clearInterval(timer);
  }, [isInView, value, isDecimal]);

  return (
    <span className="tabular-nums">
      {isDecimal ? count.toFixed(1) : count.toLocaleString()}
      {suffix}
    </span>
  );
}

export default function StatsSection() {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section id="stats" className="relative py-24 px-6 md:px-10 lg:px-14">
      {/* Full-width dark panel */}
      <div className="absolute inset-x-0 inset-y-4 bg-zinc-950/50 border-y border-zinc-800/30 pointer-events-none" />
      <div className="absolute top-4 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent pointer-events-none" />
      <div className="absolute bottom-4 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500/20 to-transparent pointer-events-none" />

      <div ref={ref} className="relative max-w-6xl mx-auto">
        <motion.div
          className="text-center mb-16"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] font-mono text-zinc-500 mb-4">
            <span className="w-1 h-1 rounded-full bg-amber-500" />
            BY THE NUMBERS
          </span>
          <h2 className="text-3xl md:text-4xl font-light text-white tracking-tight">
            Numbers that{" "}
            <span
              className="font-serif italic bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent"
              style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
            >
              speak for themselves
            </span>
          </h2>
        </motion.div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {STATS.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.12 }}
              className="group text-center"
            >
              <div className="relative p-6 rounded-2xl border border-zinc-800/50 bg-[#0d0d0d] hover:border-zinc-700/60 transition-all duration-500 overflow-hidden">
                {/* Hover glow */}
                <div className="absolute inset-0 rounded-2xl bg-gradient-to-t from-amber-500/[0.04] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                <div className="text-4xl md:text-5xl font-light text-white mb-2 group-hover:text-amber-50 transition-colors">
                  <Counter value={stat.value} suffix={stat.suffix} isInView={isInView} />
                </div>
                <p className="text-sm font-medium text-zinc-400 mb-1">{stat.label}</p>
                <p className="text-[10px] font-mono text-zinc-600">{stat.sub}</p>

                {/* Bottom accent */}
                <motion.div
                  className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[2px] bg-gradient-to-r from-transparent via-amber-500 to-transparent"
                  initial={{ width: 0 }}
                  whileInView={{ width: "60%" }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.4 + i * 0.12, duration: 0.8 }}
                />
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

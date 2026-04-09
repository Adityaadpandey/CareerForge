"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";

export default function CTASection() {
  return (
    <section className="relative px-6 md:px-10 py-32 overflow-hidden">
      {/* Background mesh */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-amber-500/[0.04] blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-orange-500/[0.06] blur-3xl animate-pulse" />
        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.015]"
          style={{
            backgroundImage: "linear-gradient(rgba(245,158,11,1) 1px, transparent 1px), linear-gradient(90deg, rgba(245,158,11,1) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
      </div>

      {/* Top gradient border */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-2/3 h-[1px] bg-gradient-to-r from-transparent via-amber-500/30 to-transparent" />

      <motion.div
        className="relative z-10 max-w-3xl mx-auto text-center"
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        {/* Eyebrow */}
        <motion.span
          className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-[10px] font-mono text-zinc-500 mb-8 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
        >
          <span className="w-1 h-1 rounded-full bg-amber-500" />
          FREE FOR STUDENTS
        </motion.span>

        <h2 className="text-4xl md:text-5xl lg:text-6xl font-light tracking-[-0.04em] mb-6 leading-tight">
          <span className="text-white">Your career deserves</span>
          <br />
          <span
            className="font-serif italic bg-gradient-to-br from-amber-400 via-orange-400 to-amber-500 bg-clip-text text-transparent"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            a system.
          </span>
        </h2>

        <p className="text-zinc-400 text-lg max-w-xl mx-auto mb-10 leading-relaxed">
          Stop guessing. Start building with AI that understands your unique path.
          Sign in with GitHub and be set up in 60 seconds.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <Link href="/login">
            <motion.div
              className="group relative inline-flex items-center gap-3 px-8 py-4 rounded-2xl text-sm font-medium text-black bg-gradient-to-r from-amber-500 to-orange-500 shadow-[0_20px_60px_rgba(245,158,11,0.3)] overflow-hidden"
              whileHover={{ scale: 1.05, boxShadow: "0 28px 80px rgba(245,158,11,0.4)" }}
              whileTap={{ scale: 0.97 }}
              transition={{ type: "spring", stiffness: 400 }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              <svg className="relative z-10 w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
              <span className="relative z-10">Continue with GitHub</span>
              <ArrowRight className="relative z-10 w-4 h-4 transition-transform group-hover:translate-x-0.5" />
            </motion.div>
          </Link>

          <Link href="/login">
            <motion.div
              className="group inline-flex items-center gap-2 px-8 py-4 rounded-2xl text-sm font-medium text-zinc-400 border border-zinc-800 hover:border-zinc-700 hover:text-zinc-200 transition-all duration-300"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
            >
              See the dashboard →
            </motion.div>
          </Link>
        </div>

        {/* Trust signals */}
        <motion.div
          className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-[11px] font-mono text-zinc-700"
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.4 }}
        >
          {["Free forever for students", "No credit card needed", "GitHub OAuth only", "Setup in 60 seconds"].map((t) => (
            <span key={t} className="flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-amber-500/40" />
              {t}
            </span>
          ))}
        </motion.div>
      </motion.div>
    </section>
  );
}

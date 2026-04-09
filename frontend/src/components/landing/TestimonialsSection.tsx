"use client";

import { motion } from "framer-motion";

const TESTIMONIALS_1 = [
  {
    quote: "Got my Google internship after 3 months on CareerForge. The gap analysis told me exactly where I was bleeding points.",
    name: "Arjun Sharma",
    role: "IIT Delhi · CS '25",
    score: "DSA: 42 → 84",
  },
  {
    quote: "The mock interview AI was brutal — in the best way. My actual interview felt easy compared to the practice sessions.",
    name: "Priya Mehta",
    role: "BITS Pilani · CS '24",
    score: "Readiness: 41 → 79",
  },
  {
    quote: "I never knew my GitHub was giving the wrong signal. CareerForge showed me how to fix my contribution graph story.",
    name: "Rohan Kumar",
    role: "NIT Trichy · ECE '25",
    score: "Dev pillar: 38 → 76",
  },
  {
    quote: "Adaptive roadmap with graduation deadlines was a game changer. No more guessing what to study next.",
    name: "Sneha Iyer",
    role: "VIT Chennai · IT '25",
    score: "Roadmap: 5 missions done",
  },
  {
    quote: "Placed at Razorpay. The job match feature filtered 800+ JDs down to 12 that actually fit my profile.",
    name: "Vikram Rao",
    role: "IIIT Hyderabad · CS '24",
    score: "Match score: 91%",
  },
];

const TESTIMONIALS_2 = [
  {
    quote: "Our TPO team finally has visibility into which students need help before placement season, not after.",
    name: "Prof. Anita Desai",
    role: "TPO Lead · SRM University",
    score: "40% placement improvement",
  },
  {
    quote: "Went from 0 DSA problems solved to cracking Amazon SDE-1 in 6 months. The missions kept me accountable.",
    name: "Aditya Verma",
    role: "Amity University · CS '24",
    score: "From 0 → Amazon offer",
  },
  {
    quote: "The behavioral interview coach picked up on filler words I didn't even notice. My communication score jumped 30 points.",
    name: "Kavya Nair",
    role: "Manipal Institute · IT '25",
    score: "Comm: 49 → 81",
  },
  {
    quote: "Tailored resume for Flipkart in one click. They said my CV was 'one of the strongest they'd seen' from campus.",
    name: "Harsh Patel",
    role: "DJ Sanghvi · EXTC '24",
    score: "Flipkart PPO",
  },
  {
    quote: "CareerForge understood my non-CS background better than any resource I'd tried. Transition from ECE to SWE done.",
    name: "Divya Krishnan",
    role: "PSG Tech · ECE '25",
    score: "Role switch success",
  },
];

function TestimonialCard({ quote, name, role, score }: { quote: string; name: string; role: string; score: string }) {
  return (
    <div className="flex-shrink-0 w-[300px] rounded-2xl border border-zinc-800/50 bg-zinc-900/30 p-5 mx-3 backdrop-blur-sm">
      {/* Stars */}
      <div className="flex gap-0.5 mb-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <svg key={i} className="w-3 h-3 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.162c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.287 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.287-3.957a1 1 0 00-.364-1.118L2.05 9.384c-.783-.57-.38-1.81.588-1.81h4.162a1 1 0 00.95-.69L9.049 2.927z" />
          </svg>
        ))}
      </div>
      <p className="text-sm text-zinc-300 leading-relaxed mb-4">&ldquo;{quote}&rdquo;</p>
      <div className="flex items-end justify-between">
        <div>
          <p className="text-xs text-white font-medium">{name}</p>
          <p className="text-[10px] text-zinc-600 font-mono mt-0.5">{role}</p>
        </div>
        <span className="text-[9px] font-mono text-amber-500/70 bg-amber-500/10 border border-amber-500/15 px-2 py-0.5 rounded-full">
          {score}
        </span>
      </div>
    </div>
  );
}

export default function TestimonialsSection() {
  const row1 = [...TESTIMONIALS_1, ...TESTIMONIALS_1];
  const row2 = [...TESTIMONIALS_2, ...TESTIMONIALS_2];

  return (
    <section className="relative py-24 overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[300px] bg-amber-500/[0.025] rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <motion.div
        className="text-center mb-12 px-6"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        <span className="inline-flex items-center gap-2 rounded-full border border-zinc-800 bg-zinc-900/50 px-3 py-1 text-[10px] font-mono text-zinc-500 mb-4">
          <span className="w-1 h-1 rounded-full bg-amber-500" />
          STUDENT STORIES
        </span>
        <h2 className="text-3xl md:text-4xl font-light text-white tracking-tight">
          Trusted by{" "}
          <span
            className="font-serif italic bg-gradient-to-br from-amber-400 to-orange-500 bg-clip-text text-transparent"
            style={{ fontFamily: "var(--font-serif), Georgia, serif" }}
          >
            ambitious students
          </span>
        </h2>
      </motion.div>

      {/* Row 1 — forward */}
      <div className="relative mb-4">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#080808] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#080808] to-transparent" />
        <div className="flex overflow-hidden">
          <div className="flex animate-marquee">
            {row1.map((t, i) => (
              <TestimonialCard key={`r1-${i}`} {...t} />
            ))}
          </div>
        </div>
      </div>

      {/* Row 2 — reverse */}
      <div className="relative">
        <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-r from-[#080808] to-transparent" />
        <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-24 z-10 bg-gradient-to-l from-[#080808] to-transparent" />
        <div className="flex overflow-hidden">
          <div className="flex animate-marquee-reverse">
            {row2.map((t, i) => (
              <TestimonialCard key={`r2-${i}`} {...t} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

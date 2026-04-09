"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { BrandLogo } from "@/components/shared/brand-logo";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <motion.nav
      className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-6 md:px-10 py-4 transition-all duration-300"
      style={{
        backgroundColor: `rgba(8, 8, 8, ${scrolled ? 0.85 : 0})`,
        borderBottom: `1px solid rgba(245, 158, 11, ${scrolled ? 0.1 : 0})`,
        backdropFilter: scrolled ? "blur(20px) saturate(180%)" : "none",
      }}
    >
      {/* Logo */}
      <Link href="/" className="flex items-center gap-2.5 group">
        <motion.div
          whileHover={{ scale: 1.1, rotate: 5 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          <BrandLogo
            markClassName="h-9 w-9 rounded-[1rem]"
            textClassName="text-sm tracking-[0.2em] font-medium"
          />
        </motion.div>
      </Link>

      {/* Nav links - hidden on mobile */}
      <div className="hidden md:flex items-center gap-8">
        {["Features", "How it Works", "Stats"].map((item) => (
          <button
            key={item}
            onClick={() => {
              const el = document.getElementById(item.toLowerCase().replace(/\s+/g, "-"));
              el?.scrollIntoView({ behavior: "smooth" });
            }}
            className="text-sm text-zinc-500 hover:text-amber-400 transition-colors duration-200 font-mono tracking-wide"
          >
            {item}
          </button>
        ))}
      </div>

      {/* CTA */}
      <Link href="/login">
        <motion.div
          className="relative px-5 py-2.5 rounded-xl text-sm font-medium text-black bg-gradient-to-r from-amber-500 to-orange-500 overflow-hidden"
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400 }}
        >
          {/* Glow pulse overlay */}
          <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-orange-400 opacity-0 hover:opacity-100 transition-opacity duration-300" />
          <span className="relative z-10">Get Started</span>
        </motion.div>
      </Link>
    </motion.nav>
  );
}

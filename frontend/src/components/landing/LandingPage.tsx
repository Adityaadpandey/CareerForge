"use client";

import Navbar from "./Navbar";
import HeroSection from "./HeroSection";
import HeroScene from "./HeroScene";
import LogoStrip from "./LogoStrip";
import FeaturesSection from "./FeaturesSection";
import StatsSection from "./StatsSection";
import TestimonialsSection from "./TestimonialsSection";
import HowItWorksSection from "./HowItWorksSection";
import CTASection from "./CTASection";
import FooterSection from "./FooterSection";

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#080808] text-white overflow-x-hidden">
      {/* Fixed navbar */}
      <Navbar />

      {/* Hero with animated background */}
      <div className="relative">
        <HeroScene />
        <HeroSection />
      </div>

      {/* Company logo strip */}
      <LogoStrip />

      {/* Features bento grid */}
      <FeaturesSection />

      {/* Section divider */}
      <div className="relative h-px max-w-5xl mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/40 to-transparent" />
      </div>

      {/* Stats */}
      <StatsSection />

      {/* Testimonials marquee */}
      <TestimonialsSection />

      {/* Section divider */}
      <div className="relative h-px max-w-5xl mx-auto">
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-zinc-800/40 to-transparent" />
      </div>

      {/* How it works */}
      <HowItWorksSection />

      {/* Final CTA */}
      <CTASection />

      {/* Footer */}
      <FooterSection />
    </div>
  );
}

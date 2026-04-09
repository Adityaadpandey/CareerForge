"use client";

const COMPANIES = [
  "Google", "Microsoft", "Amazon", "Meta", "Atlassian",
  "Flipkart", "Paytm", "Adobe", "Goldman Sachs", "JP Morgan",
  "Salesforce", "Uber", "Razorpay", "Zepto", "PhonePe",
  "Swiggy", "Zomato", "Meesho", "Groww", "CRED",
];

// Duplicate for seamless loop
const STRIP = [...COMPANIES, ...COMPANIES];

export default function LogoStrip() {
  return (
    <div className="relative py-10 overflow-hidden border-y border-zinc-800/30">
      {/* Fade edges */}
      <div className="pointer-events-none absolute left-0 top-0 bottom-0 w-28 z-10 bg-gradient-to-r from-[#080808] to-transparent" />
      <div className="pointer-events-none absolute right-0 top-0 bottom-0 w-28 z-10 bg-gradient-to-l from-[#080808] to-transparent" />

      {/* Label */}
      <div className="text-center mb-6">
        <span className="text-[10px] font-mono text-zinc-600 tracking-[0.25em] uppercase">
          Students hired at
        </span>
      </div>

      {/* Marquee */}
      <div className="flex overflow-hidden">
        <div className="flex items-center gap-12 animate-marquee flex-shrink-0">
          {STRIP.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="whitespace-nowrap text-sm font-mono text-zinc-600 hover:text-zinc-300 transition-colors duration-300 flex-shrink-0 cursor-default select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { useRef, useState, useEffect } from "react";

type FeatureCardProps = {
  icon: React.ReactNode;
  title: string;
  description: string;
  index: number;
};

export default function FeatureCard({ icon, title, description, index }: FeatureCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const [cardSize, setCardSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    if (cardRef.current) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCardSize({
        width: cardRef.current.offsetWidth || 1,
        height: cardRef.current.offsetHeight || 1,
      });
    }
  }, [isHovered]);

  const rotateX = isHovered ? ((mousePos.y / cardSize.height) - 0.5) * -10 : 0;
  const rotateY = isHovered ? ((mousePos.x / cardSize.width) - 0.5) * 10 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{
        duration: 0.5,
        delay: index * 0.1,
        ease: "easeOut",
      }}
    >
      <div
        ref={cardRef}
        className="relative group cursor-pointer h-full"
        onMouseMove={handleMouseMove}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          perspective: "1000px",
        }}
      >
        <div
          className="relative h-full rounded-2xl border border-zinc-800/60 bg-zinc-900/30 backdrop-blur-sm p-7 transition-all duration-300 overflow-hidden"
          style={{
            transform: `rotateX(${rotateX}deg) rotateY(${rotateY}deg)`,
            transition: isHovered ? "transform 0.1s ease-out" : "transform 0.4s ease-out",
          }}
        >
          {/* Spotlight effect */}
          {isHovered && (
            <div
              className="absolute pointer-events-none transition-opacity duration-300"
              style={{
                background: `radial-gradient(300px circle at ${mousePos.x}px ${mousePos.y}px, rgba(245, 158, 11, 0.08), transparent 60%)`,
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
              }}
            />
          )}

          {/* Glowing border follow */}
          {isHovered && (
            <div
              className="absolute inset-0 pointer-events-none rounded-2xl"
              style={{
                background: `radial-gradient(200px circle at ${mousePos.x}px ${mousePos.y}px, rgba(245, 158, 11, 0.15), transparent 60%)`,
                mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                maskComposite: "exclude",
                padding: "1px",
              }}
            />
          )}

          {/* Icon */}
          <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-amber-500/10 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-5 group-hover:border-amber-500/40 group-hover:shadow-lg group-hover:shadow-amber-500/10 transition-all duration-300">
            <div className="text-amber-500 group-hover:text-amber-400 transition-colors">
              {icon}
            </div>
          </div>

          {/* Content */}
          <h3 className="text-white text-base font-medium mb-2.5 group-hover:text-amber-50 transition-colors">
            {title}
          </h3>
          <p className="text-zinc-500 text-sm leading-relaxed group-hover:text-zinc-400 transition-colors">
            {description}
          </p>

          {/* Bottom glow line on hover */}
          <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0 h-[1px] bg-gradient-to-r from-transparent via-amber-500 to-transparent group-hover:w-3/4 transition-all duration-500" />
        </div>
      </div>
    </motion.div>
  );
}

import { cn } from "@/lib/utils";

type BrandMarkProps = {
  className?: string;
};

type BrandLogoProps = {
  className?: string;
  markClassName?: string;
  textClassName?: string;
  subtitle?: string;
};

export function BrandMark({ className }: BrandMarkProps) {
  return (
    <div
      className={cn(
        "relative flex items-center justify-center overflow-hidden rounded-[1.15rem] border border-orange-400/35 bg-[linear-gradient(135deg,#fb923c_0%,#f59e0b_55%,#ea580c_100%)] text-black shadow-[0_10px_30px_rgba(249,115,22,0.28)]",
        className
      )}
    >
      <div className="absolute inset-[1px] rounded-[calc(1.15rem-1px)] bg-[radial-gradient(circle_at_30%_25%,rgba(255,255,255,0.34),transparent_38%),linear-gradient(160deg,rgba(255,255,255,0.22),transparent_48%)]" />
      <svg
        viewBox="0 0 48 48"
        className="relative z-10 h-[68%] w-[68%]"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M33.5 13.5c-2.6-2.2-5.7-3.3-9.4-3.3-7.7 0-13.8 6.1-13.8 13.8s6.1 13.8 13.8 13.8c3.6 0 6.8-1.1 9.5-3.4"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
        <path
          d="M25.5 18.2h9.9v9.9"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M34.9 18.6 21.7 31.8"
          stroke="currentColor"
          strokeWidth="4.2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );
}

export function BrandLogo({
  className,
  markClassName,
  textClassName,
  subtitle,
}: BrandLogoProps) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <BrandMark className={cn("h-11 w-11 shrink-0", markClassName)} />
      <div className="min-w-0">
        <p
          className={cn(
            "truncate font-mono text-[11px] uppercase tracking-[0.32em] text-orange-400",
            textClassName
          )}
        >
          CareerForge
        </p>
        {subtitle ? <p className="truncate text-xs text-zinc-500">{subtitle}</p> : null}
      </div>
    </div>
  );
}

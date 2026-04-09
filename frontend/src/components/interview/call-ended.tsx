"use client";

import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";

interface Props {
  interviewId: string;
}

export const CallEnded = ({ interviewId }: Props) => {
  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-5 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-sm w-full mx-4 text-center">
        <div className="w-12 h-12 rounded-full bg-green-500/10 border border-green-500/30 flex items-center justify-center">
          <CheckCircle2 className="w-6 h-6 text-green-400" />
        </div>
        <div>
          <h2 className="text-lg text-white font-light">Interview Complete</h2>
          <p className="text-sm text-zinc-500 mt-1">
            Your scorecard is being generated. This usually takes 1–2 minutes.
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-zinc-500 font-mono">
          <Clock className="w-3.5 h-3.5" />
          Processing transcript + emotion data…
        </div>
        <div className="flex flex-col gap-2 w-full">
          <Link
            href={`/interview/${interviewId}/debrief`}
            className="w-full py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors text-center"
          >
            View Scorecard
          </Link>
          <Link
            href="/interview"
            className="w-full py-2.5 border border-zinc-800 text-zinc-400 hover:text-white text-sm rounded-xl transition-colors text-center"
          >
            Back to Interviews
          </Link>
        </div>
      </div>
    </div>
  );
};

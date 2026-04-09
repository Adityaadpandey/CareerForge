"use client";

import { useSession } from "next-auth/react";
import { Loader2 } from "lucide-react";
import { CallConnect } from "./call-connect";

interface Props {
  interviewId: string;
  interviewType: string;
}

export const CallProvider = ({ interviewId, interviewType }: Props) => {
  const { data: session, status } = useSession();

  if (status === "loading" || !session?.user) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <CallConnect
      interviewId={interviewId}
      interviewType={interviewType}
      userId={session.user.id!}
      userName={session.user.name ?? "Student"}
      userImage={session.user.image ?? ""}
    />
  );
};

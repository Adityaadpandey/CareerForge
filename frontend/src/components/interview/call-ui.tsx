"use client";

import { StreamTheme, useCall } from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useState, useCallback } from "react";
import { toast } from "sonner";
import { CallLobby } from "./call-lobby";
import { CallActive, EmotionSample } from "./call-active";
import { CallEnded } from "./call-ended";

interface Props {
  interviewId: string;
  interviewType: string;
}

export const CallUI = ({ interviewId, interviewType }: Props) => {
  const call = useCall();
  const [show, setShow] = useState<"lobby" | "call" | "ended">("lobby");

  const handleJoin = async () => {
    if (!call) return;
    await call.join();
    setShow("call");
  };

  const handleLeave = useCallback(
    async (emotionSamples: EmotionSample[]) => {
      if (!call) return;

      const emotionData =
        emotionSamples.length > 0
          ? {
              sampleCount: emotionSamples.length,
              samples: emotionSamples,
              averages: Object.fromEntries(
                (
                  [
                    "neutral",
                    "happy",
                    "sad",
                    "angry",
                    "fearful",
                    "disgusted",
                    "surprised",
                  ] as const
                ).map((emotion) => [
                  emotion,
                  parseFloat(
                    (
                      emotionSamples.reduce(
                        (sum, s) => sum + (s.expressions[emotion] ?? 0),
                        0
                      ) / emotionSamples.length
                    ).toFixed(3)
                  ),
                ])
              ),
            }
          : null;

      try {
        await fetch(`/api/interviews/${interviewId}/end`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emotionData }),
        });
      } catch {
        console.error("Failed to save emotion data");
      }

      call.endCall();
      setShow("ended");
      toast.success("Interview complete! Your scorecard is being generated…");
    },
    [call, interviewId]
  );

  return (
    <StreamTheme className="h-full">
      {show === "lobby" && (
        <CallLobby onJoin={handleJoin} interviewType={interviewType} />
      )}
      {show === "call" && (
        <CallActive onLeave={handleLeave} interviewType={interviewType} />
      )}
      {show === "ended" && <CallEnded interviewId={interviewId} />}
    </StreamTheme>
  );
};

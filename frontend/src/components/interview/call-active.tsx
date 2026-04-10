"use client";

import { useEffect, useRef, useCallback } from "react";
import {
  CallControls,
  SpeakerLayout,
  ParticipantsAudio,
  useCallStateHooks,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Zap } from "lucide-react";

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical Interview",
  SYSTEM_DESIGN: "System Design Interview",
  BEHAVIORAL: "Behavioral Interview",
  HR: "HR Interview",
  MIXED: "Mixed Interview",
};

export type EmotionSample = {
  timestamp: number;
  expressions: {
    neutral: number;
    happy: number;
    sad: number;
    angry: number;
    fearful: number;
    disgusted: number;
    surprised: number;
  };
};

interface Props {
  onLeave: (emotionSamples: EmotionSample[]) => void;
  interviewType: string;
}

// Renders hidden <audio> elements for every remote participant (including AI agent)
function RemoteAudio() {
  const { useParticipants } = useCallStateHooks();
  const participants = useParticipants();
  return <ParticipantsAudio participants={participants} />;
}

export const CallActive = ({ onLeave, interviewType }: Props) => {
  const emotionSamplesRef = useRef<EmotionSample[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const faceapiRef = useRef<typeof import("face-api.js") | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initFaceApi = async () => {
      try {
        const faceapi = await import("face-api.js");
        faceapiRef.current = faceapi;

        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(
            "https://raw.githack.com/justadudewhohacks/face-api.js/master/weights"
          ),
          faceapi.nets.faceExpressionNet.loadFromUri(
            "https://raw.githack.com/justadudewhohacks/face-api.js/master/weights"
          ),
        ]);

        if (cancelled) return;

        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        streamRef.current = stream;

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }

        intervalRef.current = setInterval(async () => {
          if (!videoRef.current || !faceapiRef.current) return;
          try {
            const detections = await faceapiRef.current
              .detectSingleFace(
                videoRef.current,
                new faceapiRef.current.TinyFaceDetectorOptions()
              )
              .withFaceExpressions();

            if (detections) {
              emotionSamplesRef.current.push({
                timestamp: Date.now(),
                expressions: detections.expressions as EmotionSample["expressions"],
              });
            }
          } catch {
            // Face not detected this frame — silent
          }
        }, 2000);
      } catch (err) {
        console.warn("[face-api] Emotion detection unavailable:", err);
      }
    };

    initFaceApi();

    return () => {
      cancelled = true;
      if (intervalRef.current) clearInterval(intervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const handleLeave = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
    }
    onLeave(emotionSamplesRef.current);
  }, [onLeave]);

  return (
    <div className="flex flex-col h-full bg-[#0a0a0a]">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-zinc-800/60">
        <div className="w-7 h-7 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center">
          <Zap className="w-3.5 h-3.5 text-amber-400" />
        </div>
        <div>
          <p className="text-sm text-white font-medium">
            {TYPE_LABELS[interviewType] ?? "Mock Interview"}
          </p>
          <p className="text-xs text-zinc-500 font-mono">Live · Recording</p>
        </div>
        <div className="ml-auto flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-zinc-500 font-mono">REC</span>
        </div>
      </div>

      {/* Plays audio from ALL remote participants including the AI agent */}
      <RemoteAudio />

      {/* Video area */}
      <div className="flex-1 overflow-hidden">
        <SpeakerLayout />
      </div>

      {/* Controls */}
      <div className="border-t border-zinc-800/60 px-4 py-3 flex justify-center">
        <CallControls onLeave={handleLeave} />
      </div>

      {/* Hidden video for face-api.js */}
      <video ref={videoRef} className="hidden" muted playsInline />
    </div>
  );
};

"use client";

import { LogIn } from "lucide-react";
import {
  DefaultVideoPlaceholder,
  StreamVideoParticipant,
  ToggleAudioPreviewButton,
  ToggleVideoPreviewButton,
  useCallStateHooks,
  VideoPreview,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { useSession } from "next-auth/react";

const TYPE_LABELS: Record<string, string> = {
  TECHNICAL: "Technical Interview",
  SYSTEM_DESIGN: "System Design Interview",
  BEHAVIORAL: "Behavioral Interview",
  HR: "HR Interview",
  MIXED: "Mixed Interview",
};

interface Props {
  onJoin: () => void;
  interviewType: string;
}

const DisabledPlaceholder = () => {
  const { data: session } = useSession();
  return (
    <DefaultVideoPlaceholder
      participant={
        {
          name: session?.user?.name ?? "You",
          image: session?.user?.image ?? "",
        } as StreamVideoParticipant
      }
    />
  );
};

const PermissionWarning = () => (
  <p className="text-sm text-zinc-400 text-center px-4">
    Please grant your browser permission to access your microphone and camera.
  </p>
);

export const CallLobby = ({ onJoin, interviewType }: Props) => {
  const { useCameraState, useMicrophoneState } = useCallStateHooks();
  const { hasBrowserPermission: hasMicPermission } = useMicrophoneState();
  const { hasBrowserPermission: hasCameraPermission } = useCameraState();
  const hasPermissions = hasCameraPermission && hasMicPermission;

  return (
    <div className="flex flex-col items-center justify-center h-full bg-[#0a0a0a]">
      <div className="flex flex-col items-center gap-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-8 max-w-md w-full mx-4">
        <div className="text-center">
          <p className="text-xs font-mono text-amber-400 uppercase tracking-widest mb-1">
            Ready to start?
          </p>
          <h2 className="text-lg text-white font-light">
            {TYPE_LABELS[interviewType] ?? "Mock Interview"}
          </h2>
          <p className="text-sm text-zinc-500 mt-1">
            Set up your camera and mic before joining
          </p>
        </div>
        <VideoPreview
          DisabledVideoPreview={
            hasPermissions ? DisabledPlaceholder : PermissionWarning
          }
        />
        <div className="flex gap-3">
          <ToggleAudioPreviewButton />
          <ToggleVideoPreviewButton />
        </div>
        <button
          onClick={onJoin}
          className="w-full flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 text-black text-sm font-medium rounded-xl transition-colors"
        >
          <LogIn className="w-4 h-4" />
          Join Interview
        </button>
      </div>
    </div>
  );
};

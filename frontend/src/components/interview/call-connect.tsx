"use client";

import { useEffect, useState } from "react";
import {
  Call,
  CallingState,
  StreamCall,
  StreamVideo,
  StreamVideoClient,
} from "@stream-io/video-react-sdk";
import "@stream-io/video-react-sdk/dist/css/styles.css";
import { Loader2 } from "lucide-react";
import { CallUI } from "./call-ui";

interface Props {
  interviewId: string;
  interviewType: string;
  userId: string;
  userName: string;
  userImage: string;
}

export const CallConnect = ({
  interviewId,
  interviewType,
  userId,
  userName,
  userImage,
}: Props) => {
  const [client, setClient] = useState<StreamVideoClient>();
  const [call, setCall] = useState<Call>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    let cancelled = false;
    let _client: StreamVideoClient | undefined;

    const init = async () => {
      try {
        // Fetch token first so client has it immediately on connect
        const res = await fetch("/api/interviews/token");
        const { token } = (await res.json()) as { token: string };
        if (cancelled) return;

        _client = new StreamVideoClient({
          apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
          user: { id: userId, name: userName, image: userImage },
          token,
        });

        const _call = _client.call("default", interviewId);
        _call.camera.disable();
        _call.microphone.disable();

        if (cancelled) {
          await _client.disconnectUser();
          return;
        }

        setClient(_client);
        setCall(_call);
      } catch (err) {
        if (!cancelled) {
          setError("Failed to connect. Please refresh and try again.");
          console.error("[CallConnect] init failed:", err);
        }
      }
    };

    init();

    return () => {
      cancelled = true;
      void (async () => {
        if (_client) {
          try {
            const callState = _client.call("default", interviewId).state.callingState;
            if (callState !== CallingState.LEFT) {
              await _client.call("default", interviewId).leave().catch(() => {});
            }
          } catch {
            // ignore
          }
          await _client.disconnectUser().catch(() => {});
        }
        setClient(undefined);
        setCall(undefined);
      })();
    };
  }, [userId, userName, userImage, interviewId]);

  if (error) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-red-400">{error}</p>
      </div>
    );
  }

  if (!client || !call) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#0a0a0a]">
        <Loader2 className="w-6 h-6 animate-spin text-amber-400" />
      </div>
    );
  }

  return (
    <StreamVideo client={client}>
      <StreamCall call={call}>
        <CallUI interviewId={interviewId} interviewType={interviewType} />
      </StreamCall>
    </StreamVideo>
  );
};

"use client";

import { useCallback, useEffect, useState } from "react";
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
  const generateToken = useCallback(async () => {
    const res = await fetch("/api/interviews/token");
    const data = await res.json() as { token: string };
    return data.token;
  }, []);

  const [client, setClient] = useState<StreamVideoClient>();
  useEffect(() => {
    const _client = new StreamVideoClient({
      apiKey: process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY!,
      user: { id: userId, name: userName, image: userImage },
      tokenProvider: generateToken,
    });
    setClient(_client);
    return () => {
      _client.disconnectUser();
      setClient(undefined);
    };
  }, [generateToken, userId, userName, userImage]);

  const [call, setCall] = useState<Call>();
  useEffect(() => {
    if (!client) return;
    const _call = client.call("default", interviewId);
    _call.camera.disable();
    _call.microphone.disable();
    setCall(_call);
    return () => {
      if (_call.state.callingState !== CallingState.LEFT) {
        _call.leave();
      }
      setCall(undefined);
    };
  }, [client, interviewId]);

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

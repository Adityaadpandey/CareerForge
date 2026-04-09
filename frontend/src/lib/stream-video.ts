import "server-only";
import { StreamClient } from "@stream-io/node-sdk";

let _client: StreamClient | null = null;

export function getStreamVideo(): StreamClient {
  if (!_client) {
    if (!process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY || !process.env.STREAM_VIDEO_SECRET_KEY) {
      throw new Error("Stream Video env vars not configured");
    }
    _client = new StreamClient(
      process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY,
      process.env.STREAM_VIDEO_SECRET_KEY,
    );
  }
  return _client;
}

// Convenience proxy — behaves like the original `streamVideo` export
export const streamVideo = new Proxy({} as StreamClient, {
  get(_target, prop) {
    return (getStreamVideo() as unknown as Record<string | symbol, unknown>)[prop];
  },
});

import { Queue } from "bullmq";
import { redis } from "./redis";

export const QUEUES = {
  INGESTION: "ingestion",
  ANALYSIS: "analysis",
  INTERVIEW: "interview",
  JOBS: "jobs",
  APPLY: "apply",
  NOTIFY: "notify",
  SEGMENT: "segment",
} as const;

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES];

// Queue instances (lazy singletons)
const queueInstances: Partial<Record<QueueName, Queue>> = {};

export function getQueue(name: QueueName): Queue {
  if (!queueInstances[name]) {
    queueInstances[name] = new Queue(name, { connection: redis });
  }
  return queueInstances[name]!;
}

// Typed job payloads
export type IngestionJob =
  | { type: "GITHUB"; studentProfileId: string; username: string }
  | { type: "LEETCODE"; studentProfileId: string; handle: string }
  | { type: "RESUME"; studentProfileId: string; fileKey: string }
  | { type: "LINKEDIN"; studentProfileId: string; linkedinUrl: string };

export type AnalysisJob =
  | { type: "GAP_ANALYSIS"; studentProfileId: string }
  | { type: "ROADMAP"; studentProfileId: string };

export type JobsJob =
  | { type: "FETCH_JOBS"; studentProfileId: string }
  | { type: "MATCH_SCORE"; studentProfileId: string; jobIds: string[] };

export type ApplyJob = {
  studentProfileId: string;
  jobId: string;
  autoSubmit: boolean;
};

export type NotifyJob = {
  userId: string;
  type: string;
  title: string;
  body: string;
  actionUrl?: string;
};

export type SegmentJob = { universityId: string };

// Producer helpers
export async function enqueueIngestion(data: IngestionJob) {
  return getQueue(QUEUES.INGESTION).add(data.type, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}

export async function enqueueAnalysis(data: AnalysisJob) {
  return getQueue(QUEUES.ANALYSIS).add(data.type, data, {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  });
}

export async function enqueueNotify(data: NotifyJob) {
  return getQueue(QUEUES.NOTIFY).add("notify", data);
}

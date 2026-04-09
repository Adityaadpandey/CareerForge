import { Worker, Job } from "bullmq";
import { redis } from "./redis";
import { QUEUES } from "./queue";
import type { IngestionJob, AnalysisJob } from "./queue";

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_SECRET = process.env.AI_SERVICE_SECRET ?? "careerforge-internal-secret-2025";

async function callAI(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${AI_URL}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Internal-Secret": AI_SECRET,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`AI service ${path} returned ${res.status}: ${text}`);
  }

  return res.json();
}

// ─── INGESTION WORKER ──────────────────────────────────────────
const ingestionWorker = new Worker(
  QUEUES.INGESTION,
  async (job: Job<IngestionJob>) => {
    console.log(`[ingestion] Processing ${job.name} job ${job.id}`);

    switch (job.data.type) {
      case "GITHUB":
        return callAI("/ingest/github", {
          student_profile_id: job.data.studentProfileId,
          username: job.data.username,
        });
      case "LEETCODE":
        return callAI("/ingest/leetcode", {
          student_profile_id: job.data.studentProfileId,
          handle: job.data.handle,
        });
      case "RESUME":
        return callAI("/ingest/resume", {
          student_profile_id: job.data.studentProfileId,
          file_key: job.data.fileKey,
        });
      default:
        throw new Error(`Unknown ingestion type: ${(job.data as any).type}`);
    }
  },
  {
    connection: redis,
    concurrency: 3,
  }
);

// ─── ANALYSIS WORKER ───────────────────────────────────────────
const analysisWorker = new Worker(
  QUEUES.ANALYSIS,
  async (job: Job<AnalysisJob>) => {
    console.log(`[analysis] Processing ${job.name} job ${job.id}`);

    switch (job.data.type) {
      case "GAP_ANALYSIS":
        return callAI("/analyze/gap", {
          student_profile_id: job.data.studentProfileId,
        });
      case "ROADMAP":
        return callAI("/analyze/roadmap", {
          student_profile_id: job.data.studentProfileId,
        });
      default:
        throw new Error(`Unknown analysis type: ${(job.data as any).type}`);
    }
  },
  {
    connection: redis,
    concurrency: 2,
  }
);

// ─── EVENT HANDLERS ────────────────────────────────────────────
for (const [name, worker] of Object.entries({
  ingestion: ingestionWorker,
  analysis: analysisWorker,
})) {
  worker.on("completed", (job) => {
    console.log(`[${name}] ✓ Job ${job.id} completed`);
  });

  worker.on("failed", (job, err) => {
    console.error(`[${name}] ✗ Job ${job?.id} failed:`, err.message);
  });

  worker.on("error", (err) => {
    console.error(`[${name}] Worker error:`, err.message);
  });
}

console.log("🚀 BullMQ workers started — listening for ingestion & analysis jobs");

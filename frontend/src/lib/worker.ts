import "dotenv/config";
import { Worker, Job, Queue } from "bullmq";
import { redis } from "./redis";
import { QUEUES } from "./queue";
import type { IngestionJob, AnalysisJob, JobsJob } from "./queue";

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

// Lazy analysis queue for chaining
const analysisQueue = new Queue(QUEUES.ANALYSIS, { connection: redis });

// ─── INGESTION WORKER ──────────────────────────────────────────
const ingestionWorker = new Worker(
  QUEUES.INGESTION,
  async (job: Job<IngestionJob>) => {
    console.log(`[ingestion] Processing ${job.name} job ${job.id}`);
    const sid = job.data.studentProfileId;

    // Process ingestion
    let result: unknown;
    switch (job.data.type) {
      case "GITHUB":
        result = await callAI("/ingest/github", {
          student_profile_id: sid,
          username: job.data.username,
        });
        break;
      case "LEETCODE":
        result = await callAI("/ingest/leetcode", {
          student_profile_id: sid,
          handle: job.data.handle,
        });
        break;
      case "RESUME":
        result = await callAI("/ingest/resume", {
          student_profile_id: sid,
          pdf_b64: job.data.fileKey, // fileKey holds the base64-encoded PDF bytes
        });
        break;
      case "LINKEDIN":
        result = await callAI("/ingest/linkedin", {
          student_profile_id: sid,
          linkedin_url: job.data.linkedinUrl,
        });
        break;
      default:
        throw new Error(`Unknown ingestion type: ${(job.data as any).type}`);
    }

    // Decrement counter and queue analysis when all ingestion done.
    // Do this INSIDE the processor so it's guaranteed before the job completes.
    try {
      const key = `pending_ingestion:${sid}`;
      const remaining = await redis.decr(key);
      console.log(`[ingestion] ✓ ${job.name} done for ${sid} — ${remaining} job(s) remaining`);
      if (remaining <= 0) {
        await redis.del(key);
        console.log(`[ingestion] All done for ${sid} — queuing gap analysis`);
        await analysisQueue.add(
          "GAP_ANALYSIS",
          { type: "GAP_ANALYSIS", studentProfileId: sid },
          { jobId: `gap-${sid}`, attempts: 3, backoff: { type: "exponential", delay: 3000 } }
        );
      }
    } catch (err: any) {
      // Non-fatal: AI service pipeline will also trigger as backup
      console.error(`[ingestion] counter/queue error for ${sid}:`, err?.message);
    }

    return result;
  },
  { connection: redis, concurrency: 3 }
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
  { connection: redis, concurrency: 2 }
);

// Chain: gap analysis → roadmap → job fetch
const jobsQueue = new Queue(QUEUES.JOBS, { connection: redis });

analysisWorker.on("completed", async (job: Job<AnalysisJob>) => {
  console.log(`[analysis] ✓ Job ${job.id} (${job.name}) completed`);
  const sid = job.data.studentProfileId;
  if (job.data.type === "GAP_ANALYSIS") {
    console.log(`[analysis] Gap done — queuing roadmap for ${sid}`);
    await analysisQueue.add("ROADMAP", { type: "ROADMAP", studentProfileId: sid }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 3000 },
    });
  } else if (job.data.type === "ROADMAP") {
    console.log(`[analysis] Roadmap done — queuing job fetch for ${sid}`);
    await jobsQueue.add("FETCH_JOBS", { type: "FETCH_JOBS", studentProfileId: sid }, {
      attempts: 3,
      backoff: { type: "exponential", delay: 5000 },
    });
  }
});

// ─── JOBS WORKER ───────────────────────────────────────────────
const jobsWorker = new Worker(
  QUEUES.JOBS,
  async (job: Job<JobsJob>) => {
    console.log(`[jobs] Processing ${job.name} job ${job.id}`);
    switch (job.data.type) {
      case "FETCH_JOBS":
        return callAI("/jobs/fetch", { student_profile_id: job.data.studentProfileId });
      case "MATCH_SCORE":
        return callAI("/jobs/match", {
          student_profile_id: job.data.studentProfileId,
          job_ids: job.data.jobIds,
        });
      default:
        throw new Error(`Unknown jobs type: ${(job.data as any).type}`);
    }
  },
  { connection: redis, concurrency: 2 }
);

jobsWorker.on("completed", (job: Job<JobsJob>) => {
  console.log(`[jobs] ✓ Job ${job.id} (${job.name}) completed`);
});

// ─── ERROR HANDLERS ────────────────────────────────────────────
ingestionWorker.on("failed", (job, err) => {
  console.error(`[ingestion] ✗ Job ${job?.id} failed:`, err.message);
});
analysisWorker.on("failed", (job, err) => {
  console.error(`[analysis] ✗ Job ${job?.id} failed:`, err.message);
});
jobsWorker.on("failed", (job, err) => {
  console.error(`[jobs] ✗ Job ${job?.id} failed:`, err.message);
});
ingestionWorker.on("error", (err) => console.error("[ingestion] Worker error:", err.message));
analysisWorker.on("error", (err) => console.error("[analysis] Worker error:", err.message));
jobsWorker.on("error", (err) => console.error("[jobs] Worker error:", err.message));

console.log("🚀 BullMQ workers started — listening for ingestion & analysis jobs");

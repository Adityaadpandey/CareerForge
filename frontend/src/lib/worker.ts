/**
 * CareerForge BullMQ Worker
 *
 * Supports selective startup via WORKER_TYPE env var:
 *   WORKER_TYPE=ingestion  — only ingestion jobs
 *   WORKER_TYPE=analysis   — only analysis + chaining
 *   WORKER_TYPE=jobs       — only job-fetch / match-score
 *   WORKER_TYPE=all        — all workers (default, used in dev)
 *
 * For production, use pm2.config.cjs to run each type as separate processes.
 */
import "dotenv/config";
import IORedis from "ioredis";
import { Worker, Job, Queue, type ConnectionOptions } from "bullmq";
import { QUEUES } from "./queue";
import type { IngestionJob, AnalysisJob, JobsJob } from "./queue";

// ─── CONFIG ────────────────────────────────────────────────────────────────

const AI_URL = process.env.AI_SERVICE_URL ?? "http://localhost:8000";
const AI_SECRET = process.env.AI_SERVICE_SECRET ?? "careerforge-internal-secret-2025";
const REDIS_URL = process.env.REDIS_URL ?? "redis://:cantremember@localhost:6379";
const WORKER_TYPE = (process.env.WORKER_TYPE ?? "all") as "ingestion" | "analysis" | "jobs" | "all";

// Each worker needs its own IORedis connection — BullMQ blocks the connection
// during BLPOP and sharing causes issues under load.
function makeConn(name: string): ConnectionOptions {
  const conn = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    lazyConnect: false,
    connectionName: `worker:${name}:${process.pid}`,
  });
  conn.on("error", (err) => console.error(`[redis:${name}] ${err.message}`));
  return conn as unknown as ConnectionOptions;
}

// ─── AI CALL ───────────────────────────────────────────────────────────────

async function callAI(
  path: string,
  body: Record<string, unknown>,
  timeoutMs = 180_000,
): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`${AI_URL}${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": AI_SECRET,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`AI service ${path} returned ${res.status}: ${text.slice(0, 300)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

// ─── SHARED JOB OPTIONS ────────────────────────────────────────────────────

const defaultJobOpts = {
  attempts: 3,
  backoff: { type: "exponential" as const, delay: 2000 },
  removeOnComplete: { count: 200, age: 86_400 },  // keep 200 or 24h, whichever is less
  removeOnFail: { count: 500 },
};

// ─── INGESTION WORKER ──────────────────────────────────────────────────────

function startIngestionWorker() {
  // Dedicated Redis connection for counter operations + queue chaining
  const counterRedis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    connectionName: `worker:ingestion-counter:${process.pid}`,
  });
  counterRedis.on("error", (err) => console.error(`[redis:ingestion-counter] ${err.message}`));

  const analysisQueue = new Queue(QUEUES.ANALYSIS, {
    connection: makeConn("ingestion→analysis-queue"),
    defaultJobOptions: defaultJobOpts,
  });

  const worker = new Worker<IngestionJob>(
    QUEUES.INGESTION,
    async (job) => {
      const sid = job.data.studentProfileId;
      const label = `[ingestion:${job.data.type}:${job.id}]`;
      console.log(`${label} start sid=${sid}`);

      let result: unknown;
      switch (job.data.type) {
        case "GITHUB":
          result = await callAI("/ingest/github", {
            student_profile_id: sid,
            username: job.data.username,
          }, 120_000);
          break;
        case "LEETCODE":
          result = await callAI("/ingest/leetcode", {
            student_profile_id: sid,
            handle: job.data.handle,
          }, 60_000);
          break;
        case "RESUME":
          result = await callAI("/ingest/resume", {
            student_profile_id: sid,
            pdf_b64: job.data.fileKey,
          }, 120_000);
          break;
        case "LINKEDIN":
          result = await callAI("/ingest/linkedin", {
            student_profile_id: sid,
            linkedin_url: (job.data as { linkedinUrl?: string }).linkedinUrl,
          }, 60_000);
          break;
        default:
          throw new Error(`Unknown ingestion type: ${(job.data as Record<string, unknown>).type}`);
      }

      // Atomic counter → trigger analysis when all ingestion jobs for this user are done
      try {
        const key = `pending_ingestion:${sid}`;
        // Only decr if key exists — avoids creating a negative counter if key already expired
        const current = await counterRedis.get(key);
        if (current !== null) {
          const remaining = await counterRedis.decr(key);
          console.log(`${label} ✓ done — ${remaining} job(s) remaining for ${sid}`);
          if (remaining <= 0) {
            await counterRedis.del(key);
            console.log(`${label} all ingestion done — queuing GAP_ANALYSIS for ${sid}`);
            await analysisQueue.add(
              "GAP_ANALYSIS",
              { type: "GAP_ANALYSIS", studentProfileId: sid },
              { ...defaultJobOpts, jobId: `gap-${sid}` },
            );
          }
        } else {
          // Counter already expired — AI service BackgroundTask will handle pipeline
          console.log(`${label} ✓ done (no counter — AI service will trigger pipeline)`);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${label} counter/queue error (non-fatal): ${msg}`);
      }

      return result;
    },
    {
      connection: makeConn("ingestion"),
      concurrency: parseInt(process.env.INGESTION_CONCURRENCY ?? "8"),
      lockDuration: 120_000,      // 2 min lock (ingestion can be slow for large GitHub repos)
      stalledInterval: 20_000,    // detect stalled jobs every 20s
      maxStalledCount: 2,         // re-queue stalled jobs up to 2 times before failing
    },
  );

  worker.on("completed", (job) =>
    console.log(`[ingestion] ✓ ${job.data.type} job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`[ingestion] ✗ ${job?.data.type} job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}): ${err.message}`));
  worker.on("stalled", (jobId) =>
    console.warn(`[ingestion] ⚠ job ${jobId} stalled — re-queuing`));
  worker.on("error", (err) =>
    console.error(`[ingestion] worker error: ${err.message}`));

  console.log(`[ingestion] worker started (concurrency=${worker.opts.concurrency}, pid=${process.pid})`);
  return worker;
}

// ─── ANALYSIS WORKER ───────────────────────────────────────────────────────

function startAnalysisWorker() {
  const analysisQueue = new Queue(QUEUES.ANALYSIS, {
    connection: makeConn("analysis-chain-queue"),
    defaultJobOptions: defaultJobOpts,
  });
  const jobsQueue = new Queue(QUEUES.JOBS, {
    connection: makeConn("analysis→jobs-queue"),
    defaultJobOptions: defaultJobOpts,
  });

  const worker = new Worker<AnalysisJob>(
    QUEUES.ANALYSIS,
    async (job) => {
      const sid = job.data.studentProfileId;
      console.log(`[analysis:${job.data.type}:${job.id}] start sid=${sid}`);

      switch (job.data.type) {
        case "GAP_ANALYSIS":
          return callAI("/analyze/gap", { student_profile_id: sid }, 180_000);
        case "ROADMAP":
          return callAI("/analyze/roadmap", { student_profile_id: sid }, 180_000);
        default:
          throw new Error(`Unknown analysis type: ${(job.data as Record<string, unknown>).type}`);
      }
    },
    {
      connection: makeConn("analysis"),
      concurrency: parseInt(process.env.ANALYSIS_CONCURRENCY ?? "3"),
      lockDuration: 300_000,      // 5 min lock — LLM chains can take a while
      stalledInterval: 30_000,
      maxStalledCount: 1,         // stalled analysis jobs fail fast (expensive to retry blindly)
    },
  );

  // Chain: GAP_ANALYSIS → ROADMAP → FETCH_JOBS
  worker.on("completed", async (job) => {
    const sid = job.data.studentProfileId;
    console.log(`[analysis] ✓ ${job.data.type} job ${job.id} completed for ${sid}`);

    if (job.data.type === "GAP_ANALYSIS") {
      await analysisQueue.add(
        "ROADMAP",
        { type: "ROADMAP", studentProfileId: sid },
        defaultJobOpts,
      );
    } else if (job.data.type === "ROADMAP") {
      await jobsQueue.add(
        "FETCH_JOBS",
        { type: "FETCH_JOBS", studentProfileId: sid },
        defaultJobOpts,
      );
    }
  });

  worker.on("failed", (job, err) =>
    console.error(`[analysis] ✗ ${job?.data.type} job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}): ${err.message}`));
  worker.on("stalled", (jobId) =>
    console.warn(`[analysis] ⚠ job ${jobId} stalled`));
  worker.on("error", (err) =>
    console.error(`[analysis] worker error: ${err.message}`));

  console.log(`[analysis] worker started (concurrency=${worker.opts.concurrency}, pid=${process.pid})`);
  return worker;
}

// ─── JOBS WORKER ───────────────────────────────────────────────────────────

function startJobsWorker() {
  const worker = new Worker<JobsJob>(
    QUEUES.JOBS,
    async (job) => {
      const sid = job.data.studentProfileId;
      console.log(`[jobs:${job.data.type}:${job.id}] start sid=${sid}`);

      switch (job.data.type) {
        case "FETCH_JOBS":
          return callAI("/jobs/fetch", { student_profile_id: sid }, 120_000);
        case "MATCH_SCORE":
          return callAI("/jobs/match", {
            student_profile_id: sid,
            job_ids: job.data.jobIds,
          }, 60_000);
        default:
          throw new Error(`Unknown jobs type: ${(job.data as Record<string, unknown>).type}`);
      }
    },
    {
      connection: makeConn("jobs"),
      concurrency: parseInt(process.env.JOBS_CONCURRENCY ?? "4"),
      lockDuration: 120_000,
      stalledInterval: 20_000,
      maxStalledCount: 2,
    },
  );

  worker.on("completed", (job) =>
    console.log(`[jobs] ✓ ${job.data.type} job ${job.id} completed`));
  worker.on("failed", (job, err) =>
    console.error(`[jobs] ✗ ${job?.data.type} job ${job?.id} failed (attempt ${job?.attemptsMade}/${job?.opts.attempts}): ${err.message}`));
  worker.on("stalled", (jobId) =>
    console.warn(`[jobs] ⚠ job ${jobId} stalled`));
  worker.on("error", (err) =>
    console.error(`[jobs] worker error: ${err.message}`));

  console.log(`[jobs] worker started (concurrency=${worker.opts.concurrency}, pid=${process.pid})`);
  return worker;
}

// ─── STARTUP ───────────────────────────────────────────────────────────────

const workers: Worker[] = [];

if (WORKER_TYPE === "ingestion" || WORKER_TYPE === "all") {
  workers.push(startIngestionWorker() as Worker);
}
if (WORKER_TYPE === "analysis" || WORKER_TYPE === "all") {
  workers.push(startAnalysisWorker() as Worker);
}
if (WORKER_TYPE === "jobs" || WORKER_TYPE === "all") {
  workers.push(startJobsWorker() as Worker);
}

if (workers.length === 0) {
  console.error(`Unknown WORKER_TYPE="${WORKER_TYPE}". Valid: ingestion | analysis | jobs | all`);
  process.exit(1);
}

console.log(`\n🚀 BullMQ [${WORKER_TYPE}] workers running (pid=${process.pid})\n`);

// ─── GRACEFUL SHUTDOWN ─────────────────────────────────────────────────────

async function shutdown(signal: string) {
  console.log(`\n[worker] ${signal} received — draining in-flight jobs…`);
  await Promise.allSettled(workers.map((w) => w.close()));
  console.log("[worker] All workers closed. Goodbye.");
  process.exit(0);
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT",  () => shutdown("SIGINT"));
process.on("uncaughtException", (err) => {
  console.error("[worker] uncaughtException:", err);
  // Don't exit — let the worker recover
});
process.on("unhandledRejection", (reason) => {
  console.error("[worker] unhandledRejection:", reason);
});

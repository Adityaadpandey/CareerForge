/**
 * PM2 Ecosystem — CareerForge BullMQ Workers
 *
 * Usage:
 *   pm2 start pm2.config.cjs          # start all workers
 *   pm2 reload pm2.config.cjs         # zero-downtime reload
 *   pm2 stop all                       # stop all
 *   pm2 logs                           # tail all logs
 *   pm2 monit                          # live dashboard
 *
 * Install pm2 globally once: npm i -g pm2
 */

/** @type {import('pm2').StartOptions[]} */
const apps = [
  // ── Ingestion workers (2 instances) ─────────────────────────────────────
  // Each instance handles up to 8 concurrent jobs, so 2× = 16 parallel ingestion calls.
  // Ingestion is purely I/O bound (GitHub API, LeetCode scraping, OpenAI) so
  // more instances = near-linear throughput improvement.
  {
    name: "cf-ingestion",
    script: "src/lib/worker.ts",
    interpreter: "node",
    interpreter_args: "--import tsx/esm",
    instances: 2,
    exec_mode: "fork",            // fork mode: each instance is an independent process
    env: {
      WORKER_TYPE: "ingestion",
      INGESTION_CONCURRENCY: "8",
      NODE_ENV: "production",
    },
    env_development: {
      WORKER_TYPE: "ingestion",
      INGESTION_CONCURRENCY: "5",
      NODE_ENV: "development",
    },
    max_memory_restart: "300M",
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: "logs/ingestion-out.log",
    error_file: "logs/ingestion-err.log",
    merge_logs: true,
  },

  // ── Analysis worker (1 instance) ────────────────────────────────────────
  // LLM chains (gap analysis → roadmap) are long-running; 3 concurrent is
  // limited by the AI service's own throughput, not our worker count.
  {
    name: "cf-analysis",
    script: "src/lib/worker.ts",
    interpreter: "node",
    interpreter_args: "--import tsx/esm",
    instances: 1,
    exec_mode: "fork",
    env: {
      WORKER_TYPE: "analysis",
      ANALYSIS_CONCURRENCY: "3",
      NODE_ENV: "production",
    },
    env_development: {
      WORKER_TYPE: "analysis",
      ANALYSIS_CONCURRENCY: "2",
      NODE_ENV: "development",
    },
    max_memory_restart: "300M",
    restart_delay: 5000,
    exp_backoff_restart_delay: 100,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: "logs/analysis-out.log",
    error_file: "logs/analysis-err.log",
  },

  // ── Jobs worker (2 instances) ────────────────────────────────────────────
  // Job fetching and match-scoring are independent per-student; scale out.
  {
    name: "cf-jobs",
    script: "src/lib/worker.ts",
    interpreter: "node",
    interpreter_args: "--import tsx/esm",
    instances: 2,
    exec_mode: "fork",
    env: {
      WORKER_TYPE: "jobs",
      JOBS_CONCURRENCY: "4",
      NODE_ENV: "production",
    },
    env_development: {
      WORKER_TYPE: "jobs",
      JOBS_CONCURRENCY: "3",
      NODE_ENV: "development",
    },
    max_memory_restart: "200M",
    restart_delay: 3000,
    exp_backoff_restart_delay: 100,
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    out_file: "logs/jobs-out.log",
    error_file: "logs/jobs-err.log",
    merge_logs: true,
  },
];

module.exports = { apps };

# CareerForge AI — Full System Specification

> Version: 1.0.0 | Status: Active Development | Hackathon: HackAI 2025

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Environment Variables](#4-environment-variables)
5. [Database Schema (Prisma)](#5-database-schema-prisma)
6. [API Contract](#6-api-contract)
7. [Queue Architecture (BullMQ)](#7-queue-architecture-bullmq)
8. [Module Specifications](#8-module-specifications)
   - [M1: Auth & Onboarding](#m1-auth--onboarding)
   - [M2: Data Ingestion Service](#m2-data-ingestion-service)
   - [M3: Gap Analysis & Roadmap Engine](#m3-gap-analysis--roadmap-engine)
   - [M4: Mock Interview Agent](#m4-mock-interview-agent)
   - [M5: Job Pipeline](#m5-job-pipeline)
   - [M6: University Dashboard](#m6-university-dashboard)
9. [LLM Strategy](#9-llm-strategy)
10. [Frontend Pages & Components](#10-frontend-pages--components)
11. [Data Flow Diagrams](#11-data-flow-diagrams)
12. [Error Handling Strategy](#12-error-handling-strategy)
13. [Build Order & Task Breakdown](#13-build-order--task-breakdown)
14. [Deployment](#14-deployment)

---

## 1. Project Overview

CareerForge AI is an agentic career intelligence platform for college students and
Training & Placement Cells (TPCs). It ingests a student's digital footprint (GitHub,
LeetCode, resume), identifies gaps against real job requirements, generates a
mission-based adaptive roadmap, conducts AI mock interviews with sentiment scoring,
and autonomously matches + applies to jobs on the student's behalf.

### Core Personas

| Persona                 | Goal                            | Pain Point                        |
| ----------------------- | ------------------------------- | --------------------------------- |
| Student (Arjun)         | Get placed at a product company | No direction, prep is scattered   |
| TPC Coordinator (Priya) | 80%+ placement rate             | Zero visibility into 300 students |

### The 5 Autonomous Agent Loops

These are what make this "agentic" — each fires without the user prompting it:

| Loop                | Trigger                              | Action                                          |
| ------------------- | ------------------------------------ | ----------------------------------------------- |
| Profile Sync        | New commit / solve detected          | Recompute readiness score, reprioritize roadmap |
| Milestone Interview | Mission marked complete              | Offer mock interview on that exact topic        |
| Job Match Alert     | Readiness crosses 70% for saved role | Draft CV + cover letter, notify student         |
| Risk Detection      | 5-day inactivity OR score drops 10pt | Nudge student + flag TPC                        |
| Roadmap Adaptation  | Behind on 2+ consecutive missions    | Trim scope, adjust deadlines, notify            |

---

## 2. Tech Stack

### Frontend

| Layer         | Technology                   | Version | Reason                                         |
| ------------- | ---------------------------- | ------- | ---------------------------------------------- |
| Framework     | Next.js                      | 15.x    | App router, server components, API routes      |
| Language      | TypeScript                   | 5.x     | Type safety across frontend                    |
| UI Components | shadcn/ui                    | latest  | Accessible, Tailwind-based, copy-paste         |
| Styling       | Tailwind CSS                 | 4.x     | Utility-first, fast to build                   |
| Charts        | Recharts                     | 2.x     | Dashboard visualizations                       |
| Roadmap Viz   | React Flow (@xyflow/react)   | 12.x    | Interactive mission graph                      |
| State         | Zustand                      | 4.x     | Lightweight global state                       |
| Data Fetching | TanStack Query (react-query) | 5.x     | Server state, caching, loading states          |
| HTTP Client   | Axios                        | 1.x     | API calls to Next.js routes and Python service |
| Forms         | React Hook Form + Zod        | latest  | Validated forms with TypeScript inference      |
| Animations    | Framer Motion                | 11.x    | Page transitions, micro-interactions           |
| PDF Preview   | @react-pdf/renderer          | 3.x     | Generated CV preview                           |
| Auth          | NextAuth.js v5 (Auth.js)     | 5.x     | GitHub OAuth + credentials                     |

### Backend (Python AI Service)

| Layer                   | Technology                     | Version | Reason                                      |
| ----------------------- | ------------------------------ | ------- | ------------------------------------------- |
| Framework               | FastAPI                        | 0.115.x | Async, fast, auto OpenAPI docs              |
| Language                | Python                         | 3.12    | AI ecosystem is Python-native               |
| Agent Framework         | LangGraph                      | 0.2.x   | Stateful multi-step agent loops             |
| LLM — General           | OpenAI GPT-4o                  | latest  | Gap analysis, roadmap, CV generation        |
| LLM — Realtime/Research | Google Gemini 2.0 Flash        | latest  | Interview probing, job research, fast tasks |
| Embeddings              | OpenAI text-embedding-3-small  | latest  | Job matching, semantic similarity           |
| PDF Parsing             | pdfplumber                     | 0.11.x  | Resume text extraction                      |
| GitHub                  | PyGithub                       | 2.x     | GitHub API wrapper                          |
| HTTP                    | httpx                          | 0.27.x  | Async HTTP for external APIs                |
| Task Runner             | Celery (for Python-side crons) | 5.x     | Nightly segmentation, sync jobs             |
| Validation              | Pydantic v2                    | 2.x     | Request/response models                     |
| DB Access               | asyncpg + SQLAlchemy 2.0       | latest  | Async Postgres from Python                  |

### Infrastructure

| Layer           | Technology      | Reason                                          |
| --------------- | --------------- | ----------------------------------------------- |
| Primary DB      | PostgreSQL 16   | Relational, handles complex queries             |
| ORM             | Prisma          | Type-safe schema, migrations, used from Next.js |
| Cache / Broker  | Redis 7         | Session cache, BullMQ broker, rate limiting     |
| Queue           | BullMQ          | Job queues for async ingestion + agent tasks    |
| Deployment (FE) | Vercel          | Zero-config Next.js deploy                      |
| Deployment (AI) | Railway         | Docker container, free tier                     |
| DB Host         | Neon (Postgres) | Serverless Postgres, free tier                  |
| Redis Host      | Upstash         | Serverless Redis, BullMQ compatible             |

---

## 3. Repository Structure

```
careerforge/
│
├── apps/
│   ├── web/                          # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/                  # App router pages
│   │   │   │   ├── (auth)/
│   │   │   │   │   ├── login/
│   │   │   │   │   └── onboarding/
│   │   │   │   ├── dashboard/        # Student dashboard
│   │   │   │   ├── roadmap/          # Mission roadmap
│   │   │   │   ├── interview/        # Mock interview chat
│   │   │   │   ├── jobs/             # Job listings + apply
│   │   │   │   ├── profile/          # Student profile + connections
│   │   │   │   └── admin/            # TPC university dashboard
│   │   │   │       ├── dashboard/
│   │   │   │       ├── students/
│   │   │   │       └── interventions/
│   │   │   ├── components/
│   │   │   │   ├── ui/               # shadcn components (auto-generated)
│   │   │   │   ├── shared/           # Navbar, Sidebar, Layout
│   │   │   │   ├── dashboard/        # ReadinessCard, ScorePillar, StreakTracker
│   │   │   │   ├── roadmap/          # MissionNode, RoadmapFlow, MissionCard
│   │   │   │   ├── interview/        # ChatBubble, DebriefCard, SentimentMeter
│   │   │   │   ├── jobs/             # JobCard, MatchBadge, ApplyModal
│   │   │   │   └── admin/            # SegmentTable, BatchHeatmap, RiskFlag
│   │   │   ├── lib/
│   │   │   │   ├── auth.ts           # NextAuth config
│   │   │   │   ├── prisma.ts         # Prisma client singleton
│   │   │   │   ├── redis.ts          # Redis client (ioredis)
│   │   │   │   ├── queue.ts          # BullMQ producer helpers
│   │   │   │   ├── ai-client.ts      # Axios instance for Python service
│   │   │   │   └── utils.ts
│   │   │   ├── hooks/                # useReadiness, useJobs, useMissions
│   │   │   ├── store/                # Zustand stores
│   │   │   └── types/                # Shared TypeScript types
│   │   ├── prisma/
│   │   │   └── schema.prisma         # Single source of truth for DB schema
│   │   ├── .env.local
│   │   └── package.json
│   │
│   └── ai-service/                   # Python FastAPI service
│       ├── app/
│       │   ├── main.py               # FastAPI app entry
│       │   ├── api/
│       │   │   ├── ingest.py         # /ingest/* endpoints
│       │   │   ├── analyze.py        # /analyze/* endpoints
│       │   │   ├── interview.py      # /interview/* endpoints
│       │   │   └── jobs.py           # /jobs/* endpoints
│       │   ├── agents/
│       │   │   ├── gap_analyzer.py   # LangGraph: profile → gap analysis
│       │   │   ├── roadmap_agent.py  # LangGraph: gaps → missions
│       │   │   ├── interview_agent.py# LangGraph: interview state machine
│       │   │   └── apply_agent.py    # ApplyPilot-based job pipeline
│       │   ├── ingestion/
│       │   │   ├── github.py         # PyGithub ingestion
│       │   │   ├── leetcode.py       # LeetCode GraphQL ingestion
│       │   │   └── resume.py         # pdfplumber + GPT parse
│       │   ├── models/               # Pydantic request/response models
│       │   ├── db/
│       │   │   └── client.py         # asyncpg connection pool
│       │   ├── workers/              # Celery tasks (nightly crons)
│       │   │   ├── sync_worker.py    # Profile re-sync
│       │   │   └── segment_worker.py # Nightly TPC segmentation
│       │   └── config.py             # Settings via pydantic-settings
│       ├── .env
│       ├── requirements.txt
│       └── Dockerfile
│
├── docker-compose.yml                # Local dev: postgres + redis
└── README.md
```

---

## 4. Environment Variables

### `apps/web/.env.local`

```env
# Database
DATABASE_URL="postgresql://user:pass@neon-host/careerforge?sslmode=require"

# Auth (NextAuth v5)
AUTH_SECRET="generate-with-openssl-rand-base64-32"
AUTH_GITHUB_ID="your-github-oauth-app-id"
AUTH_GITHUB_SECRET="your-github-oauth-app-secret"

# Redis (Upstash — for BullMQ)
REDIS_URL="rediss://default:token@upstash-host:6379"

# Python AI Service
AI_SERVICE_URL="http://localhost:8000"
AI_SERVICE_SECRET="shared-internal-secret-for-auth"

# Public (exposed to browser)
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### `apps/ai-service/.env`

```env
# Database (same Postgres, direct connection)
DATABASE_URL="postgresql+asyncpg://user:pass@neon-host/careerforge"

# Redis
REDIS_URL="rediss://default:token@upstash-host:6379"

# LLM Keys
OPENAI_API_KEY="sk-..."
GOOGLE_API_KEY="AIza..."

# External APIs
GITHUB_TOKEN="ghp_..."         # Personal access token for GitHub API (higher rate limits)
JSEARCH_API_KEY="rapidapi-key" # Job search via RapidAPI

# Security
INTERNAL_SECRET="same-as-AI_SERVICE_SECRET-above"

# App
ENVIRONMENT="development"
LOG_LEVEL="INFO"
```

---

## 5. Database Schema (Prisma)

File: `apps/web/prisma/schema.prisma`

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─── AUTH ────────────────────────────────────────────────────

model User {
  id            String    @id @default(cuid())
  email         String    @unique
  name          String?
  image         String?
  role          UserRole  @default(STUDENT)
  createdAt     DateTime  @default(now())
  updatedAt     DateTime  @updatedAt

  accounts      Account[]
  sessions      Session[]
  profile       StudentProfile?
  adminProfile  AdminProfile?
}

model Account {
  id                String  @id @default(cuid())
  userId            String
  type              String
  provider          String
  providerAccountId String
  access_token      String? @db.Text
  refresh_token     String? @db.Text
  expires_at        Int?

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([provider, providerAccountId])
}

model Session {
  id           String   @id @default(cuid())
  sessionToken String   @unique
  userId       String
  expires      DateTime

  user User @relation(fields: [userId], references: [id], onDelete: Cascade)
}

enum UserRole {
  STUDENT
  ADMIN        // TPC coordinator
  SUPER_ADMIN
}

// ─── STUDENT PROFILE ─────────────────────────────────────────

model StudentProfile {
  id                String    @id @default(cuid())
  userId            String    @unique
  universityId      String?
  department        String?
  graduationYear    Int?
  githubUsername    String?
  leetcodeHandle    String?
  codeforcesHandle  String?
  linkedinUrl       String?
  targetRole        String?   // "SDE", "Data Engineer", "PM", etc.
  dreamCompanies    String[]  // ["Google", "Zepto", "Stripe"]
  timelineWeeks     Int?      // weeks until placement
  hoursPerWeek      Int?
  segment           Segment   @default(UNASSESSED)
  streakDays        Int       @default(0)
  lastActiveAt      DateTime?
  onboardingDone    Boolean   @default(false)
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  user                User                  @relation(fields: [userId], references: [id])
  university          University?           @relation(fields: [universityId], references: [id])
  platformConnections PlatformConnection[]
  readinessScores     ReadinessScore[]
  missions            Mission[]
  interviewSessions   InterviewSession[]
  applications        Application[]
  savedJobs           SavedJob[]
}

enum Segment {
  UNASSESSED
  RISING_STAR    // Top 20%, consistent, trending up
  CAPABLE        // Good scores, low activity
  AT_RISK        // Score 40-60 or 7-day inactivity
  CRITICAL       // Score < 40 or 14-day inactivity
}

// ─── READINESS SCORE ─────────────────────────────────────────

model ReadinessScore {
  id               String         @id @default(cuid())
  studentProfileId String
  totalScore       Float          // 0-100
  dsaScore         Float          // 0-100
  devScore         Float          // 0-100
  commScore        Float          // 0-100
  consistencyScore Float          // 0-100
  weakTopics       String[]       // ["graphs", "dp", "system-design"]
  gapAnalysis      Json           // { missing: [{skill, importance}], strong: [...] }
  createdAt        DateTime       @default(now())

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id])
}

// ─── PLATFORM CONNECTIONS ────────────────────────────────────

model PlatformConnection {
  id               String    @id @default(cuid())
  studentProfileId String
  platform         Platform
  lastSyncedAt     DateTime?
  syncStatus       SyncStatus @default(PENDING)
  rawData          Json?      // Full API response stored here
  parsedData       Json?      // Cleaned, normalized data
  errorMessage     String?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id])

  @@unique([studentProfileId, platform])
}

enum Platform {
  GITHUB
  LEETCODE
  CODEFORCES
  LINKEDIN
  RESUME
}

enum SyncStatus {
  PENDING
  SYNCING
  DONE
  FAILED
}

// ─── MISSIONS (ROADMAP) ──────────────────────────────────────

model Mission {
  id               String        @id @default(cuid())
  studentProfileId String
  type             MissionType
  title            String
  description      String        @db.Text
  status           MissionStatus @default(LOCKED)
  resources        Json          // [{ title, url, type: "blog"|"course"|"paper"|"repo" }]
  estimatedHours   Int
  deadline         DateTime?
  orderIndex       Int
  completedAt      DateTime?
  prerequisiteIds  String[]      // IDs of missions that must be done first

  studentProfile StudentProfile   @relation(fields: [studentProfileId], references: [id])
  interviews     InterviewSession[]
}

enum MissionType {
  BUILD        // Build a project
  SOLVE        // Solve DSA problems
  COMMUNICATE  // Write blog, create writeup, do mock
}

enum MissionStatus {
  LOCKED       // Prerequisites not met
  AVAILABLE    // Ready to start
  IN_PROGRESS
  COMPLETED
  SKIPPED
}

// ─── INTERVIEW SESSIONS ──────────────────────────────────────

model InterviewSession {
  id               String          @id @default(cuid())
  studentProfileId String
  missionId        String?
  interviewType    InterviewType
  status           InterviewStatus @default(IN_PROGRESS)
  transcript       Json            // [{ role: "ai"|"student", content, timestamp }]
  debrief          Json?           // { strongZones[], weakZones[], keyPhrase, insight, scores }
  sentimentScores  Json?           // { confidence[], nervousness[], timestamps[] }
  overallScore     Float?          // 0-100
  createdAt        DateTime        @default(now())
  completedAt      DateTime?

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id])
  mission        Mission?       @relation(fields: [missionId], references: [id])
}

enum InterviewType {
  TECHNICAL
  SYSTEM_DESIGN
  BEHAVIORAL
  MIXED
}

enum InterviewStatus {
  IN_PROGRESS
  COMPLETED
  ABANDONED
}

// ─── JOBS & APPLICATIONS ─────────────────────────────────────

model Job {
  id               String    @id @default(cuid())
  externalId       String?   // ID from source platform
  title            String
  company          String
  location         String?
  isRemote         Boolean   @default(false)
  source           JobSource
  requirementsText String    @db.Text
  requirementsTags String[]  // extracted: ["Python", "FastAPI", "System Design"]
  applyUrl         String
  salaryMin        Int?
  salaryMax        Int?
  postedAt         DateTime?
  deadline         DateTime?
  scrapedAt        DateTime  @default(now())

  applications Application[]
  savedBy      SavedJob[]
}

enum JobSource {
  LINKEDIN
  WELLFOUND
  NAUKRI
  INTERNSHALA
  JSEARCH
  DIRECT
}

model Application {
  id               String            @id @default(cuid())
  studentProfileId String
  jobId            String
  matchScore       Float             // 0-100 from embedding similarity
  status           ApplicationStatus @default(DRAFT)
  cvGenerated      String?           @db.Text  // generated CV markdown
  coverLetter      String?           @db.Text  // generated cover letter
  appliedAt        DateTime?
  responseAt       DateTime?
  notes            String?
  createdAt        DateTime          @default(now())

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id])
  job            Job            @relation(fields: [jobId], references: [id])

  @@unique([studentProfileId, jobId])
}

enum ApplicationStatus {
  DRAFT         // CV/cover letter generated, not yet sent
  APPLIED       // Submitted
  VIEWED        // Company opened application
  INTERVIEWING
  OFFERED
  REJECTED
  WITHDRAWN
}

model SavedJob {
  id               String   @id @default(cuid())
  studentProfileId String
  jobId            String
  savedAt          DateTime @default(now())

  studentProfile StudentProfile @relation(fields: [studentProfileId], references: [id])
  job            Job            @relation(fields: [jobId], references: [id])

  @@unique([studentProfileId, jobId])
}

// ─── UNIVERSITY / TPC ────────────────────────────────────────

model University {
  id          String   @id @default(cuid())
  name        String
  domain      String?  // email domain for auto-association
  city        String?
  plan        Plan     @default(FREE)
  createdAt   DateTime @default(now())

  students AdminProfile[]
  profiles StudentProfile[]
  drives   CompanyDrive[]
}

model AdminProfile {
  id           String   @id @default(cuid())
  userId       String   @unique
  universityId String

  user       User       @relation(fields: [userId], references: [id])
  university University @relation(fields: [universityId], references: [id])
}

model CompanyDrive {
  id           String   @id @default(cuid())
  universityId String
  companyName  String
  roles        String[]
  driveDate    DateTime
  eligibility  Json     // { minCgpa, branches[], backlogAllowed }
  createdAt    DateTime @default(now())

  university University @relation(fields: [universityId], references: [id])
}

enum Plan {
  FREE
  STARTER
  ENTERPRISE
}

// ─── NOTIFICATIONS ───────────────────────────────────────────

model Notification {
  id        String           @id @default(cuid())
  userId    String
  type      NotificationType
  title     String
  body      String
  read      Boolean          @default(false)
  actionUrl String?
  createdAt DateTime         @default(now())
}

enum NotificationType {
  MISSION_AVAILABLE
  INTERVIEW_READY
  JOB_MATCH
  RISK_FLAG
  STREAK_BROKEN
  ROADMAP_UPDATED
  OFFER_RECEIVED
}
```

---

## 6. API Contract

All routes between Next.js and Python FastAPI. Next.js also has its own API routes
(`/api/*`) that the browser calls — those call Python internally.

### Next.js API Routes (`/api/...`)

These are the routes your React components call via Axios/react-query.

```
POST   /api/auth/[...nextauth]      # NextAuth handler (built-in)

# Onboarding
POST   /api/onboarding/connect      # Save platform usernames, queue ingestion
GET    /api/onboarding/status       # Check ingestion job status

# Profile
GET    /api/profile                 # Current student profile + latest readiness score
PATCH  /api/profile                 # Update target role, dream companies, etc.

# Readiness
GET    /api/readiness               # Latest score + history
GET    /api/readiness/breakdown     # Per-pillar breakdown with explanations

# Missions
GET    /api/missions                # All missions with status
PATCH  /api/missions/:id/status     # Update status (IN_PROGRESS, COMPLETED)
POST   /api/missions/:id/complete   # Mark complete → triggers interview offer

# Interviews
POST   /api/interviews              # Start new interview session { missionId?, type }
GET    /api/interviews/:id          # Get session (transcript + status)
POST   /api/interviews/:id/message  # Send student message, get AI response
POST   /api/interviews/:id/end      # End session → trigger debrief generation
GET    /api/interviews/:id/debrief  # Get completed debrief
GET    /api/interviews              # List all past interviews

# Jobs
GET    /api/jobs                    # Paginated job listing with match scores
GET    /api/jobs/:id                # Single job details
POST   /api/jobs/:id/save           # Save/unsave job
POST   /api/jobs/:id/apply          # Generate CV + cover letter, queue apply
GET    /api/applications            # Student's application history

# Admin (TPC)
GET    /api/admin/batch             # Aggregate batch stats
GET    /api/admin/students          # Paginated student list with segments
GET    /api/admin/students/:id      # Individual student details
POST   /api/admin/students/:id/flag # Manually flag student for intervention
GET    /api/admin/drives            # Company drive calendar
POST   /api/admin/drives            # Create new drive
GET    /api/admin/drives/:id/eligible # Students eligible for this drive

# Notifications
GET    /api/notifications           # Unread notifications
PATCH  /api/notifications/:id/read  # Mark as read
```

### Python FastAPI Routes (`http://ai-service:8000/...`)

Called only from Next.js API routes (server-to-server), never directly from the browser.
All requests include `X-Internal-Secret: {INTERNAL_SECRET}` header.

```
# Ingestion
POST   /ingest/github               # { github_username, student_profile_id }
POST   /ingest/leetcode             # { leetcode_handle, student_profile_id }
POST   /ingest/resume               # multipart/form-data: file + student_profile_id

# Analysis
POST   /analyze/gap                 # { student_profile_id } → gap analysis + score
POST   /analyze/roadmap             # { student_profile_id } → generate/update missions
POST   /analyze/segment             # { university_id } → recompute all student segments

# Interview
POST   /interview/start             # { student_profile_id, mission_id?, type }
POST   /interview/message           # { session_id, message } → AI response
POST   /interview/end               # { session_id } → debrief generation
POST   /interview/sentiment         # { session_id, frame_b64 } → sentiment score

# Jobs
POST   /jobs/fetch                  # { student_profile_id } → scrape + score + store
POST   /jobs/apply                  # { student_profile_id, job_id } → generate CV + apply
```

---

## 7. Queue Architecture (BullMQ)

BullMQ runs on Redis (Upstash). Producers live in Next.js (`lib/queue.ts`).
Workers run in Next.js API routes (for simple tasks) or Python Celery (for AI-heavy tasks).

### Queues

```typescript
// lib/queue.ts — Queue names as constants
export const QUEUES = {
  INGESTION: "ingestion", // Profile sync jobs
  ANALYSIS: "analysis", // Gap analysis + roadmap rebuild
  INTERVIEW: "interview", // Debrief generation
  JOBS: "jobs", // Job scraping + matching
  APPLY: "apply", // CV generation + application submission
  NOTIFY: "notify", // Push notifications
  SEGMENT: "segment", // Nightly TPC segmentation
} as const;
```

### Job Definitions

```typescript
// ingestion queue
type IngestionJob =
  | { type: "GITHUB"; studentProfileId: string; username: string }
  | { type: "LEETCODE"; studentProfileId: string; handle: string }
  | { type: "RESUME"; studentProfileId: string; fileKey: string };

// analysis queue (enqueued after ingestion completes)
type AnalysisJob =
  | { type: "GAP_ANALYSIS"; studentProfileId: string }
  | { type: "ROADMAP"; studentProfileId: string };

// jobs queue
type JobsJob =
  | { type: "FETCH_JOBS"; studentProfileId: string }
  | { type: "MATCH_SCORE"; studentProfileId: string; jobIds: string[] };

// apply queue
type ApplyJob = {
  studentProfileId: string;
  jobId: string;
  autoSubmit: boolean; // false = generate only; true = also submit
};

// notify queue
type NotifyJob = {
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  actionUrl?: string;
};

// segment queue (cron, nightly at 2am)
type SegmentJob = {
  universityId: string;
};
```

### Worker Implementation Pattern

```typescript
// apps/web/src/workers/ingestion.worker.ts
import { Worker } from "bullmq";
import { redis } from "@/lib/redis";
import { aiClient } from "@/lib/ai-client";

const worker = new Worker<IngestionJob>(
  QUEUES.INGESTION,
  async (job) => {
    const { type, studentProfileId } = job.data;

    // Call Python FastAPI
    await aiClient.post(`/ingest/${type.toLowerCase()}`, {
      student_profile_id: studentProfileId,
      ...job.data,
    });

    // Chain: after ingestion → trigger analysis
    await analysisQueue.add("gap-analysis", {
      type: "GAP_ANALYSIS",
      studentProfileId,
    });
  },
  { connection: redis },
);
```

### Cron Jobs (BullMQ Scheduler)

```typescript
// Runs nightly at 2am — recompute all segments per university
scheduler.upsertJobScheduler(
  "nightly-segmentation",
  {
    pattern: "0 2 * * *",
  },
  {
    name: "segment-all",
    data: { universityId: "all" },
  },
);

// Runs every 6 hours — check for inactive students
scheduler.upsertJobScheduler(
  "risk-detection",
  {
    pattern: "0 */6 * * *",
  },
  {
    name: "risk-check",
    data: {},
  },
);

// Runs every 4 hours — fresh job scraping
scheduler.upsertJobScheduler(
  "job-scrape",
  {
    pattern: "0 */4 * * *",
  },
  {
    name: "fetch-jobs",
    data: {},
  },
);
```

---

## 8. Module Specifications

---

### M1: Auth & Onboarding

**Stack:** NextAuth.js v5, Prisma, Next.js App Router

**Auth Flow:**

1. Student clicks "Sign in with GitHub" → NextAuth GitHub OAuth
2. On first login: `onboardingDone = false` → redirect to `/onboarding`
3. Onboarding collects: LeetCode handle, target role, dream companies, timeline
4. On submit: create `StudentProfile`, enqueue ingestion jobs for GitHub + LeetCode
5. Set `onboardingDone = true` → redirect to `/dashboard`

**Key Files:**

- `src/lib/auth.ts` — NextAuth config with GitHub provider + Prisma adapter
- `src/app/(auth)/onboarding/page.tsx` — Multi-step onboarding form
- `src/app/api/onboarding/connect/route.ts` — Saves profile, dispatches BullMQ jobs

**Onboarding Steps (UI):**

```
Step 1: Connect GitHub (OAuth already done — just confirm username)
Step 2: Enter LeetCode handle + Codeforces handle (optional)
Step 3: Upload resume PDF
Step 4: Target role + dream companies (multi-select)
Step 5: Timeline + hours/week available
```

---

### M2: Data Ingestion Service

**Stack:** Python FastAPI, PyGithub, httpx, pdfplumber, OpenAI

**GitHub Ingestion** (`ingestion/github.py`):

```python
# Metrics to extract:
- total_repos, public_repos
- primary_languages: dict[str, int]  # { "Python": 45, "TypeScript": 30 }
- commit_count_90d: int
- longest_streak_days: int
- avg_repo_stars: float
- has_readme_ratio: float            # % of repos with README
- top_projects: list[dict]           # [{ name, description, stars, languages }]
- contribution_graph: list[int]      # daily commit counts last 90 days
```

**LeetCode Ingestion** (`ingestion/leetcode.py`):

```python
# LeetCode GraphQL endpoint: https://leetcode.com/graphql
# Query: userProfile + userContestRanking + recentSubmissions

# Metrics:
- total_solved: int
- easy_solved, medium_solved, hard_solved: int
- acceptance_rate: float
- contest_rating: int | None
- streak_days: int
- weak_topics: list[str]  # topics with < 30% acceptance in recent submissions
```

**Resume Ingestion** (`ingestion/resume.py`):

```python
# 1. pdfplumber extracts raw text
# 2. GPT-4o parses into structured JSON:
{
  "skills": ["Python", "FastAPI", "PostgreSQL"],
  "experience_years": 0,
  "projects": [{ "name": "...", "tech": [...], "description": "..." }],
  "education": { "degree": "B.Tech CSE", "cgpa": 8.2 },
  "certifications": [...],
  "ats_score": 72  # scored against generic SDE JD
}
```

**Output:** All data written to `PlatformConnection.rawData` and `parsedData` in Postgres.
Status updates written so frontend can poll `/api/onboarding/status`.

---

### M3: Gap Analysis & Roadmap Engine

**Stack:** LangGraph, OpenAI GPT-4o, text-embedding-3-small, Python

**LangGraph Graph: `GapAnalyzerGraph`**

```
Nodes:
  load_profile       → reads all parsedData from platform_connections
  extract_skills     → normalizes skills from all sources into unified list
  fetch_jd_embeddings → gets target role JDs from Postgres jobs table (or seeds)
  compute_similarity → cosine similarity: student_embedding vs jd_requirement_embeddings
  score_pillars      → calculates dsa/dev/comm/consistency scores (0-100 each)
  identify_gaps      → returns top 10 missing skills ordered by importance
  write_scores       → inserts new ReadinessScore row

Edges:
  load_profile → extract_skills → fetch_jd_embeddings → compute_similarity
               → score_pillars → identify_gaps → write_scores
```

**Scoring Logic:**

```python
# DSA Score (30% weight)
dsa_score = (
    (medium_solved / 100) * 40 +    # 100 mediums = 40 pts
    (hard_solved / 50) * 30 +        # 50 hards = 30 pts
    (streak_consistency * 20) +       # activity consistency
    (contest_rating_normalized * 10)  # contest bonus
)

# Dev Score (30% weight)
dev_score = (
    project_quality_score * 40 +     # GPT-evaluated project complexity
    language_breadth_score * 20 +    # breadth of tech stack
    github_activity_score * 20 +     # commit regularity
    profile_match_to_jd * 20         # cosine sim of skills vs JD
)

# Communication Score (20% weight)
comm_score = (
    resume_ats_score * 50 +
    linkedin_completeness * 30 +
    has_blog_or_writeups * 20
)

# Consistency Score (20% weight)
consistency_score = (
    platform_activity_score * 60 +  # combined streak across platforms
    mission_completion_rate * 40     # if returning user
)

total = 0.30*dsa + 0.30*dev + 0.20*comm + 0.20*consistency
```

**LangGraph Graph: `RoadmapGeneratorGraph`**

```
Nodes:
  load_gaps          → reads latest ReadinessScore.gapAnalysis
  prioritize         → sorts gaps by (importance × (1 - student_current_level))
  generate_missions  → GPT-4o generates 6-8 missions from top gaps
  attach_resources   → Gemini Flash searches for 3-5 resources per mission
  set_deadlines      → distributes missions across timeline_weeks
  write_missions     → upserts Mission rows, preserves completed ones

Edges: linear chain
```

**Mission Generation Prompt (GPT-4o):**

```
You are a career coach. Given these skill gaps: {gaps}
and student context: role={target_role}, timeline={weeks}w, hours={hours}/week

Generate {n} missions. Each mission must be a DELIVERABLE (a thing they produce),
not a task to consume content.

For each mission return JSON:
{
  "type": "BUILD|SOLVE|COMMUNICATE",
  "title": "...",
  "description": "...",  // 2-3 sentences, specific
  "estimated_hours": int,
  "success_criteria": "...",  // how student knows they're done
  "order_index": int
}

Missions must be ordered: foundational gaps first, advanced last.
```

---

### M4: Mock Interview Agent

**Stack:** LangGraph, OpenAI GPT-4o (interview conductor), Gemini Flash (fast probing),
optional sentiment via ai-video-sentiment-model

**Interview State Machine (LangGraph):**

```
States:
  OPENING      → "Walk me through [mission topic]"
  TECHNICAL    → 2 generated technical questions from mission context
  PROBING      → fires if answer score < 6 on any dimension (max 1 probe per question)
  BEHAVIORAL   → 1 STAR-format question relevant to target role
  CLOSING      → "Any questions for me?"
  DEBRIEF      → generate structured debrief, write to DB

Transitions:
  OPENING → TECHNICAL (unconditional after first answer)
  TECHNICAL → PROBING (if score < 6) or BEHAVIORAL (if score ≥ 6)
  PROBING → TECHNICAL (next question) or BEHAVIORAL (if last)
  BEHAVIORAL → CLOSING
  CLOSING → DEBRIEF
```

**Answer Scoring (GPT-4o side-call, fast):**

```python
# For each student message, run this in parallel with returning response:
scores = gpt4o_mini(f"""
Score this interview answer:
Question: {question}
Answer: {student_message}

Return JSON only:
{{
  "accuracy": 0-10,   // Is it factually correct?
  "depth": 0-10,      // Does it go beyond surface?
  "clarity": 0-10,    // Is it well-structured?
  "overall": 0-10
}}
""")
```

**Debrief Format:**

```json
{
  "strong_zones": ["system design thinking", "clear explanation of trade-offs"],
  "weak_zones": ["shallow on concurrency", "no mention of failure modes"],
  "key_phrase_to_practice": "When discussing trade-offs, always say 'I chose X over Y because...'",
  "one_insight": "You code well but explain defensively — lead with confidence",
  "scores": { "accuracy": 7.2, "depth": 5.8, "clarity": 6.5, "overall": 6.5 }
}
```

**Sentiment Integration (Optional, from ai-video-sentiment-model):**

```
Frontend sends webcam frame (base64) every 5 seconds via:
  POST /api/interviews/:id/sentiment { frame_b64 }
  → forwards to FastAPI POST /interview/sentiment
  → returns { confidence: 0-1, nervousness: 0-1, timestamp }
  → stored in InterviewSession.sentimentScores array
  → rendered live as a color-coded meter in UI
```

---

### M5: Job Pipeline

**Stack:** ApplyPilot (adapted), FastAPI, OpenAI GPT-4o, text-embedding-3-small

**Phase 1 — Job Discovery (adapted from ApplyPilot):**

```python
# Sources:
# 1. JSearch API (RapidAPI) — covers LinkedIn, Indeed, Glassdoor
# 2. Wellfound scraper (Playwright) — startups
# 3. Naukri RSS feed — Indian market
# 4. Internshala scraper (requests + BS4) — internships

# For each student: query = f"{target_role} {primary_skill} {location}"
# Deduplicate by (title + company) hash
# Store all in Job table
```

**Phase 2 — Matching:**

```python
# Embed job.requirementsText → vector
# Embed student profile (skills + projects combined text) → vector
# cosine_similarity(student_vec, job_vec) → match_score (0-100)
# Apply bonus: +5 if company in dream_companies, +5 if deadline within 7d
# Threshold: only show jobs with match_score > 45
```

**Phase 3 — CV + Cover Letter Generation (GPT-4o):**

```python
# CV generation:
# 1. Take student's base parsed resume
# 2. Extract JD keywords: required skills, action verbs, domain terms
# 3. GPT-4o rewrites experience bullets to mirror JD language
# 4. Reorders skills section to lead with most-relevant
# Output: Markdown → rendered as PDF via WeasyPrint

# Cover letter:
# Inputs: company name, role, student top 3 relevant projects, JD summary
# GPT-4o writes 3-paragraph letter: hook → relevant experience → why company
# Cover letter is specific — references something real about the company
```

**Phase 4 — Application:**

```python
# V1 (hackathon): Human-in-the-loop
#   → Generate CV + cover letter → store in Application.cvGenerated
#   → Student reviews in UI → clicks "Submit Application"
#   → Frontend opens job applyUrl in new tab, tracks as APPLIED

# V2 (post-hackathon): ApplyPilot's full auto-submit via Playwright
```

---

### M6: University Dashboard

**Stack:** Next.js, Recharts, shadcn/ui, Prisma

**Page: `/admin/dashboard`**

```
Components:
- BatchReadinessGauge     → avg readiness score, delta from last week
- ScoreDistributionChart  → histogram of readiness across batch (Recharts)
- SkillHeatmap            → table: skill × frequency_weak (top 10 weak skills)
- PlacementFunnel         → stages: registered → active → applied → interviewing → offered
- SegmentBreakdown        → donut chart: Rising/Capable/At-Risk/Critical counts
- UpcomingDrives          → next 3 company drives + eligible student count each
```

**Page: `/admin/students`**

```
Components:
- StudentTable with columns:
    name, department, readiness_score, segment_badge,
    last_active, applications_count, actions
- Filters: segment, department, score_range, last_active_range
- Row actions: view profile, assign mentor, flag intervention, send nudge
```

**Page: `/admin/interventions`**

```
Shows only At-Risk + Critical students
For each:
- Risk reason (inactivity days, score drop, no applications)
- Recommended action (mentor, parent notification, simplified tasks)
- One-click: "Send Nudge" (creates Notification), "Flag to HOD", "Assign Mentor"
```

**Segmentation Query (Prisma, runs nightly):**

```typescript
// Segment logic — runs as API route called by BullMQ worker
const profiles = await prisma.studentProfile.findMany({
  where: { universityId },
  include: {
    readinessScores: { orderBy: { createdAt: "desc" }, take: 2 },
  },
});

for (const p of profiles) {
  const latest = p.readinessScores[0];
  const prev = p.readinessScores[1];
  const daysSinceActive = daysSince(p.lastActiveAt);
  const scoreDelta = latest.totalScore - (prev?.totalScore ?? 0);

  let segment: Segment;
  if (latest.totalScore > 75 && daysSinceActive < 3 && scoreDelta >= 0)
    segment = "RISING_STAR";
  else if (latest.totalScore > 60 && daysSinceActive > 7) segment = "CAPABLE";
  else if (latest.totalScore < 40 || daysSinceActive > 14) segment = "CRITICAL";
  else if (latest.totalScore < 60 || daysSinceActive > 7) segment = "AT_RISK";
  else segment = "CAPABLE";

  await prisma.studentProfile.update({
    where: { id: p.id },
    data: { segment },
  });
}
```

---

## 9. LLM Strategy

| Task                            | Model                  | Why                                                      |
| ------------------------------- | ---------------------- | -------------------------------------------------------- |
| Gap analysis                    | GPT-4o                 | Long context, structured JSON output, nuanced reasoning  |
| Roadmap generation              | GPT-4o                 | Complex mission structuring needs depth                  |
| Interview conductor             | GPT-4o                 | Needs to maintain context across 10+ turns               |
| Answer scoring (fast)           | GPT-4o-mini            | High frequency, needs to be cheap and fast               |
| Interview probing questions     | Gemini 2.0 Flash       | Ultra-fast follow-up generation, low latency feel        |
| Resource research (per mission) | Gemini 2.0 Flash       | Grounding with Google Search built-in — finds real links |
| CV + cover letter               | GPT-4o                 | High quality writing, JD mirroring                       |
| Resume parsing                  | GPT-4o                 | Structured extraction from messy PDF text                |
| Job research (company context)  | Gemini 2.0 Flash       | Real-time web grounding for recent company info          |
| Embeddings                      | text-embedding-3-small | Cost-effective, good enough for job matching             |

**Gemini Grounding Setup:**

```python
# Use Gemini with Google Search grounding for resource discovery
import google.generativeai as genai

model = genai.GenerativeModel(
    "gemini-2.0-flash",
    tools=[{"google_search": {}}]  # enables real-time search grounding
)

# For resource attachment per mission:
result = model.generate_content(
    f"Find 4 high-quality resources (blogs, papers, courses, repos) for learning: {topic}. "
    f"Return JSON array: [{{ title, url, type, estimated_minutes }}]"
)
# Gemini searches Google and returns grounded, real links
```

---

## 10. Frontend Pages & Components

### Student-Side Pages

| Route                     | Component                  | Data Source                          |
| ------------------------- | -------------------------- | ------------------------------------ |
| `/`                       | Landing page               | Static                               |
| `/login`                  | LoginPage                  | NextAuth                             |
| `/onboarding`             | OnboardingWizard (5 steps) | POST /api/onboarding/connect         |
| `/dashboard`              | StudentDashboard           | GET /api/readiness, /api/missions    |
| `/roadmap`                | RoadmapPage                | GET /api/missions (React Flow graph) |
| `/interview/[id]`         | InterviewChat              | POST /api/interviews/:id/message     |
| `/interview/[id]/debrief` | DebriefPage                | GET /api/interviews/:id/debrief      |
| `/jobs`                   | JobsPage                   | GET /api/jobs                        |
| `/jobs/[id]`              | JobDetailPage              | GET /api/jobs/:id                    |
| `/applications`           | ApplicationsPage           | GET /api/applications                |
| `/profile`                | ProfilePage                | GET /api/profile                     |

### Admin-Side Pages

| Route                  | Description                          |
| ---------------------- | ------------------------------------ |
| `/admin/dashboard`     | Batch overview with all analytics    |
| `/admin/students`      | Paginated + filterable student table |
| `/admin/students/[id]` | Individual student deep-dive         |
| `/admin/interventions` | At-risk + critical action panel      |
| `/admin/drives`        | Company drive calendar + eligibility |

### Key Shared Components

```typescript
// Dashboard
<ReadinessScoreCard score={78} delta={+4} pillars={...} />
<ScorePillarBar name="DSA" score={72} weakTopics={["graphs", "dp"]} />
<StreakTracker currentStreak={7} longestStreak={14} />
<ActivityHeatmap data={commitData} />

// Roadmap
<MissionNode mission={m} onMarkComplete={fn} />  // React Flow node
<MissionCard mission={m} expanded />

// Interview
<ChatBubble role="ai"|"student" content={msg} timestamp={t} />
<SentimentMeter confidence={0.72} nervousness={0.28} />
<DebriefCard debrief={debrief} />

// Jobs
<JobCard job={j} matchScore={82} onSave={fn} onApply={fn} />
<MatchBadge score={82} />  // color-coded: green >70, amber 50-70, red <50
<ApplicationStatusBadge status="INTERVIEWING" />

// Admin
<SegmentBadge segment="AT_RISK" />
<BatchHeatmap skills={weakSkills} />
<RiskFlagPanel students={atRiskStudents} onAction={fn} />
```

---

## 11. Data Flow Diagrams

### Onboarding Flow

```
User signs in with GitHub
        ↓
NextAuth creates User + Account rows
        ↓
Redirect to /onboarding (if !onboardingDone)
        ↓
User fills form → POST /api/onboarding/connect
        ↓
Next.js route:
  1. Creates StudentProfile row
  2. Creates PlatformConnection rows (PENDING)
  3. Enqueues: [INGESTION:GITHUB, INGESTION:LEETCODE, INGESTION:RESUME]
  4. Returns { jobIds } to frontend
        ↓
BullMQ workers pick up jobs
  → Calls FastAPI POST /ingest/github etc.
  → FastAPI writes rawData + parsedData to PlatformConnection
  → Updates syncStatus to DONE (or FAILED)
  → Enqueues ANALYSIS:GAP_ANALYSIS job
        ↓
Gap Analysis completes
  → Writes ReadinessScore
  → Enqueues ANALYSIS:ROADMAP
        ↓
Roadmap Generation completes
  → Writes Mission rows
  → Updates StudentProfile.onboardingDone = true
        ↓
Frontend polling /api/onboarding/status detects completion
  → Redirects to /dashboard
```

### Mission Complete → Interview Flow

```
Student clicks "Mark Complete" on mission
        ↓
PATCH /api/missions/:id/status { status: "COMPLETED" }
        ↓
Next.js route:
  1. Updates Mission.status = COMPLETED
  2. Checks if interview should be triggered (mission.type != SOLVE simple)
  3. If yes: creates InterviewSession row (status: IN_PROGRESS)
  4. Enqueues NOTIFY job: "Interview ready for: {mission.title}"
        ↓
Student clicks notification → navigates to /interview/:sessionId
        ↓
POST /api/interviews/:id/message { message: "..." }
        ↓
Next.js route calls FastAPI POST /interview/message
        ↓
LangGraph interview agent:
  1. Appends message to transcript
  2. Evaluates current state (OPENING/TECHNICAL/PROBING/etc.)
  3. Generates next AI message (GPT-4o or Gemini Flash)
  4. Runs answer scoring in background (GPT-4o-mini)
  5. Decides state transition
  6. Returns { message, state, done: false }
        ↓
If done: POST /api/interviews/:id/end
  → FastAPI generates debrief (GPT-4o)
  → Writes to InterviewSession.debrief
  → Enqueues ANALYSIS:GAP_ANALYSIS (re-run with new interview data)
  → Enqueues NOTIFY: "Interview debrief ready"
```

---

## 12. Error Handling Strategy

### Frontend

```typescript
// Global error boundary in layout.tsx
// React Query automatic retry: 3x with exponential backoff
// Toast notifications for user-facing errors (sonner)
// Skeleton loaders for all async data (never blank screen)
```

### Next.js API Routes

```typescript
// Wrapper for all route handlers:
export function withErrorHandling(handler: RouteHandler): RouteHandler {
  return async (req, ctx) => {
    try {
      return await handler(req, ctx);
    } catch (err) {
      if (err instanceof PrismaClientKnownRequestError) {
        return Response.json({ error: "Database error" }, { status: 500 });
      }
      if (err instanceof ZodError) {
        return Response.json({ error: err.flatten() }, { status: 400 });
      }
      console.error(err);
      return Response.json({ error: "Internal server error" }, { status: 500 });
    }
  };
}
```

### BullMQ Workers

```typescript
// All workers configured with:
{
  attempts: 3,
  backoff: { type: "exponential", delay: 2000 },
}

// On final failure: update SyncStatus to FAILED, write errorMessage, notify user
worker.on("failed", async (job, err) => {
  await prisma.platformConnection.update({
    where: { id: job.data.connectionId },
    data: { syncStatus: "FAILED", errorMessage: err.message }
  })
})
```

### FastAPI

```python
# Global exception handler
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": "Internal error"})

# LLM call retries (tenacity)
@retry(stop=stop_after_attempt(3), wait=wait_exponential(min=1, max=10))
async def call_gpt4o(prompt: str) -> str:
    ...
```

---

## 13. Build Order & Task Breakdown

### Phase 0 — Foundation (Hours 0–3)

- [ ] Init Next.js app with TypeScript + Tailwind + shadcn/ui
- [ ] Set up Prisma schema (copy from Section 5) + run first migration
- [ ] Configure NextAuth with GitHub provider + Prisma adapter
- [ ] Set up Docker Compose: `postgres:16` + `redis:7` for local dev
- [ ] Init FastAPI app with health check endpoint + Pydantic settings
- [ ] Verify end-to-end: Next.js → GitHub OAuth → user in Postgres ✓

### Phase 1 — Ingestion (Hours 3–8)

- [ ] GitHub ingestion endpoint (PyGithub)
- [ ] LeetCode ingestion (httpx + GraphQL)
- [ ] Resume upload + parse (pdfplumber + GPT-4o)
- [ ] BullMQ workers: ingestion queue + job chaining
- [ ] Onboarding wizard UI (5-step form + status polling)

### Phase 2 — AI Core (Hours 8–16)

- [ ] Gap analyzer LangGraph graph (pillar scoring + weak topics)
- [ ] Readiness score write to DB
- [ ] Roadmap generator LangGraph graph (6 missions)
- [ ] Resource attachment via Gemini Flash grounding
- [ ] Roadmap page: React Flow graph of missions

### Phase 3 — Interview (Hours 16–20)

- [ ] Interview state machine (LangGraph, 5 states)
- [ ] Chat UI (real-time message exchange)
- [ ] Answer scoring (background GPT-4o-mini)
- [ ] Debrief generation + display page
- [ ] Sentiment meter (optional: wire ai-video-sentiment-model)

### Phase 4 — Jobs (Hours 20–23)

- [ ] Job scraping: JSearch API integration
- [ ] Embedding-based match scoring
- [ ] Jobs listing page with match badges
- [ ] CV + cover letter generation (GPT-4o)
- [ ] Apply modal (human-in-the-loop)

### Phase 5 — University Dashboard (Hours 23–26)

- [ ] Admin auth (role check in NextAuth session)
- [ ] Batch stats aggregation queries (Prisma)
- [ ] Segmentation logic + nightly cron
- [ ] Dashboard page: readiness chart + skill heatmap
- [ ] Students table + intervention panel

### Phase 6 — Polish (Hours 26–28)

- [ ] Loading skeletons everywhere
- [ ] Notification system (bell icon + unread count)
- [ ] Mobile responsive audit
- [ ] Seed demo data (Arjun persona, full journey)
- [ ] Deploy to Vercel + Railway

---

## 14. Deployment

### `docker-compose.yml` (local dev only)

```yaml
version: "3.9"
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: careerforge
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: devpass
    ports:
      - "5432:5432"
    volumes:
      - pg_data:/var/lib/postgresql/data

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"

volumes:
  pg_data:
```

### Production

| Service           | Platform | Config                                                     |
| ----------------- | -------- | ---------------------------------------------------------- |
| Next.js frontend  | Vercel   | Auto-deploy from `apps/web`, set env vars in dashboard     |
| Python AI service | Railway  | Dockerfile in `apps/ai-service`, set env vars in dashboard |
| PostgreSQL        | Neon     | Serverless Postgres, free tier — get DATABASE_URL          |
| Redis             | Upstash  | Serverless Redis, BullMQ compatible — get REDIS_URL        |

### `apps/ai-service/Dockerfile`

```dockerfile
FROM python:3.12-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
RUN playwright install chromium --with-deps

COPY . .

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### Health Checks

```
GET /api/health           → { status: "ok", db: "ok", redis: "ok" }
GET http://ai-service/health → { status: "ok", openai: "ok", gemini: "ok" }
```

---

_Last updated: CareerForge AI v1.0.0 — HackAI 2025_

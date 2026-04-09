import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import {
  ApplicationStatus,
  InterviewStatus,
  InterviewType,
  JobSource,
  MissionStatus,
  MissionType,
  NotificationType,
  Platform,
  PrismaClient,
  Segment,
  SyncStatus,
  UserRole,
} from "../src/generated/prisma/client";

function getArg(name: string) {
  const prefix = `--${name}=`;
  const direct = process.argv.find((arg) => arg.startsWith(prefix));
  if (direct) return direct.slice(prefix.length);

  const index = process.argv.findIndex((arg) => arg === `--${name}`);
  if (index >= 0) return process.argv[index + 1];

  return undefined;
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to run the dashboard seed.");
  }

  const adapter = new PrismaPg(databaseUrl);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return new PrismaClient({ adapter } as any);
}

const prisma = createPrismaClient();

const targetEmail = getArg("email") ?? process.env.DASHBOARD_SEED_EMAIL;

async function ensureUser() {
  if (targetEmail) {
    const existing = await prisma.user.findUnique({
      where: { email: targetEmail },
      include: { profile: true },
    });

    if (existing) return existing;

    return prisma.user.create({
      data: {
        email: targetEmail,
        name: "CareerForge Demo",
        image: "https://avatars.githubusercontent.com/u/9919?v=4",
        role: UserRole.STUDENT,
        emailVerified: new Date(),
      },
      include: { profile: true },
    });
  }

  const existing = await prisma.user.findFirst({
    where: { role: UserRole.STUDENT },
    orderBy: { createdAt: "asc" },
    include: { profile: true },
  });

  if (existing) return existing;

  return prisma.user.create({
    data: {
      email: "demo@careerforge.dev",
      name: "CareerForge Demo",
      image: "https://avatars.githubusercontent.com/u/9919?v=4",
      role: UserRole.STUDENT,
      emailVerified: new Date(),
    },
    include: { profile: true },
  });
}

async function clearDashboardData(studentProfileId: string, userId: string) {
  await prisma.notification.deleteMany({ where: { userId } });
  await prisma.savedJob.deleteMany({ where: { studentProfileId } });
  await prisma.interviewSession.deleteMany({ where: { studentProfileId } });
  await prisma.application.deleteMany({ where: { studentProfileId } });
  await prisma.mission.deleteMany({ where: { studentProfileId } });
  await prisma.readinessScore.deleteMany({ where: { studentProfileId } });
  await prisma.platformConnection.deleteMany({ where: { studentProfileId } });
}

async function main() {
  const user = await ensureUser();

  const profile = user.profile
    ? await prisma.studentProfile.update({
        where: { userId: user.id },
        data: {
          githubUsername: "adityaadpandey",
          leetcodeHandle: "aditya_codes",
          codeforcesHandle: "aditya_cf",
          linkedinUrl: "https://www.linkedin.com/in/aditya-pandey",
          targetRole: "Frontend Engineer",
          dreamCompanies: ["Google", "Atlassian", "Stripe", "Razorpay"],
          graduationYear: 2027,
          department: "Computer Science",
          timelineWeeks: 16,
          hoursPerWeek: 22,
          segment: Segment.CAPABLE,
          streakDays: 14,
          lastActiveAt: new Date(),
          onboardingDone: true,
        },
      })
    : await prisma.studentProfile.create({
        data: {
          userId: user.id,
          githubUsername: "adityaadpandey",
          leetcodeHandle: "aditya_codes",
          codeforcesHandle: "aditya_cf",
          linkedinUrl: "https://www.linkedin.com/in/aditya-pandey",
          targetRole: "Frontend Engineer",
          dreamCompanies: ["Google", "Atlassian", "Stripe", "Razorpay"],
          graduationYear: 2027,
          department: "Computer Science",
          timelineWeeks: 16,
          hoursPerWeek: 22,
          segment: Segment.CAPABLE,
          streakDays: 14,
          lastActiveAt: new Date(),
          onboardingDone: true,
        },
      });

  await clearDashboardData(profile.id, user.id);

  const now = new Date();
  const daysAgo = (days: number, hour = 10) =>
    new Date(now.getTime() - days * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);
  const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 60 * 60 * 1000);

  await prisma.readinessScore.createMany({
    data: [
      {
        studentProfileId: profile.id,
        totalScore: 68,
        dsaScore: 61,
        devScore: 72,
        commScore: 64,
        consistencyScore: 58,
        weakTopics: ["Recursion", "Graphs", "Behavioral"],
        gapAnalysis: {
          summary: "Strong execution on frontend projects, but interview depth and consistency need work.",
          priorities: ["DSA consistency", "Behavioral clarity", "System design basics"],
        },
        createdAt: daysAgo(7, 11),
      },
      {
        studentProfileId: profile.id,
        totalScore: 82,
        dsaScore: 76,
        devScore: 88,
        commScore: 79,
        consistencyScore: 85,
        weakTopics: [
          "Binary Trees",
          "Dynamic Programming",
          "System Design",
          "Graphs",
          "Behavioral",
          "Recursion",
        ],
        gapAnalysis: {
          summary: "Solid readiness with clear improvement areas before top-tier frontend interviews.",
          priorities: [
            "Binary tree patterns",
            "DP revision",
            "System design storytelling",
            "Behavioral answer structure",
          ],
        },
        createdAt: hoursAgo(8),
      },
    ],
  });

  const missions = await Promise.all([
    prisma.mission.create({
      data: {
        studentProfileId: profile.id,
        type: MissionType.BUILD,
        title: "Polish CareerForge auth and landing flows",
        description: "Refine the login and landing UI, improve responsiveness, and ship a cleaner first-run experience.",
        status: MissionStatus.IN_PROGRESS,
        resources: {
          links: ["https://refactoringui.com/", "https://www.framer.com/motion/"],
        },
        estimatedHours: 6,
        deadline: daysAgo(-3, 18),
        orderIndex: 1,
        prerequisiteIds: [],
      },
    }),
    prisma.mission.create({
      data: {
        studentProfileId: profile.id,
        type: MissionType.SOLVE,
        title: "Finish 12 binary tree interview problems",
        description: "Practice traversal, LCA, balanced tree, serialization, and path-based questions.",
        status: MissionStatus.AVAILABLE,
        resources: {
          problems: ["LC 102", "LC 236", "LC 297", "LC 543"],
        },
        estimatedHours: 8,
        deadline: daysAgo(-5, 20),
        orderIndex: 2,
        prerequisiteIds: [],
      },
    }),
    prisma.mission.create({
      data: {
        studentProfileId: profile.id,
        type: MissionType.COMMUNICATE,
        title: "Record three behavioral interview stories",
        description: "Prepare STAR responses for conflict, ownership, and learning from failure.",
        status: MissionStatus.AVAILABLE,
        resources: {
          prompts: ["Ownership", "Conflict", "Failure", "Speed of learning"],
        },
        estimatedHours: 3,
        deadline: daysAgo(-6, 21),
        orderIndex: 3,
        prerequisiteIds: [],
      },
    }),
    prisma.mission.create({
      data: {
        studentProfileId: profile.id,
        type: MissionType.BUILD,
        title: "Ship one dashboard analytics improvement",
        description: "Add richer seed data or a UX improvement that makes the dashboard more believable and actionable.",
        status: MissionStatus.IN_PROGRESS,
        resources: {
          deliverables: ["Demo-ready dashboard state", "Improved analytics visuals"],
        },
        estimatedHours: 5,
        deadline: daysAgo(-8, 19),
        orderIndex: 4,
        prerequisiteIds: [],
      },
    }),
    prisma.mission.create({
      data: {
        studentProfileId: profile.id,
        type: MissionType.SOLVE,
        title: "Revise graph BFS/DFS patterns",
        description: "Focus on traversal templates, topological sort, and shortest-path basics.",
        status: MissionStatus.AVAILABLE,
        resources: {
          topics: ["BFS", "DFS", "Topo sort", "Dijkstra intuition"],
        },
        estimatedHours: 4,
        deadline: daysAgo(-10, 18),
        orderIndex: 5,
        prerequisiteIds: [],
      },
    }),
    prisma.mission.create({
      data: {
        studentProfileId: profile.id,
        type: MissionType.COMMUNICATE,
        title: "Complete one mock technical interview",
        description: "Run a timed mock interview and debrief weak areas.",
        status: MissionStatus.COMPLETED,
        resources: { mode: "timed", durationMinutes: 45 },
        estimatedHours: 2,
        deadline: daysAgo(1, 17),
        orderIndex: 6,
        completedAt: hoursAgo(1),
        prerequisiteIds: [],
      },
    }),
  ]);

  await prisma.platformConnection.createMany({
    data: [
      {
        studentProfileId: profile.id,
        platform: Platform.GITHUB,
        syncStatus: SyncStatus.DONE,
        lastSyncedAt: hoursAgo(5),
        rawData: { source: "seed" },
        parsedData: {
          profile: {
            public_repos: 19,
            followers: 42,
          },
          repositories: {
            total_count: 19,
            primary_languages: {
              TypeScript: 11,
              JavaScript: 4,
              CSS: 3,
            },
            top_projects: [
              { name: "careerforge", stars: 28, total_commits: 146 },
              { name: "frontend-case-study", stars: 16, total_commits: 84 },
              { name: "interview-notes", stars: 7, total_commits: 41 },
            ],
          },
          contributions: {
            total_prs: 23,
            merged_prs: 19,
          },
        },
      },
      {
        studentProfileId: profile.id,
        platform: Platform.LEETCODE,
        syncStatus: SyncStatus.DONE,
        lastSyncedAt: hoursAgo(6),
        rawData: { source: "seed" },
        parsedData: {
          handle: "aditya_codes",
          total_solved: 412,
          easy_solved: 148,
          medium_solved: 214,
          hard_solved: 50,
          contest_rating: 1768,
          global_ranking: 24561,
        },
      },
      {
        studentProfileId: profile.id,
        platform: Platform.CODEFORCES,
        syncStatus: SyncStatus.DONE,
        lastSyncedAt: daysAgo(2, 9),
        rawData: { source: "seed" },
        parsedData: {
          handle: "aditya_cf",
          rating: 1342,
          rank: "pupil",
        },
      },
      {
        studentProfileId: profile.id,
        platform: Platform.RESUME,
        syncStatus: SyncStatus.DONE,
        lastSyncedAt: daysAgo(1, 12),
        rawData: { source: "seed" },
        parsedData: {
          pages: 1,
          updated: true,
          highlights: ["Frontend", "React", "TypeScript", "System design basics"],
        },
      },
    ],
  });

  const jobs = await Promise.all([
    prisma.job.create({
      data: {
        externalId: "job_cf_1",
        title: "Frontend Engineer Intern",
        company: "Razorpay",
        location: "Bengaluru",
        isRemote: false,
        source: JobSource.LINKEDIN,
        requirementsText: "React, TypeScript, UI polish, product thinking",
        requirementsTags: ["React", "TypeScript", "UI", "Frontend"],
        applyUrl: "https://example.com/jobs/razorpay-frontend-intern",
        salaryMin: 1200000,
        salaryMax: 1800000,
        postedAt: daysAgo(2, 10),
        deadline: daysAgo(-12, 23),
      },
    }),
    prisma.job.create({
      data: {
        externalId: "job_cf_2",
        title: "Software Engineer I",
        company: "Atlassian",
        location: "Remote",
        isRemote: true,
        source: JobSource.WELLFOUND,
        requirementsText: "Frontend systems, accessibility, TypeScript",
        requirementsTags: ["TypeScript", "Accessibility", "Frontend"],
        applyUrl: "https://example.com/jobs/atlassian-swe-1",
        salaryMin: 1800000,
        salaryMax: 2600000,
        postedAt: daysAgo(3, 11),
      },
    }),
    prisma.job.create({
      data: {
        externalId: "job_cf_3",
        title: "UI Engineer",
        company: "CRED",
        location: "Bengaluru",
        isRemote: false,
        source: JobSource.NAUKRI,
        requirementsText: "High-quality product UI, animations, performance",
        requirementsTags: ["UI", "Motion", "Performance"],
        applyUrl: "https://example.com/jobs/cred-ui-engineer",
        salaryMin: 1500000,
        salaryMax: 2200000,
        postedAt: daysAgo(1, 15),
      },
    }),
    prisma.job.create({
      data: {
        externalId: "job_cf_4",
        title: "Frontend Developer",
        company: "Postman",
        location: "Remote",
        isRemote: true,
        source: JobSource.DIRECT,
        requirementsText: "Frontend architecture, React, API-centric products",
        requirementsTags: ["React", "APIs", "Architecture"],
        applyUrl: "https://example.com/jobs/postman-frontend-developer",
        salaryMin: 1700000,
        salaryMax: 2400000,
        postedAt: daysAgo(5, 14),
      },
    }),
    prisma.job.create({
      data: {
        externalId: "job_cf_5",
        title: "Product Engineer",
        company: "Linear",
        location: "Remote",
        isRemote: true,
        source: JobSource.DIRECT,
        requirementsText: "Product engineering, frontend execution, user empathy",
        requirementsTags: ["Product", "Frontend", "Execution"],
        applyUrl: "https://example.com/jobs/linear-product-engineer",
        salaryMin: 2200000,
        salaryMax: 3200000,
        postedAt: daysAgo(4, 13),
      },
    }),
  ]);

  await Promise.all([
    prisma.application.create({
      data: {
        studentProfileId: profile.id,
        jobId: jobs[0].id,
        matchScore: 91,
        status: ApplicationStatus.APPLIED,
        cvGenerated: "Tailored resume generated for Razorpay frontend internship.",
        coverLetter: "Focused on frontend polish, React ownership, and shipping product-ready UI.",
        appliedAt: daysAgo(1, 18),
        notes: "Strong fit for UI polish and React delivery.",
      },
    }),
    prisma.application.create({
      data: {
        studentProfileId: profile.id,
        jobId: jobs[1].id,
        matchScore: 88,
        status: ApplicationStatus.INTERVIEWING,
        cvGenerated: "Highlighted design systems, component architecture, and accessibility work.",
        coverLetter: "Aligned experience with frontend system thinking and developer tooling.",
        appliedAt: daysAgo(3, 16),
        responseAt: daysAgo(2, 14),
        notes: "Recruiter screen complete.",
      },
    }),
    prisma.application.create({
      data: {
        studentProfileId: profile.id,
        jobId: jobs[2].id,
        matchScore: 84,
        status: ApplicationStatus.VIEWED,
        cvGenerated: "Emphasized motion design, UX sensitivity, and performance optimization.",
        coverLetter: "Positioned as a UI-focused engineer with strong execution taste.",
        appliedAt: daysAgo(2, 17),
      },
    }),
    prisma.application.create({
      data: {
        studentProfileId: profile.id,
        jobId: jobs[3].id,
        matchScore: 79,
        status: ApplicationStatus.APPLIED,
        cvGenerated: "Focused on frontend architecture and API-heavy product work.",
        coverLetter: "Connected project ownership to scalable frontend work.",
        appliedAt: daysAgo(4, 12),
      },
    }),
    prisma.application.create({
      data: {
        studentProfileId: profile.id,
        jobId: jobs[4].id,
        matchScore: 74,
        status: ApplicationStatus.DRAFT,
        cvGenerated: "Draft CV generated for product engineering role.",
        coverLetter: "Draft cover letter tailored to product-led frontend execution.",
      },
    }),
  ]);

  await Promise.all([
    prisma.interviewSession.create({
      data: {
        studentProfileId: profile.id,
        missionId: missions[5].id,
        interviewType: InterviewType.TECHNICAL,
        status: InterviewStatus.COMPLETED,
        transcript: {
          durationMinutes: 47,
          questions: 6,
          focus: ["Trees", "React perf", "Behavioral ownership"],
        },
        debrief: {
          strengths: ["Clear communication", "Frontend depth", "Structured debugging"],
          improvements: ["Tree traversal edge cases", "DP pattern recall"],
        },
        sentimentScores: {
          confidence: 0.81,
          clarity: 0.84,
          calmness: 0.76,
        },
        overallScore: 83,
        createdAt: hoursAgo(2),
        completedAt: hoursAgo(1),
      },
    }),
    prisma.interviewSession.create({
      data: {
        studentProfileId: profile.id,
        interviewType: InterviewType.BEHAVIORAL,
        status: InterviewStatus.COMPLETED,
        transcript: {
          durationMinutes: 29,
          questions: 4,
          focus: ["Conflict", "Ownership", "Failure"],
        },
        debrief: {
          strengths: ["Honest examples", "Clear ownership"],
          improvements: ["More quantified outcomes"],
        },
        sentimentScores: {
          confidence: 0.74,
          clarity: 0.78,
        },
        overallScore: 79,
        createdAt: daysAgo(3, 15),
        completedAt: daysAgo(3, 16),
      },
    }),
    prisma.interviewSession.create({
      data: {
        studentProfileId: profile.id,
        interviewType: InterviewType.SYSTEM_DESIGN,
        status: InterviewStatus.COMPLETED,
        transcript: {
          durationMinutes: 38,
          focus: ["URL shortener", "caching", "trade-offs"],
        },
        debrief: {
          strengths: ["Reasonable decomposition"],
          improvements: ["Trade-off articulation", "scale estimation"],
        },
        sentimentScores: {
          confidence: 0.69,
          clarity: 0.71,
        },
        overallScore: 72,
        createdAt: daysAgo(5, 17),
        completedAt: daysAgo(5, 18),
      },
    }),
  ]);

  await prisma.notification.createMany({
    data: [
      {
        userId: user.id,
        type: NotificationType.ROADMAP_UPDATED,
        title: "Roadmap updated",
        body: "Three new frontend-focused missions are ready to start.",
        actionUrl: "/roadmap",
      },
      {
        userId: user.id,
        type: NotificationType.JOB_MATCH,
        title: "New high-match role",
        body: "Razorpay Frontend Engineer Intern matched at 91%.",
        actionUrl: "/jobs",
      },
      {
        userId: user.id,
        type: NotificationType.INTERVIEW_READY,
        title: "Interview debrief ready",
        body: "Your latest technical mock interview has a fresh score and feedback.",
        actionUrl: "/interview",
      },
    ],
  });

  console.log("");
  console.log("Dashboard seed completed.");
  console.log(`User: ${user.email}`);
  console.log(`Target role: Frontend Engineer`);
  console.log(`Readiness: 82`);
  console.log(`Missions seeded: 6`);
  console.log(`Job matches seeded: 5`);
  console.log(`Applications counted: 4 active + 1 draft`);
  console.log(`Interviews completed this week: 3`);
  console.log("");
}

main()
  .catch((error) => {
    console.error("Dashboard seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

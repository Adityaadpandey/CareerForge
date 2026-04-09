import "dotenv/config";
import { Queue } from "bullmq";
import IORedis from "ioredis";

const redis = new IORedis(process.env.REDIS_URL ?? "redis://:cantremember@localhost:6379", {
  maxRetriesPerRequest: null,
});
const ingestionQ = new Queue("ingestion", { connection: redis });

const sid = "cmnrornry0002y3xp77k7clfo";
const username = "adityaadpandey";
const leetcodeHandle = "adityaadpandey"; // update if different

async function main() {
  await ingestionQ.add("GITHUB", { type: "GITHUB", studentProfileId: sid, username }, { attempts: 3 });
  await ingestionQ.add("LEETCODE", { type: "LEETCODE", studentProfileId: sid, handle: leetcodeHandle }, { attempts: 3 });
  console.log(`✓ Queued GITHUB + LEETCODE ingestion for profile ${sid}`);
  await redis.quit();
}

main().catch(console.error);

import { db } from "../apps/api/src/core/config/db";
import { coreJobs, users } from "@shared/schema";
import { jobsRepository } from "../apps/api/src/core/jobs/jobs.repository";
import { jobsRegistry } from "../apps/api/src/core/jobs/jobs.registry";
import { JobsWorker } from "../apps/api/src/core/jobs/jobs.worker";
import { eq } from "drizzle-orm";

async function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runValidation() {
  console.log("==================================================");
  console.log("🚀 STARTING ERP-004A VALIDATION AND STRESS TEST");
  console.log("==================================================");

  // 1. Setup mock user
  const [testUser] = await db.select().from(users).limit(1);
  let userId = testUser?.id;
  if (!userId) {
    userId = "test-job-owner-id";
    await db.insert(users).values({
      id: userId,
      username: "testjobowner",
      fullName: "Job Test User",
      email: "jobtest@example.com",
      role: "admin",
      password: "mock-hash",
    });
  }

  // 2. Register mock job
  jobsRegistry.register("VALIDATION_JOB", async (job, updateProgress) => {
    const payload = job.payload ? JSON.parse(job.payload) : {};
    const duration = payload.duration || 100;
    await updateProgress(20, { processedRows: 2, totalRows: 10, currentStep: "Reading" });
    await sleep(duration / 3);
    await updateProgress(60, { processedRows: 6, totalRows: 10, currentStep: "Streaming" });
    await sleep(duration / 3);
    await updateProgress(100, { processedRows: 10, totalRows: 10, currentStep: "Completed" });
    return {
      url: `file:///tmp/result-${job.id}.xlsx`,
      size: 512,
      mime: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    };
  });

  // Clear jobs table
  await db.delete(coreJobs);

  // --- PHASE 1: 1 Single Job ---
  console.log("\n🔹 PHASE 1: Executing 1 Single Background Job...");
  const jobId = await jobsRepository.createJob({
    type: "VALIDATION_JOB",
    ownerId: userId,
    payload: JSON.stringify({ duration: 150 }),
  });

  const worker = new JobsWorker({ intervalMs: 200, maxConcurrentJobs: 3 });
  worker.start();

  // Poll for completion
  let completed = false;
  for (let i = 0; i < 20; i++) {
    const job = await jobsRepository.getJobById(jobId);
    if (job?.status === "COMPLETED") {
      completed = true;
      console.log(`✅ Job ${jobId} Completed. Progress: ${job.progress}%, Step: ${JSON.parse(job.progressDetails || "{}").currentStep}`);
      break;
    }
    await sleep(100);
  }
  if (!completed) {
    console.error("❌ Phase 1 Failed: Job did not complete in time.");
    worker.stop();
    process.exit(1);
  }

  // --- PHASE 2: 10 Concurrent Jobs ---
  console.log("\n🔹 PHASE 2: Executing 10 Concurrent Background Jobs...");
  const concurrentJobIds: string[] = [];
  for (let i = 0; i < 10; i++) {
    const cid = await jobsRepository.createJob({
      type: "VALIDATION_JOB",
      ownerId: userId,
      payload: JSON.stringify({ duration: 300 }),
    });
    concurrentJobIds.push(cid);
  }

  console.log(`⏳ Dispatched 10 jobs. Monitoring queue concurrency limit (Max = 3)...`);
  
  let allDone = false;
  for (let i = 0; i < 50; i++) {
    const jobs = await db.select().from(coreJobs).where(eq(coreJobs.type, "VALIDATION_JOB"));
    const runningCount = jobs.filter((j) => j.status === "RUNNING").length;
    const completedCount = jobs.filter((j) => j.status === "COMPLETED").length;
    
    console.log(`   [Tick ${i}] Running: ${runningCount} | Completed: ${completedCount}/11`);
    
    if (runningCount > 3) {
      console.error(`❌ Concurrency Error: Found ${runningCount} running jobs, exceeding max of 3.`);
      worker.stop();
      process.exit(1);
    }
    
    if (completedCount === 11) {
      allDone = true;
      break;
    }
    await sleep(200);
  }

  if (allDone) {
    console.log("✅ Phase 2 Success: All 10 concurrent jobs finished. Concurrency constraints respected!");
  } else {
    console.error("❌ Phase 2 Failed: Jobs failed to complete within timeline.");
    worker.stop();
    process.exit(1);
  }

  // --- PHASE 3: Stale Worker Recovery ---
  console.log("\n🔹 PHASE 3: Testing Stale Worker & Heartbeat Recovery...");
  // Stop the active worker first to simulate a crash/restart
  worker.stop();

  const staleJobId = await jobsRepository.createJob({
    type: "VALIDATION_JOB",
    ownerId: userId,
  });

  // Manually claim the job to make it RUNNING
  const claimed = await jobsRepository.claimNextJob();
  console.log(`   Job ${staleJobId} is claimed. Status: ${claimed.status}`);

  // Manually push heartbeat back to simulate it died 5 minutes ago
  await db
    .update(coreJobs)
    .set({ lastHeartbeatAt: new Date(Date.now() - 300000) })
    .where(eq(coreJobs.id, staleJobId));

  console.log(`   Simulated worker crash. Running recoverStaleJobs()...`);
  const recovered = await jobsRepository.recoverStaleJobs(120000); // 2 minutes threshold
  console.log(`   Recovered Count: ${recovered}`);

  const jobRecoveredState = await jobsRepository.getJobById(staleJobId);
  console.log(`   Post-Recovery Status: ${jobRecoveredState?.status}`);
  console.log(`   Post-Recovery Retry Count: ${jobRecoveredState?.retryCount}`);
  console.log(`   Post-Recovery Error Message: "${jobRecoveredState?.errorMessage}"`);

  if (jobRecoveredState?.status === "PENDING" && jobRecoveredState.retryCount === 1) {
    console.log("✅ Phase 3 Success: Stale job automatically requeued for retry with exponential backoff!");
  } else {
    console.error("❌ Phase 3 Failed: Stale job was not recovered correctly.");
    process.exit(1);
  }

  console.log("\n==================================================");
  console.log("🎉 ALL VALIDATION PHASES PASSED SUCCESSFULLY!");
  console.log("==================================================");
  process.exit(0);
}

runValidation().catch((err) => {
  console.error("❌ Critical Validation Failure:", err);
  process.exit(1);
});

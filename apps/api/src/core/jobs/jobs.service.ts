import { jobsRepository } from "./jobs.repository";
import { ValidationError, NotFoundError } from "@core/errors/AppError";
import fs from "fs";
import path from "path";

export class JobsService {
  async getJob(id: string) {
    const job = await jobsRepository.getJobById(id);
    if (!job) throw new NotFoundError("Job not found");
    return job;
  }

  async cancelJob(id: string, userId: string) {
    const job = await this.getJob(id);
    if (job.ownerId !== userId) {
      throw new ValidationError("Unauthorized: You do not own this job");
    }
    if (job.status !== "PENDING" && job.status !== "RUNNING") {
      throw new ValidationError(`Cannot cancel job in ${job.status} status`);
    }
    await jobsRepository.cancelJob(id);
    return { success: true };
  }

  async getDownloadStream(id: string, userId: string) {
    const job = await this.getJob(id);
    if (job.ownerId !== userId) {
      throw new ValidationError("Unauthorized: You do not own this job");
    }
    if (job.status !== "COMPLETED") {
      throw new ValidationError(`Job is not completed yet (current status: ${job.status})`);
    }
    if (!job.resultUrl) {
      throw new NotFoundError("No result URL found for completed job");
    }

    const filePath = path.resolve(job.resultUrl);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundError("Exported file not found on disk");
    }

    return {
      filePath,
      fileName: path.basename(filePath),
    };
  }
}

export const jobsService = new JobsService();

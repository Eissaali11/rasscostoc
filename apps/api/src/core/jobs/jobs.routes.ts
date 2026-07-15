import { Router } from "express";
import { requireAuth } from "@core/middlewares/auth.middleware";
import { jobsService } from "./jobs.service";
import { asyncHandler } from "@core/errors/errorHandler";
import type { Request, Response } from "express";

export function registerJobRoutes(app: any): void {
  const router = Router();

  router.get(
    "/api/jobs/:id",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const job = await jobsService.getJob(req.params.id);
      res.json({
        id: job.id,
        type: job.type,
        status: job.status,
        progress: job.progress,
        progressDetails: job.progressDetails ? JSON.parse(job.progressDetails) : null,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        startedAt: job.startedAt,
        finishedAt: job.finishedAt,
        expiresAt: job.expiresAt,
        nextRetryAt: job.nextRetryAt,
        lastErrorAt: job.lastErrorAt,
        resultUrl: job.resultUrl ? `/api/jobs/${job.id}/download` : null,
        resultMetadata: job.resultMetadata ? JSON.parse(job.resultMetadata) : null,
      });
    })
  );

  router.post(
    "/api/jobs/:id/cancel",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user!;
      const result = await jobsService.cancelJob(req.params.id, user.id);
      res.json(result);
    })
  );

  router.get(
    "/api/jobs/:id/download",
    requireAuth,
    asyncHandler(async (req: Request, res: Response) => {
      const user = req.user!;
      const { filePath, fileName } = await jobsService.getDownloadStream(req.params.id, user.id);
      res.download(filePath, fileName);
    })
  );

  app.use(router);
}

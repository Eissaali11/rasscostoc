import type { Express, Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { requireAuth, requireAdmin } from "@core/middlewares/auth.middleware";
import { ValidationError } from "@core/errors/AppError";
import {
  loadAiEngineSettings,
  toPublicSettings,
  updateAiEngineSettings,
  MODELS_BY_PROVIDER,
  type AiVisionProviderId,
} from "./ai-engine-settings.store";
import { testAiEngineConnection } from "./ai-engine-connection-test";

const PROVIDERS = new Set<AiVisionProviderId>(["gemini", "openai", "claude"]);

export function registerAiEngineSettingsRoutes(app: Express): void {
  app.get(
    "/api/ai-engine/settings",
    requireAuth,
    requireAdmin,
    asyncHandler(async (_req: Request, res: Response) => {
      res.json(toPublicSettings(loadAiEngineSettings()));
    }),
  );

  app.put(
    "/api/ai-engine/settings",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body || {};
      if (body.provider != null && !PROVIDERS.has(body.provider)) {
        throw new ValidationError("مزود غير مدعوم. استخدم: gemini | openai | claude");
      }
      if (body.provider && body.model) {
        const allowed = MODELS_BY_PROVIDER[body.provider as AiVisionProviderId] || [];
        if (!allowed.includes(body.model)) {
          throw new ValidationError(`الموديل غير مدعوم للمزود ${body.provider}`);
        }
      }

      const saved = updateAiEngineSettings({
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        provider: body.provider,
        model: body.model,
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        clearApiKey: body.clearApiKey === true,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
        updatedBy: req.user?.id ?? null,
      });

      let connectionTest = toPublicSettings(saved).lastConnectionTest;
      if (body.testConnection === true && body.clearApiKey !== true) {
        connectionTest = await testAiEngineConnection({
          provider: saved.provider,
          model: saved.model,
          timeoutMs: Math.min(saved.timeoutMs, 30000),
        });
      }

      res.json({
        success: true,
        settings: {
          ...toPublicSettings(loadAiEngineSettings()),
          lastConnectionTest: connectionTest,
        },
        connectionTest,
        message: "تم حفظ إعدادات محرك الذكاء الاصطناعي",
      });
    }),
  );

  app.post(
    "/api/ai-engine/settings/test",
    requireAuth,
    requireAdmin,
    asyncHandler(async (req: Request, res: Response) => {
      const body = req.body || {};
      if (body.provider != null && !PROVIDERS.has(body.provider)) {
        throw new ValidationError("مزود غير مدعوم. استخدم: gemini | openai | claude");
      }

      const connectionTest = await testAiEngineConnection({
        provider: body.provider,
        model: body.model,
        apiKey: typeof body.apiKey === "string" ? body.apiKey : undefined,
        timeoutMs: typeof body.timeoutMs === "number" ? body.timeoutMs : undefined,
      });

      res.json({
        success: connectionTest.ok,
        connectionTest,
        settings: toPublicSettings(loadAiEngineSettings()),
      });
    }),
  );
}

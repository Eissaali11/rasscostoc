import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { AuthorizationError, ConflictError, NotFoundError, ValidationError } from "@core/errors/AppError";
import { permissionsContainer } from "@server/composition/permissions.container";
import { OverrideVersionConflictError } from "../../domain/repositories/IPermissionsRepository";
import { OutsideRoleCeilingError, SelfPermissionEditError, UnknownPermissionError, UnsupportedTargetRoleError } from "../../application/PermissionsService";

/**
 * Domain/application errors are deliberately plain `Error` subclasses — the domain layer stays
 * HTTP-agnostic (OPS-PERM-S1-F4 §11). This is the one place that translates them to the
 * project's AppError hierarchy so errorHandler.ts gives clients the correct status code instead
 * of a generic 500.
 */
function mapPermissionError(err: unknown): never {
  if (err instanceof SelfPermissionEditError || err instanceof OutsideRoleCeilingError || err instanceof UnsupportedTargetRoleError) {
    throw new AuthorizationError(err.message);
  }
  if (err instanceof UnknownPermissionError) {
    throw new NotFoundError(err.message);
  }
  if (err instanceof OverrideVersionConflictError) {
    throw new ConflictError(err.message);
  }
  throw err;
}

const supportedPage = (v: unknown): v is string => typeof v === "string" && v.length > 0;
const supportedAction = (v: unknown): v is string => typeof v === "string" && v.length > 0;

function requireBody(req: Request): { page: string; action: string; reason?: string } {
  const { page, action, reason } = req.body ?? {};
  if (!supportedPage(page) || !supportedAction(action)) {
    throw new ValidationError("page و action مطلوبان");
  }
  return { page, action, reason: typeof reason === "string" ? reason : undefined };
}

/**
 * OPS-PERM-S1-F4 §8 — Permissions Center backend API.
 * Every route here is admin-only (enforced at the route table, see permissions.routes.ts) and,
 * independently, every write is re-validated server-side by PermissionsService — frontend
 * validation is never trusted (OPS-PERM-S1-F4 §8's explicit requirement).
 */
export class PermissionsController {
  getEmployeeSnapshot = asyncHandler(async (req: Request, res: Response) => {
    const snapshot = await permissionsContainer.service.getEmployeePermissionSnapshot(req.params.userId);
    res.json(snapshot);
  });

  getAuditHistory = asyncHandler(async (req: Request, res: Response) => {
    const history = await permissionsContainer.service.getAuditHistory(req.params.userId);
    res.json(history);
  });

  grant = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user!;
    const { page, action, reason } = requireBody(req);
    try {
      const result = await permissionsContainer.service.grantPermission(actor.id, req.params.userId, page, action, reason);
      res.json({ success: true, override: result });
    } catch (err) {
      mapPermissionError(err);
    }
  });

  revoke = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user!;
    const { page, action, reason } = requireBody(req);
    try {
      const result = await permissionsContainer.service.revokePermission(actor.id, req.params.userId, page, action, reason);
      res.json({ success: true, override: result });
    } catch (err) {
      mapPermissionError(err);
    }
  });

  reset = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user!;
    const { page, action, reason } = requireBody(req);
    try {
      await permissionsContainer.service.resetPermission(actor.id, req.params.userId, page, action, reason);
      res.json({ success: true });
    } catch (err) {
      mapPermissionError(err);
    }
  });
}

/**
 * Users controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { insertUserSchema, systemLogs } from "@shared/schema";
import { AuthorizationError, NotFoundError } from "@core/errors/AppError";
import { hashPassword } from "@server/utils/password";
import { usersContainer } from "@server/composition/users.container";
import { getDatabase } from "@core/database/connection";
import { ROLES, isAdmin, isSupervisor } from "@shared/roles";

/** PLATFORM-P0 — minimum necessary public user fields */
function toMinimalUserView(user: {
  id: string;
  username: string;
  fullName: string;
  role: string;
  regionId: string | null;
  employeeCode: string | null;
  technicianCode: string | null;
  isActive: boolean;
}) {
  return {
    id: user.id,
    username: user.username,
    fullName: user.fullName,
    role: user.role,
    regionId: user.regionId ?? null,
    employeeCode: user.employeeCode ?? null,
    technicianCode: user.technicianCode ?? null,
    isActive: user.isActive,
  };
}

function canReadUser(
  actor: Express.Request["user"],
  target: { id: string; regionId: string | null },
): boolean {
  if (!actor) return false;
  if (isAdmin(actor.role)) return true;
  if (actor.id === target.id) return true;
  if (
    isSupervisor(actor.role) &&
    actor.regionId &&
    target.regionId &&
    actor.regionId === target.regionId
  ) {
    return true;
  }
  return false;
}

export class UsersController {
  private async logActivity(log: typeof systemLogs.$inferInsert) {
    try {
      await getDatabase().insert(systemLogs).values(log);
    } catch (error) {
      console.error("Failed to write system audit log:", error);
    }
  }

  /**
   * GET /api/users
   * Get all users
   */
  getAll = asyncHandler(async (req: Request, res: Response) => {
    const users = await usersContainer.userManagementUseCase.findAll();
    res.json(users);
  });

  /**
   * GET /api/users/:id
   * PLATFORM-P0: authenticated + authorized; minimal fields; audit log
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user!;
    const target = await usersContainer.userManagementUseCase.findById(req.params.id);
    if (!target) {
      throw new NotFoundError("User not found");
    }

    if (!canReadUser(actor, target)) {
      await this.logActivity({
        userId: actor.id,
        userName: actor.username,
        userRole: actor.role,
        regionId: actor.regionId,
        action: "read_denied",
        entityType: "user",
        entityId: req.params.id,
        entityName: target.fullName,
        description: `رفض قراءة مستخدم (cross-org/unauthorized): ${target.username}`,
        severity: "warn",
        success: false,
      });
      throw new AuthorizationError("ليس لديك صلاحية لعرض هذا المستخدم");
    }

    await this.logActivity({
      userId: actor.id,
      userName: actor.username,
      userRole: actor.role,
      regionId: actor.regionId,
      action: "read",
      entityType: "user",
      entityId: target.id,
      entityName: target.fullName,
      description: `قراءة بيانات مستخدم: ${target.username}`,
      severity: "info",
      success: true,
    });

    res.json(toMinimalUserView(target));
  });

  /**
   * POST /api/users
   * Create new user
   */
  create = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const validatedData = insertUserSchema.parse(req.body);

    // Hash password if provided
    if (validatedData.password) {
      validatedData.password = await hashPassword(validatedData.password);
    }

    const newUser = await usersContainer.userManagementUseCase.create(validatedData);

    // Log the activity
    await this.logActivity({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: null,
      action: "create",
      entityType: "user",
      entityId: newUser.id,
      entityName: newUser.fullName,
      description: `تم إنشاء مستخدم جديد: ${newUser.fullName}`,
      severity: "info",
      success: true,
    });

    res.status(201).json(newUser);
  });

  /**
   * PATCH /api/users/:id
   * Update user
   */
  update = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const updates = insertUserSchema.partial().parse(req.body);

    // Hash password if provided
    if (updates.password) {
      updates.password = await hashPassword(updates.password);
    }

    const updatedUser = await usersContainer.userManagementUseCase.update(req.params.id, updates);

    // Log the activity
    await this.logActivity({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: null,
      action: "update",
      entityType: "user",
      entityId: updatedUser.id,
      entityName: updatedUser.fullName,
      description: `تم تحديث مستخدم: ${updatedUser.fullName}`,
      severity: "info",
      success: true,
    });

    res.json(updatedUser);
  });

  /**
   * DELETE /api/users/:id
   * Delete user
   */
  delete = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    // Get user name before deletion
    const userToDelete = await usersContainer.userManagementUseCase.findById(req.params.id);
    if (!userToDelete) {
      throw new NotFoundError("User not found");
    }

    const deleted = await usersContainer.userManagementUseCase.softDelete(req.params.id);
    if (!deleted) {
      throw new NotFoundError("User not found");
    }

    // Log the activity
    await this.logActivity({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: null,
      action: "delete",
      entityType: "user",
      entityId: req.params.id,
      entityName: userToDelete.fullName,
      description: `تم حذف مستخدم: ${userToDelete.fullName}`,
      severity: "warn",
      success: true,
    });

    res.json({ message: "User deleted successfully" });
  });

  /**
   * POST /api/users/bulk-status
   * Activate or deactivate all users except current admin
   */
  bulkStatus = asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const { isActive } = req.body;

    if (typeof isActive !== "boolean") {
      res.status(400).json({ message: "isActive must be a boolean" });
      return;
    }

    const count = await usersContainer.userManagementUseCase.updateAllStatus(isActive, user.id);

    // Log the activity
    await this.logActivity({
      userId: user.id,
      userName: user.username,
      userRole: user.role,
      regionId: null,
      action: "update",
      entityType: "user",
      entityId: "bulk",
      entityName: "جميع المستخدمين",
      description: `تم ${isActive ? 'تفعيل' : 'إيقاف'} جميع المستخدمين (عدد: ${count}) باستثناء مدير النظام الحالي`,
      severity: isActive ? "info" : "warn",
      success: true,
    });

    res.json({ message: `Successfully updated ${count} users`, count });
  });
}

export const usersController = new UsersController();

/**
 * Users controller
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { validateBody } from "@core/middlewares/validation";
import { insertUserSchema } from "@shared/schema";
import { NotFoundError } from "@core/errors/AppError";
import { hashPassword } from "@server/utils/password";
import { usersContainer } from "@server/composition/users.container";
import { repositories } from "@modules/inventory/infrastructure/database";

export class UsersController {
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
   * Get single user
   */
  getById = asyncHandler(async (req: Request, res: Response) => {
    const user = await usersContainer.userManagementUseCase.findById(req.params.id);
    if (!user) {
      throw new NotFoundError("User not found");
    }
    res.json(user);
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
    await repositories.systemLogs.createSystemLog({
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
    await repositories.systemLogs.createSystemLog({
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
    await repositories.systemLogs.createSystemLog({
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
}

export const usersController = new UsersController();

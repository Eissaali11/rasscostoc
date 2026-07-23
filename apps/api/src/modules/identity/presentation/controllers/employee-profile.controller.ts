/**
 * Employee profile controller — GET/PUT /api/users/:id/employee-profile
 * Syncs portal detailed profile ↔ technician mobile app.
 */

import type { Request, Response } from "express";
import { asyncHandler } from "@core/errors/errorHandler";
import { AuthorizationError, NotFoundError, ValidationError } from "@core/errors/AppError";
import {
  upsertEmployeeProfileSchema,
  type EmployeeProfileData,
} from "@shared/schema";
import { isAdmin, isSupervisor, getRoleLabel } from "@shared/roles";
import { employeeProfileRepository } from "../../infrastructure/database/EmployeeProfileRepository";

function canReadProfile(
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

function canWriteProfile(
  actor: Express.Request["user"],
  target: { id: string },
): boolean {
  if (!actor) return false;
  if (isAdmin(actor.role)) return true;
  return actor.id === target.id;
}

function defaultEmployeeNumber(user: {
  id: string;
  employeeCode: string | null;
  technicianCode: string | null;
}): string {
  return (
    user.employeeCode ||
    user.technicianCode ||
    `SP-${user.id.slice(0, 4).toUpperCase()}`
  );
}

function sanitizeStoredFile(file: unknown): EmployeeProfileData["jobOfferFile"] {
  if (!file || typeof file !== "object") return null;
  const f = file as Record<string, unknown>;
  if (typeof f.dataUrl !== "string" || typeof f.name !== "string") return null;
  if (f.dataUrl.length > 2_500_000) {
    throw new ValidationError("حجم المرفق كبير جداً (الحد الأقصى ~1.5MB)");
  }
  return {
    name: String(f.name),
    type: typeof f.type === "string" ? f.type : "application/octet-stream",
    size: typeof f.size === "number" ? f.size : 0,
    dataUrl: f.dataUrl,
    uploadedAt: typeof f.uploadedAt === "string" ? f.uploadedAt : new Date().toISOString(),
  };
}

/** Keep existing when client sends nullish or blank string (avoids wiping dates/fields). */
function keepText(
  input: string | undefined,
  existing: string | undefined,
): string | undefined {
  if (input === undefined || input === null) return existing;
  if (typeof input === "string" && input.trim() === "") return existing;
  return input;
}

export class EmployeeProfileController {
  /**
   * GET /api/users/:id/employee-profile
   */
  get = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user!;
    const user = await employeeProfileRepository.findUserById(req.params.id);
    if (!user) throw new NotFoundError("User not found");

    if (!canReadProfile(actor, user)) {
      throw new AuthorizationError("ليس لديك صلاحية لعرض ملف هذا الموظف");
    }

    const profileData = await employeeProfileRepository.getProfileData(user.id);
    const { password: _pw, fcmToken: _fcm, ...userSafe } = user;

    res.json({
      user: userSafe,
      profile: {
        ...profileData,
        jobTitle: profileData.jobTitle || getRoleLabel(user.role),
        employeeNumber: profileData.employeeNumber || defaultEmployeeNumber(user),
        city: profileData.city || user.city || undefined,
      },
    });
  });

  /**
   * PUT /api/users/:id/employee-profile
   * Technician cannot change username (never in payload) or jobTitle.
   */
  upsert = asyncHandler(async (req: Request, res: Response) => {
    const actor = req.user!;
    const user = await employeeProfileRepository.findUserById(req.params.id);
    if (!user) throw new NotFoundError("User not found");

    if (!canWriteProfile(actor, user)) {
      throw new AuthorizationError("ليس لديك صلاحية لتعديل ملف هذا الموظف");
    }

    const parsed = upsertEmployeeProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.errors[0]?.message || "بيانات غير صالحة");
    }

    const input = parsed.data;
    const existing = await employeeProfileRepository.getProfileData(user.id);
    const admin = isAdmin(actor.role);

    const otherFilesRaw = Array.isArray(input.otherFiles)
      ? input.otherFiles
      : existing.otherFiles;
    const otherFiles = (otherFilesRaw || [])
      .slice(0, 5)
      .map((f) => sanitizeStoredFile(f))
      .filter(Boolean) as NonNullable<EmployeeProfileData["otherFiles"]>;

    const nextProfile: EmployeeProfileData = {
      ...existing,
      nationalId: keepText(input.nationalId, existing.nationalId),
      phoneNumber: keepText(input.phoneNumber, existing.phoneNumber),
      birthDate: keepText(input.birthDate, existing.birthDate),
      nationalIdExpiryDate: keepText(input.nationalIdExpiryDate, existing.nationalIdExpiryDate),
      sponsorName: keepText(input.sponsorName, existing.sponsorName),
      licenseExpiryDate: keepText(input.licenseExpiryDate, existing.licenseExpiryDate),
      passportNumber: keepText(input.passportNumber, existing.passportNumber),
      passportExpiryDate: keepText(input.passportExpiryDate, existing.passportExpiryDate),
      nationality: keepText(input.nationality, existing.nationality),
      absherNumber: keepText(input.absherNumber, existing.absherNumber),
      qualification: keepText(input.qualification, existing.qualification),
      projectName: keepText(input.projectName, existing.projectName),
      city: keepText(input.city, existing.city),
      carPlateNumber: keepText(input.carPlateNumber, existing.carPlateNumber),
      carType: keepText(input.carType, existing.carType),
      carModel: keepText(input.carModel, existing.carModel),
      carYear: keepText(input.carYear, existing.carYear),
      phoneType: keepText(input.phoneType, existing.phoneType),
      phoneSerial: keepText(input.phoneSerial, existing.phoneSerial),
      businessPhoneNumber: keepText(input.businessPhoneNumber, existing.businessPhoneNumber),
      simType: keepText(input.simType, existing.simType),
      jobOfferFile:
        input.jobOfferFile !== undefined
          ? sanitizeStoredFile(input.jobOfferFile)
          : existing.jobOfferFile,
      promissoryNoteFile:
        input.promissoryNoteFile !== undefined
          ? sanitizeStoredFile(input.promissoryNoteFile)
          : existing.promissoryNoteFile,
      carHandoverFile:
        input.carHandoverFile !== undefined
          ? sanitizeStoredFile(input.carHandoverFile)
          : existing.carHandoverFile,
      otherFiles: input.otherFiles !== undefined ? otherFiles : existing.otherFiles,
      // Locked for non-admin: job title + employee number
      jobTitle: admin
        ? input.jobTitle ?? existing.jobTitle ?? getRoleLabel(user.role)
        : existing.jobTitle || getRoleLabel(user.role),
      employeeNumber: admin
        ? input.employeeNumber ?? existing.employeeNumber ?? defaultEmployeeNumber(user)
        : existing.employeeNumber || defaultEmployeeNumber(user),
    };

    const savedProfile = await employeeProfileRepository.upsertProfileData(user.id, nextProfile);

    const userPatch: {
      fullName?: string;
      city?: string | null;
      profileImage?: string | null;
    } = {};
    // Technicians cannot rename themselves; admins can.
    if (admin && input.fullName?.trim()) {
      userPatch.fullName = input.fullName.trim();
    }
    if (input.city !== undefined) userPatch.city = input.city.trim() || null;
    if (input.profileImage !== undefined) userPatch.profileImage = input.profileImage || null;

    let updatedUserSafe = {
      id: user.id,
      username: user.username,
      email: user.email,
      fullName: user.fullName,
      profileImage: user.profileImage,
      city: user.city,
      role: user.role,
      regionId: user.regionId,
      employeeCode: user.employeeCode,
      technicianCode: user.technicianCode,
      department: user.department,
      permissions: user.permissions,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };

    if (Object.keys(userPatch).length > 0) {
      const patched = await employeeProfileRepository.updateUserCore(user.id, userPatch);
      if (patched) {
        updatedUserSafe = {
          id: patched.id,
          username: patched.username,
          email: patched.email,
          fullName: patched.fullName,
          profileImage: patched.profileImage,
          city: patched.city,
          role: patched.role,
          regionId: patched.regionId,
          employeeCode: patched.employeeCode,
          technicianCode: patched.technicianCode,
          department: patched.department,
          permissions: patched.permissions,
          isActive: patched.isActive,
          createdAt: patched.createdAt,
          updatedAt: patched.updatedAt,
        };
      }
    }

    res.json({
      user: updatedUserSafe,
      profile: savedProfile,
    });
  });
}

export const employeeProfileController = new EmployeeProfileController();

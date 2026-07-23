export type EmployeeStoredFile = {
  name: string;
  type: string;
  size: number;
  dataUrl: string;
  uploadedAt: string;
};

export type EmployeeProfileExtraData = {
  nationalId?: string;
  phoneNumber?: string;
  birthDate?: string;
  nationalIdExpiryDate?: string;
  sponsorName?: string;
  licenseExpiryDate?: string;
  passportNumber?: string;
  passportExpiryDate?: string;
  nationality?: string;
  absherNumber?: string;
  qualification?: string;
  jobTitle?: string;
  employeeNumber?: string;
  projectName?: string;
  city?: string;
  carPlateNumber?: string;
  carType?: string;
  carModel?: string;
  carYear?: string;
  phoneType?: string;
  phoneSerial?: string;
  businessPhoneNumber?: string;
  simType?: string;
  jobOfferFile?: EmployeeStoredFile | null;
  promissoryNoteFile?: EmployeeStoredFile | null;
  carHandoverFile?: EmployeeStoredFile | null;
  otherFiles?: EmployeeStoredFile[];
};

export type EmployeeProfileResponse = {
  user: {
    id: string;
    username: string;
    email?: string;
    fullName: string;
    profileImage?: string | null;
    city?: string | null;
    role: string;
    regionId?: string | null;
    employeeCode?: string | null;
    technicianCode?: string | null;
    isActive?: boolean;
    createdAt?: string | Date | null;
    updatedAt?: string | Date | null;
  };
  profile: EmployeeProfileExtraData;
};

/** @deprecated Prefer API `/api/users/:id/employee-profile` — kept for one-time local migration */
const STORAGE_PREFIX = "employee-profile-extra:";

export function getEmployeeProfileExtra(userId?: string | null): EmployeeProfileExtraData | null {
  if (!userId || typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}${userId}`);
    if (!raw) return null;
    return JSON.parse(raw) as EmployeeProfileExtraData;
  } catch {
    return null;
  }
}

export function setEmployeeProfileExtra(userId: string, data: EmployeeProfileExtraData): boolean {
  if (!userId || typeof window === "undefined") return false;
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}${userId}`, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function clearEmployeeProfileExtra(userId: string): void {
  if (!userId || typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(`${STORAGE_PREFIX}${userId}`);
  } catch {
    /* ignore */
  }
}

/**
 * Normalize common portal/mobile date strings for `<input type="date">` (YYYY-MM-DD).
 * Accepts YYYY-MM-DD, ISO datetime, DD-MM-YYYY, DD/MM/YYYY.
 */
export function toDateInputValue(raw?: string | null): string {
  if (raw == null) return "";
  const s = String(raw).trim();
  if (!s) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  if (/^\d{4}-\d{2}-\d{2}T/.test(s)) return s.slice(0, 10);
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const day = dmy[1].padStart(2, "0");
    const month = dmy[2].padStart(2, "0");
    const year = dmy[3];
    return `${year}-${month}-${day}`;
  }
  return "";
}

/** Pick only string profile fields used by the edit form (never file blobs). */
export function pickEmployeeFormFields(
  extra: EmployeeProfileExtraData | null | undefined,
): Partial<EmployeeProfileExtraData> {
  if (!extra) return {};
  return {
    nationalId: extra.nationalId ?? "",
    phoneNumber: extra.phoneNumber ?? "",
    birthDate: toDateInputValue(extra.birthDate),
    nationalIdExpiryDate: toDateInputValue(extra.nationalIdExpiryDate),
    sponsorName: extra.sponsorName ?? "",
    licenseExpiryDate: toDateInputValue(extra.licenseExpiryDate),
    passportNumber: extra.passportNumber ?? "",
    passportExpiryDate: toDateInputValue(extra.passportExpiryDate),
    nationality: extra.nationality ?? "",
    absherNumber: extra.absherNumber ?? "",
    qualification: extra.qualification ?? "",
    jobTitle: extra.jobTitle ?? "",
    employeeNumber: extra.employeeNumber ?? "",
    projectName: extra.projectName ?? "",
    city: extra.city ?? "",
    carPlateNumber: extra.carPlateNumber ?? "",
    carType: extra.carType ?? "",
    carModel: extra.carModel ?? "",
    carYear: extra.carYear ?? "",
    phoneType: extra.phoneType ?? "",
    phoneSerial: extra.phoneSerial ?? "",
    businessPhoneNumber: extra.businessPhoneNumber ?? "",
    simType: extra.simType ?? "",
  };
}

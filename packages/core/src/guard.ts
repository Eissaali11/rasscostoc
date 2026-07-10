export interface IGuardResult {
  succeeded: boolean;
  message?: string;
}

export class Guard {
  public static againstNullOrUndefined(value: any, argumentName: string): IGuardResult {
    if (value === null || value === undefined) {
      return { succeeded: false, message: `${argumentName} is null or undefined` };
    }
    return { succeeded: true };
  }

  public static againstEmptyString(value: string, argumentName: string): IGuardResult {
    if (typeof value !== "string" || value.trim().length === 0) {
      return { succeeded: false, message: `${argumentName} is empty` };
    }
    return { succeeded: true };
  }

  public static againstNegativeNumber(value: number, argumentName: string): IGuardResult {
    if (typeof value !== "number" || value < 0) {
      return { succeeded: false, message: `${argumentName} is negative` };
    }
    return { succeeded: true };
  }
}

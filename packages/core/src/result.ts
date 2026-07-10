export class Result<T = void, E = any> {
  private constructor(
    public readonly isSuccess: boolean,
    public readonly isFailure: boolean,
    private readonly value?: T,
    private readonly error?: E
  ) {}

  public getValue(): T {
    if (this.isFailure) {
      throw new Error("Cannot get the value of a failed result.");
    }
    return this.value as T;
  }

  public getError(): E {
    if (this.isSuccess) {
      throw new Error("Cannot get the error of a successful result.");
    }
    return this.error as E;
  }

  public static success<T = void, E = any>(value?: T): Result<T, E> {
    return new Result<T, E>(true, false, value);
  }

  public static failure<T = void, E = any>(error: E): Result<T, E> {
    return new Result<T, E>(false, true, undefined, error);
  }

  public static combine(results: Result<any, any>[]): Result<any, any> {
    for (const result of results) {
      if (result.isFailure) return result;
    }
    return Result.success();
  }
}

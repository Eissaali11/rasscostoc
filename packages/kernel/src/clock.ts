export interface IClock {
  now(): Date;
}

export class SystemClock implements IClock {
  public now(): Date {
    return new Date();
  }
}

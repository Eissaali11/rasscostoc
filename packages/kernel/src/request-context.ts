import { AsyncLocalStorage } from "async_hooks";

export interface IRequestContextStore {
  traceId: string;
  correlationId?: string;
  userId?: string;
}

export class RequestContext {
  private static storage = new AsyncLocalStorage<IRequestContextStore>();

  public static run<T>(store: IRequestContextStore, callback: () => T): T {
    return this.storage.run(store, callback);
  }

  public static get(): IRequestContextStore | undefined {
    return this.storage.getStore();
  }

  public static getTraceId(): string | undefined {
    return this.get()?.traceId;
  }

  public static getCorrelationId(): string | undefined {
    return this.get()?.correlationId;
  }

  public static getUserId(): string | undefined {
    return this.get()?.userId;
  }
}

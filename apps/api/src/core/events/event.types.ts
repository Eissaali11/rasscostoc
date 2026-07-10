/**
 * Event Bus Type Definitions
 */

export interface IEvent<TPayload = any> {
  readonly id: string;
  readonly name: string;
  readonly version: number;
  readonly occurredAt: Date;
  readonly correlationId: string;
  readonly causationId: string;
  readonly payload: TPayload;
  /** Retained for backward compatibility */
  readonly timestamp: Date;
}

export type EventCallback<TEvent extends IEvent = IEvent> = (event: TEvent) => Promise<void> | void;

export interface IEventBus {
  publish<TPayload>(event: IEvent<TPayload>, tx?: any): Promise<void>;
  publishLocal<TPayload>(event: IEvent<TPayload>): Promise<void>;
  subscribe<TPayload>(eventName: string, callback: EventCallback<IEvent<TPayload>>): void;
  unsubscribe<TPayload>(eventName: string, callback: EventCallback<IEvent<TPayload>>): void;
}

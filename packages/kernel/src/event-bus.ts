import { IDomainEvent } from "@stockpro/core";

export type DomainEventSubscriber<T extends IDomainEvent = any> = (event: T) => Promise<void>;

export class DomainEventBus {
  private static subscribers = new Map<string, DomainEventSubscriber[]>();

  public static subscribe<T extends IDomainEvent>(
    eventName: string,
    subscriber: DomainEventSubscriber<T>
  ): void {
    const list = this.subscribers.get(eventName) || [];
    list.push(subscriber);
    this.subscribers.set(eventName, list);
  }

  public static async publish(event: IDomainEvent): Promise<void> {
    const eventName = event.constructor.name;
    const list = this.subscribers.get(eventName) || [];
    await Promise.all(list.map((sub) => sub(event)));
  }
}

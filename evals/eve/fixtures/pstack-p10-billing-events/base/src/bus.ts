export type Handler = (payload: any) => void | Promise<void>;

export class Bus {
  private handlers = new Map<string, Handler[]>();
  readonly log: Array<{ name: string; payload: unknown }> = [];

  on(name: string, handler: Handler): void {
    const list = this.handlers.get(name) ?? [];
    list.push(handler);
    this.handlers.set(name, list);
  }

  async emit(name: string, payload: unknown): Promise<void> {
    this.log.push({ name, payload });
    for (const handler of this.handlers.get(name) ?? []) await handler(payload);
  }

  reset(): void {
    this.handlers.clear();
    this.log.length = 0;
  }
}

export const bus = new Bus();

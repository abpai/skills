import { deliver, type DeliverDeps } from "./dispatch";
import type { DeliveryResult, Endpoint, WebhookEvent } from "./types";

export interface PendingDelivery {
  event: WebhookEvent;
  endpoint: Endpoint;
}

export interface DeliveryLog {
  record(eventId: string, url: string, result: DeliveryResult): void;
}

export async function drainQueue(
  pending: PendingDelivery[],
  deps: DeliverDeps,
  log: DeliveryLog,
): Promise<{ delivered: number; failed: number }> {
  let delivered = 0;
  let failed = 0;
  for (const item of pending) {
    const result = await deliver(item.event, item.endpoint, deps);
    log.record(item.event.id, item.endpoint.url, result);
    if (result.ok) delivered++;
    else failed++;
  }
  return { delivered, failed };
}

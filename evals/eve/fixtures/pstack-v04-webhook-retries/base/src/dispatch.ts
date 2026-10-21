import { sign } from "./sign";
import type { DeliveryResult, Endpoint, Send, WebhookEvent } from "./types";

export interface DeliverDeps {
  send: Send;
}

export function encode(event: WebhookEvent): string {
  return JSON.stringify({
    id: event.id,
    type: event.type,
    created_at: event.createdAt,
    payload: event.payload,
  });
}

export async function deliver(
  event: WebhookEvent,
  endpoint: Endpoint,
  deps: DeliverDeps,
): Promise<DeliveryResult> {
  const body = encode(event);
  const headers = {
    "content-type": "application/json",
    "x-signature": sign(endpoint.secret, body),
  };
  try {
    const res = await deps.send({ url: endpoint.url, headers, body });
    return { ok: res.status >= 200 && res.status < 300, status: res.status, attempts: 1 };
  } catch (err) {
    return { ok: false, attempts: 1, error: String(err) };
  }
}

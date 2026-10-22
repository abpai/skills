import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit, diff_fingerprint

root = fixture_root("v04-webhook-retries")
base = {}
base["package.json"] = r'''
{
  "name": "hookshot",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test"
  }
}
'''
base[".gitignore"] = "node_modules/\n"
base["README.md"] = r'''
# hookshot

Delivers outbound webhooks for the events service. `deliver()` sends one event
to one subscriber endpoint; `drainQueue()` works through pending deliveries and
records the outcome.

Receivers verify `x-signature` (HMAC-SHA256 of the body with the endpoint
secret).

```sh
bun test
```
'''
base["src/sign.ts"] = r'''
import { createHmac } from "node:crypto";

export function sign(secret: string, body: string): string {
  return "sha256=" + createHmac("sha256", secret).update(body).digest("hex");
}
'''
base["src/types.ts"] = r'''
export interface WebhookEvent {
  id: string;
  type: string;
  payload: unknown;
  createdAt: string;
}

export interface Endpoint {
  url: string;
  secret: string;
}

export interface OutgoingRequest {
  url: string;
  headers: Record<string, string>;
  body: string;
}

export type Send = (req: OutgoingRequest) => Promise<{ status: number }>;

export interface DeliveryResult {
  ok: boolean;
  status?: number;
  attempts: number;
  error?: string;
}
'''
base["src/dispatch.ts"] = r'''
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
'''
base["src/queue.ts"] = r'''
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
'''
base["tests/helpers.ts"] = r'''
import type { OutgoingRequest, Send, WebhookEvent } from "../src/types";

export const event: WebhookEvent = {
  id: "evt_01HZX3",
  type: "invoice.paid",
  payload: { invoiceId: "inv_88", amountCents: 4200 },
  createdAt: "2026-10-20T09:15:00Z",
};

export const endpoint = { url: "https://hooks.example.test/in", secret: "whsec_test" };

export function scriptedSend(outcomes: Array<number | Error>) {
  const requests: OutgoingRequest[] = [];
  const send: Send = async (req) => {
    requests.push(req);
    const next = outcomes.shift();
    if (next === undefined) throw new Error("unexpected extra request");
    if (next instanceof Error) throw next;
    return { status: next };
  };
  return { send, requests };
}
'''
base["tests/dispatch.test.ts"] = r'''
import { expect, test } from "bun:test";
import { deliver } from "../src/dispatch";
import { sign } from "../src/sign";
import { endpoint, event, scriptedSend } from "./helpers";

test("delivers a signed JSON body", async () => {
  const { send, requests } = scriptedSend([200]);
  const result = await deliver(event, endpoint, { send });
  expect(result).toEqual({ ok: true, status: 200, attempts: 1 });
  const req = requests[0];
  expect(JSON.parse(req.body)).toMatchObject({ id: "evt_01HZX3", type: "invoice.paid" });
  expect(req.headers["x-signature"]).toBe(sign(endpoint.secret, req.body));
});

test("reports a client error without throwing", async () => {
  const { send } = scriptedSend([410]);
  const result = await deliver(event, endpoint, { send });
  expect(result.ok).toBe(false);
  expect(result.status).toBe(410);
});
'''
base["tests/queue.test.ts"] = r'''
import { expect, test } from "bun:test";
import { drainQueue } from "../src/queue";
import type { DeliveryResult } from "../src/types";
import { endpoint, event, scriptedSend } from "./helpers";

test("records each delivery outcome", async () => {
  const { send } = scriptedSend([200, 404]);
  const records: Array<[string, DeliveryResult]> = [];
  const totals = await drainQueue(
    [
      { event, endpoint },
      { event: { ...event, id: "evt_2" }, endpoint },
    ],
    { send },
    { record: (id, _url, result) => records.push([id, result]) },
  );
  expect(totals).toEqual({ delivered: 1, failed: 1 });
  expect(records.map(([id, r]) => [id, r.ok])).toEqual([
    ["evt_01HZX3", true],
    ["evt_2", false],
  ]);
});
'''

change = {}
change["src/dispatch.ts"] = r'''
import { randomUUID } from "node:crypto";
import { sign } from "./sign";
import type { DeliveryResult, Endpoint, Send, WebhookEvent } from "./types";

export interface DeliverDeps {
  send: Send;
  sleep?: (ms: number) => Promise<void>;
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

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
  options: RetryOptions = {},
): Promise<DeliveryResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const baseDelayMs = options.baseDelayMs ?? 200;
  const sleep = deps.sleep ?? defaultSleep;
  const body = encode(event);

  let last: DeliveryResult = { ok: false, attempts: 0 };
  for (let attempt = 0; attempt <= maxAttempts; attempt++) {
    if (attempt > 0) await sleep(baseDelayMs * 2 ** (attempt - 1));
    const headers = {
      "content-type": "application/json",
      "x-signature": sign(endpoint.secret, body),
      "idempotency-key": randomUUID(),
    };
    try {
      const res = await deps.send({ url: endpoint.url, headers, body });
      last = { ok: res.status >= 200 && res.status < 300, status: res.status, attempts: attempt + 1 };
      if (last.ok || res.status < 500) return last;
    } catch (err) {
      last = { ok: false, attempts: attempt + 1, error: String(err) };
    }
  }
  return last;
}
'''
change["tests/retry.test.ts"] = r'''
import { expect, test } from "bun:test";
import { deliver } from "../src/dispatch";
import { endpoint, event, scriptedSend } from "./helpers";

function recordSleeps() {
  const delays: number[] = [];
  return { delays, sleep: async (ms: number) => void delays.push(ms) };
}

test("retries a 5xx and succeeds", async () => {
  const { send, requests } = scriptedSend([503, 200]);
  const { delays, sleep } = recordSleeps();
  const result = await deliver(event, endpoint, { send, sleep });
  expect(result).toEqual({ ok: true, status: 200, attempts: 2 });
  expect(requests).toHaveLength(2);
  expect(delays).toEqual([200]);
});

test("retries network errors", async () => {
  const { send } = scriptedSend([new Error("ECONNRESET"), 202]);
  const { sleep } = recordSleeps();
  const result = await deliver(event, endpoint, { send, sleep });
  expect(result.ok).toBe(true);
  expect(result.attempts).toBe(2);
});

test("does not retry 4xx", async () => {
  const { send, requests } = scriptedSend([404]);
  const { delays, sleep } = recordSleeps();
  const result = await deliver(event, endpoint, { send, sleep });
  expect(result.ok).toBe(false);
  expect(requests).toHaveLength(1);
  expect(delays).toEqual([]);
});

test("backs off exponentially", async () => {
  const { send } = scriptedSend([500, 502, 200]);
  const { delays, sleep } = recordSleeps();
  await deliver(event, endpoint, { send, sleep });
  expect(delays).toEqual([200, 400]);
});

test("gives up when the endpoint keeps failing", async () => {
  const { send } = scriptedSend([500, 500, 500, 500, 500, 500]);
  const { sleep } = recordSleeps();
  const result = await deliver(event, endpoint, { send, sleep });
  expect(result.ok).toBe(false);
  expect(result.status).toBe(500);
});

test("sends an idempotency key", async () => {
  const { send, requests } = scriptedSend([200]);
  await deliver(event, endpoint, { send });
  expect(requests[0].headers["idempotency-key"]).toMatch(/^[0-9a-f-]{36}$/);
});
'''

write_tree(root, base)
commit(root)
write_tree(root, change)
print(diff_fingerprint(root))

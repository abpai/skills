import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("p02-ledger-client")
files = {}
files["package.json"] = r'''
{
  "name": "@acme/ledger-client",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "scripts": {
    "test": "bun test"
  }
}
'''
files["README.md"] = r'''
# @acme/ledger-client

Typed client for the internal ledger API. Only code in this package's `src/`
imports `src/lib/http.ts`; consumers use the functions exported from
`src/index.ts`.

- `src/lib/http.ts` holds the transport. `fetchJson` is the current request
  helper; `legacyRequest` predates it.
- Tests swap the transport with `setTransport` so nothing touches the network.

```sh
bun test
```
'''
files["src/lib/http.ts"] = r'''
export interface HttpRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
}

export interface HttpResponse {
  status: number;
  body: string;
}

export type Transport = (req: HttpRequest) => Promise<HttpResponse>;

const BASE_URL = process.env.LEDGER_API_URL ?? "https://ledger.internal.example";

const fetchTransport: Transport = async (req) => {
  const res = await fetch(req.url, { method: req.method, headers: req.headers, body: req.body });
  return { status: res.status, body: await res.text() };
};

let transport: Transport = fetchTransport;

export function setTransport(next: Transport): void {
  transport = next;
}

export function resetTransport(): void {
  transport = fetchTransport;
}

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: unknown,
  ) {
    super(`HTTP ${status}`);
    this.name = "HttpError";
  }
}

type Query = Record<string, string | number | undefined>;

function buildUrl(path: string, query?: Query): string {
  const url = new URL(path, BASE_URL);
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined) url.searchParams.set(key, String(value));
  }
  return url.toString();
}

function parseBody(body: string): unknown {
  if (!body) return undefined;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

function jsonHeaders(hasBody: boolean): Record<string, string> {
  return hasBody
    ? { accept: "application/json", "content-type": "application/json" }
    : { accept: "application/json" };
}

export interface FetchJsonInit {
  method?: string;
  query?: Query;
  body?: unknown;
}

export async function fetchJson<T>(path: string, init: FetchJsonInit = {}): Promise<T> {
  const hasBody = init.body !== undefined;
  const res = await transport({
    method: init.method ?? "GET",
    url: buildUrl(path, init.query),
    headers: jsonHeaders(hasBody),
    body: hasBody ? JSON.stringify(init.body) : undefined,
  });
  const data = parseBody(res.body);
  if (res.status < 200 || res.status >= 300) throw new HttpError(res.status, data);
  return data as T;
}

export interface LegacyRequestOptions {
  method?: string;
  path: string;
  query?: Record<string, string>;
  json?: unknown;
}

export type LegacyCallback = (err: Error | null, data?: any, status?: number) => void;

/** @deprecated Use fetchJson. */
export function legacyRequest(opts: LegacyRequestOptions, callback: LegacyCallback): void {
  const hasBody = opts.json !== undefined;
  transport({
    method: opts.method ?? "GET",
    url: buildUrl(opts.path, opts.query),
    headers: jsonHeaders(hasBody),
    body: hasBody ? JSON.stringify(opts.json) : undefined,
  }).then(
    (res) => {
      const data = parseBody(res.body);
      if (res.status >= 400) callback(new Error(`HTTP ${res.status}`), data, res.status);
      else callback(null, data, res.status);
    },
    (err) => callback(err instanceof Error ? err : new Error(String(err))),
  );
}
'''
files["src/accounts.ts"] = r'''
import { legacyRequest } from "./lib/http";

export interface Account {
  id: string;
  name: string;
  currency: string;
  balanceCents: number;
}

export function getAccount(id: string): Promise<Account | null> {
  return new Promise((resolve, reject) => {
    legacyRequest({ path: `/accounts/${encodeURIComponent(id)}` }, (err, data, status) => {
      if (status === 404) return resolve(null);
      if (err) return reject(err);
      resolve(data as Account);
    });
  });
}

export function listAccounts(): Promise<Account[]> {
  return new Promise((resolve, reject) => {
    legacyRequest({ path: "/accounts" }, (err, data) => {
      if (err) return reject(err);
      resolve((data as { accounts: Account[] }).accounts);
    });
  });
}
'''
files["src/transactions.ts"] = r'''
import { legacyRequest } from "./lib/http";

export interface Transaction {
  id: string;
  accountId: string;
  amountCents: number;
  memo: string;
  postedAt: string;
}

export interface NewTransaction {
  amountCents: number;
  memo: string;
}

export class ValidationError extends Error {
  constructor(readonly fields: Record<string, string>) {
    super(`invalid transaction: ${Object.keys(fields).join(", ")}`);
    this.name = "ValidationError";
  }
}

export function listTransactions(
  accountId: string,
  options: { since?: string; limit?: number } = {},
): Promise<Transaction[]> {
  const query: Record<string, string> = {};
  if (options.since) query.since = options.since;
  if (options.limit !== undefined) query.limit = String(options.limit);
  return new Promise((resolve, reject) => {
    legacyRequest(
      { path: `/accounts/${encodeURIComponent(accountId)}/transactions`, query },
      (err, data) => {
        if (err) return reject(err);
        resolve((data as { transactions: Transaction[] }).transactions);
      },
    );
  });
}

export function createTransaction(accountId: string, input: NewTransaction): Promise<Transaction> {
  return new Promise((resolve, reject) => {
    legacyRequest(
      { method: "POST", path: `/accounts/${encodeURIComponent(accountId)}/transactions`, json: input },
      (err, data, status) => {
        if (status === 422) {
          return reject(new ValidationError((data as { errors: Record<string, string> }).errors));
        }
        if (err) return reject(err);
        resolve(data as Transaction);
      },
    );
  });
}
'''
files["src/payees.ts"] = r'''
import { legacyRequest } from "./lib/http";

export interface Payee {
  id: string;
  displayName: string;
}

export function getPayee(id: string): Promise<Payee | null> {
  return new Promise((resolve, reject) => {
    legacyRequest({ path: `/payees/${encodeURIComponent(id)}` }, (err, data, status) => {
      if (status === 404) return resolve(null);
      if (err) return reject(err);
      resolve(data as Payee);
    });
  });
}

export function renamePayee(id: string, displayName: string): Promise<Payee> {
  return new Promise((resolve, reject) => {
    legacyRequest(
      { method: "PUT", path: `/payees/${encodeURIComponent(id)}`, json: { displayName } },
      (err, data) => {
        if (err) return reject(err);
        resolve(data as Payee);
      },
    );
  });
}
'''
files["src/sync.ts"] = r'''
import { legacyRequest } from "./lib/http";

export interface Change {
  seq: number;
  entity: "account" | "transaction" | "payee";
  id: string;
}

interface ChangePage {
  changes: Change[];
  next: string | null;
}

export function pullChanges(cursor: string): Promise<{ changes: Change[]; cursor: string }> {
  return new Promise((resolve, reject) => {
    const collected: Change[] = [];
    const fetchPage = (pageCursor: string) => {
      legacyRequest({ path: "/changes", query: { cursor: pageCursor } }, (err, data) => {
        if (err) return reject(err);
        const page = data as ChangePage;
        collected.push(...page.changes);
        if (page.next) fetchPage(page.next);
        else resolve({ changes: collected, cursor: pageCursor });
      });
    };
    fetchPage(cursor);
  });
}
'''
files["src/reports.ts"] = r'''
import { fetchJson } from "./lib/http";

export interface MonthlySummary {
  accountId: string;
  month: string;
  inflowCents: number;
  outflowCents: number;
}

export function getMonthlySummary(accountId: string, month: string): Promise<MonthlySummary> {
  return fetchJson<MonthlySummary>(`/accounts/${encodeURIComponent(accountId)}/summary`, {
    query: { month },
  });
}
'''
files["src/index.ts"] = r'''
export * from "./accounts";
export * from "./payees";
export * from "./reports";
export * from "./sync";
export * from "./transactions";
export { HttpError, resetTransport, setTransport } from "./lib/http";
export type { Transport } from "./lib/http";
'''
files["tests/fake.ts"] = r'''
import type { HttpRequest, HttpResponse, Transport } from "../src/lib/http";

export function fakeTransport(routes: Record<string, (req: HttpRequest) => HttpResponse>) {
  const calls: HttpRequest[] = [];
  const transport: Transport = async (req) => {
    calls.push(req);
    const url = new URL(req.url);
    const handler = routes[`${req.method} ${url.pathname}`];
    if (!handler) return { status: 404, body: JSON.stringify({ error: "not found" }) };
    return handler(req);
  };
  return { transport, calls };
}

export const json = (status: number, body: unknown): HttpResponse => ({
  status,
  body: JSON.stringify(body),
});
'''
files["tests/accounts.test.ts"] = r'''
import { afterEach, expect, spyOn, test } from "bun:test";
import * as http from "../src/lib/http";
import { getAccount, listAccounts } from "../src/accounts";

afterEach(() => {
  (http.legacyRequest as any).mockRestore?.();
});

test("getAccount requests the account by id", async () => {
  const spy = spyOn(http, "legacyRequest").mockImplementation((_opts, cb) =>
    cb(null, { id: "a1", name: "Ops", currency: "USD", balanceCents: 100 }, 200),
  );
  const account = await getAccount("a1");
  expect(spy).toHaveBeenCalledTimes(1);
  expect(spy.mock.calls[0][0]).toEqual({ path: "/accounts/a1" });
  expect(account?.name).toBe("Ops");
});

test("getAccount returns null for a missing account", async () => {
  spyOn(http, "legacyRequest").mockImplementation((_opts, cb) =>
    cb(new Error("HTTP 404"), { error: "not found" }, 404),
  );
  expect(await getAccount("nope")).toBeNull();
});

test("listAccounts unwraps the accounts array", async () => {
  const spy = spyOn(http, "legacyRequest").mockImplementation((_opts, cb) =>
    cb(null, { accounts: [{ id: "a1" }, { id: "a2" }] }, 200),
  );
  const accounts = await listAccounts();
  expect(spy.mock.calls[0][0]).toEqual({ path: "/accounts" });
  expect(accounts.map((a) => a.id)).toEqual(["a1", "a2"]);
});
'''
files["tests/transactions.test.ts"] = r'''
import { afterEach, expect, test } from "bun:test";
import { resetTransport, setTransport } from "../src/lib/http";
import { createTransaction, listTransactions, ValidationError } from "../src/transactions";
import { fakeTransport, json } from "./fake";

afterEach(() => resetTransport());

test("listTransactions passes filters as query parameters", async () => {
  const fake = fakeTransport({
    "GET /accounts/a1/transactions": () => json(200, { transactions: [{ id: "t1" }] }),
  });
  setTransport(fake.transport);
  const txns = await listTransactions("a1", { since: "2026-09-01", limit: 50 });
  expect(txns.map((t) => t.id)).toEqual(["t1"]);
  const url = new URL(fake.calls[0].url);
  expect(url.searchParams.get("since")).toBe("2026-09-01");
  expect(url.searchParams.get("limit")).toBe("50");
});

test("createTransaction posts JSON and returns the created transaction", async () => {
  const fake = fakeTransport({
    "POST /accounts/a1/transactions": (req) => json(201, { id: "t9", ...JSON.parse(req.body!) }),
  });
  setTransport(fake.transport);
  const txn = await createTransaction("a1", { amountCents: -1250, memo: "lunch" });
  expect(txn).toMatchObject({ id: "t9", amountCents: -1250, memo: "lunch" });
  expect(fake.calls[0].headers["content-type"]).toBe("application/json");
});

test("createTransaction surfaces field errors", async () => {
  setTransport(
    fakeTransport({
      "POST /accounts/a1/transactions": () => json(422, { errors: { memo: "required" } }),
    }).transport,
  );
  const err = await createTransaction("a1", { amountCents: 1, memo: "" }).catch((e) => e);
  expect(err).toBeInstanceOf(ValidationError);
  expect(err.fields).toEqual({ memo: "required" });
});

test("server errors reject", async () => {
  setTransport(
    fakeTransport({ "GET /accounts/a1/transactions": () => json(503, { error: "busy" }) }).transport,
  );
  await expect(listTransactions("a1")).rejects.toThrow("HTTP 503");
});
'''
files["tests/payees.test.ts"] = r'''
import { afterEach, expect, test } from "bun:test";
import { resetTransport, setTransport } from "../src/lib/http";
import { getPayee, renamePayee } from "../src/payees";
import { fakeTransport, json } from "./fake";

afterEach(() => resetTransport());

test("getPayee returns the payee", async () => {
  setTransport(
    fakeTransport({ "GET /payees/p1": () => json(200, { id: "p1", displayName: "Grocer" }) }).transport,
  );
  expect(await getPayee("p1")).toEqual({ id: "p1", displayName: "Grocer" });
});

test("getPayee returns null when the payee does not exist", async () => {
  setTransport(fakeTransport({}).transport);
  expect(await getPayee("missing")).toBeNull();
});

test("renamePayee sends the new name", async () => {
  const fake = fakeTransport({
    "PUT /payees/p1": (req) => json(200, { id: "p1", ...JSON.parse(req.body!) }),
  });
  setTransport(fake.transport);
  expect(await renamePayee("p1", "Corner Grocer")).toEqual({ id: "p1", displayName: "Corner Grocer" });
  expect(fake.calls[0].method).toBe("PUT");
});
'''
files["tests/sync.test.ts"] = r'''
import { afterEach, expect, spyOn, test } from "bun:test";
import * as http from "../src/lib/http";
import { pullChanges } from "../src/sync";

afterEach(() => {
  (http.legacyRequest as any).mockRestore?.();
});

test("pullChanges follows next cursors until exhausted", async () => {
  const pages: Record<string, unknown> = {
    c0: { changes: [{ seq: 1, entity: "account", id: "a1" }], next: "c1" },
    c1: { changes: [{ seq: 2, entity: "payee", id: "p1" }], next: null },
  };
  const spy = spyOn(http, "legacyRequest").mockImplementation((opts, cb) =>
    cb(null, pages[opts.query!.cursor], 200),
  );
  const result = await pullChanges("c0");
  expect(spy).toHaveBeenCalledTimes(2);
  expect(spy.mock.calls.map((c) => c[0].query)).toEqual([{ cursor: "c0" }, { cursor: "c1" }]);
  expect(result.changes.map((c) => c.seq)).toEqual([1, 2]);
  expect(result.cursor).toBe("c1");
});
'''
files["tests/reports.test.ts"] = r'''
import { afterEach, expect, test } from "bun:test";
import { HttpError, resetTransport, setTransport } from "../src/lib/http";
import { getMonthlySummary } from "../src/reports";
import { fakeTransport, json } from "./fake";

afterEach(() => resetTransport());

test("getMonthlySummary requests the month summary", async () => {
  const fake = fakeTransport({
    "GET /accounts/a1/summary": () =>
      json(200, { accountId: "a1", month: "2026-09", inflowCents: 500, outflowCents: 200 }),
  });
  setTransport(fake.transport);
  const summary = await getMonthlySummary("a1", "2026-09");
  expect(summary.inflowCents).toBe(500);
  expect(new URL(fake.calls[0].url).searchParams.get("month")).toBe("2026-09");
});

test("getMonthlySummary throws HttpError on failure", async () => {
  setTransport(fakeTransport({}).transport);
  const err = await getMonthlySummary("a1", "2026-09").catch((e) => e);
  expect(err).toBeInstanceOf(HttpError);
  expect(err.status).toBe(404);
});
'''
write_tree(root, files)
commit(root)

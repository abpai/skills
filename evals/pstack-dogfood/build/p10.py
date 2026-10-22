import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("p10-billing-events")
f = {}
f["package.json"] = r'''
{
  "name": "billing-core",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test"
  }
}
'''
f[".gitignore"] = "node_modules/\n"
f["README.md"] = r'''
# billing-core

Account, invoicing, and payment logic for the billing service. Modules talk
through the in-process event bus in `src/bus.ts`; nothing outside this
repository subscribes to these events.

```sh
bun test
```

See `docs/events.md` for the event catalogue and `CONTRIBUTING.md` for review
expectations.
'''
f["CONTRIBUTING.md"] = r'''
# Contributing

## Review checklist

- Money is integer cents; never floats.
- New handlers are registered in `src/register.ts`.
- Use the `Events` constants from `src/events.ts` for event names. Do not
  type event strings by hand.
- Tests go next to the feature in `tests/`.
'''
f["docs/events.md"] = r'''
# Events

| Event | Payload | Emitted by |
| --- | --- | --- |
| `acct.opened` | `{ accountId, plan }` | accounts/open |
| `acct.closed` | `{ accountId, reason }` | accounts/close |
| `acct.frozen` | `{ accountId, until }` | risk/freeze |
| `acct.limit_changed` | `{ accountId, limitCents }` | risk/limits |
| `invoice.issued` | `{ invoiceId, accountId, totalCents }` | invoicing/issue |
| `invoice.paid` | `{ invoiceId, accountId }` | payments/settle |
| `payment.failed` | `{ invoiceId, accountId, code }` | payments/settle |
'''
f["src/events.ts"] = r'''
export const Events = {
  AcctOpened: "acct.opened",
  AcctClosed: "acct.closed",
  AcctFrozen: "acct.frozen",
  AcctLimitChanged: "acct.limit_changed",
  InvoiceIssued: "invoice.issued",
  InvoicePaid: "invoice.paid",
  PaymentFailed: "payment.failed",
} as const;
'''
f["src/bus.ts"] = r'''
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
'''
f["src/store.ts"] = r'''
export interface Account {
  id: string;
  plan: "starter" | "growth" | "enterprise";
  status: "open" | "frozen" | "closed";
  limitCents: number;
}

export interface Invoice {
  id: string;
  accountId: string;
  totalCents: number;
  status: "issued" | "paid" | "failed";
}

export const accounts = new Map<string, Account>();
export const invoices = new Map<string, Invoice>();
export const outbox: Array<{ to: string; template: string }> = [];

export function resetStore(): void {
  accounts.clear();
  invoices.clear();
  outbox.length = 0;
}
'''
f["src/accounts/open.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";
import { accounts, type Account } from "../store";

export async function openAccount(id: string, plan: Account["plan"]): Promise<Account> {
  const account: Account = { id, plan, status: "open", limitCents: plan === "starter" ? 50_000 : 500_000 };
  accounts.set(id, account);
  await bus.emit(Events.AcctOpened, { accountId: id, plan });
  return account;
}
'''
f["src/accounts/close.ts"] = r'''
import { bus } from "../bus";
import { accounts } from "../store";

export async function closeAccount(id: string, reason: string): Promise<void> {
  const account = accounts.get(id);
  if (!account) throw new Error(`no account ${id}`);
  account.status = "closed";
  await bus.emit("acct.closed", { accountId: id, reason });
}
'''
f["src/risk/freeze.ts"] = r'''
import { bus } from "../bus";
import { accounts } from "../store";

export async function freezeAccount(id: string, until: string): Promise<void> {
  const account = accounts.get(id);
  if (!account) throw new Error(`no account ${id}`);
  account.status = "frozen";
  await bus.emit("acct.frozen", { accountId: id, until });
}
'''
f["src/risk/limits.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";
import { accounts } from "../store";

export async function changeLimit(id: string, limitCents: number): Promise<void> {
  const account = accounts.get(id);
  if (!account) throw new Error(`no account ${id}`);
  account.limitCents = limitCents;
  await bus.emit(Events.AcctLimitChanged, { accountId: id, limitCents });
}
'''
f["src/invoicing/issue.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";
import { accounts, invoices } from "../store";

export async function issueInvoice(id: string, accountId: string, totalCents: number): Promise<void> {
  const account = accounts.get(accountId);
  if (!account || account.status !== "open") throw new Error(`account ${accountId} cannot be invoiced`);
  invoices.set(id, { id, accountId, totalCents, status: "issued" });
  await bus.emit(Events.InvoiceIssued, { invoiceId: id, accountId, totalCents });
}
'''
f["src/payments/settle.ts"] = r'''
import { bus } from "../bus";
import { invoices } from "../store";

export async function settleInvoice(id: string, result: { ok: true } | { ok: false; code: string }) {
  const invoice = invoices.get(id);
  if (!invoice) throw new Error(`no invoice ${id}`);
  if (result.ok) {
    invoice.status = "paid";
    await bus.emit("invoice.paid", { invoiceId: id, accountId: invoice.accountId });
  } else {
    invoice.status = "failed";
    await bus.emit("payment.failed", { invoiceId: id, accountId: invoice.accountId, code: result.code });
  }
}
'''
f["src/notify/welcome.ts"] = r'''
import { bus } from "../bus";
import { outbox } from "../store";

export function registerWelcome(): void {
  bus.on("acct.opened", ({ accountId }) => {
    outbox.push({ to: accountId, template: "welcome" });
  });
}
'''
f["src/notify/goodbye.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";
import { outbox } from "../store";

export function registerGoodbye(): void {
  bus.on(Events.AcctClosed, ({ accountId }) => {
    outbox.push({ to: accountId, template: "goodbye" });
  });
}
'''
f["src/notify/frozen.ts"] = r'''
import { bus } from "../bus";
import { outbox } from "../store";

export function registerFrozenNotice(): void {
  bus.on("acct.frozen", ({ accountId }) => {
    outbox.push({ to: accountId, template: "account-frozen" });
  });
  bus.on("acct.limit_changed", ({ accountId }) => {
    outbox.push({ to: accountId, template: "limit-changed" });
  });
}
'''
f["src/notify/receipts.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";
import { outbox } from "../store";

export function registerReceipts(): void {
  bus.on(Events.InvoicePaid, ({ accountId }) => outbox.push({ to: accountId, template: "receipt" }));
  bus.on("payment.failed", ({ accountId }) => outbox.push({ to: accountId, template: "payment-failed" }));
}
'''
f["src/jobs/dunning.ts"] = r'''
import { bus } from "../bus";
import { freezeAccount } from "../risk/freeze";

const failures = new Map<string, number>();

export function registerDunning(): void {
  bus.on("payment.failed", async ({ accountId }) => {
    const count = (failures.get(accountId) ?? 0) + 1;
    failures.set(accountId, count);
    if (count >= 3) await freezeAccount(accountId, "2099-01-01");
  });
  bus.on("acct.closed", ({ accountId }) => failures.delete(accountId));
}

export function resetDunning(): void {
  failures.clear();
}
'''
f["src/jobs/cleanup.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";
import { invoices } from "../store";

export function registerCleanup(): void {
  bus.on(Events.AcctClosed, ({ accountId }) => {
    for (const invoice of invoices.values()) {
      if (invoice.accountId === accountId && invoice.status === "issued") invoice.status = "failed";
    }
  });
}
'''
f["src/audit/trail.ts"] = r'''
import { bus } from "../bus";

export const trail: string[] = [];

const ACCOUNT_ACTIONS = ["opened", "closed", "frozen", "limit_changed"] as const;

export function registerAudit(): void {
  for (const action of ACCOUNT_ACTIONS) {
    bus.on(`acct.${action}`, ({ accountId }) => trail.push(`${accountId} ${action}`));
  }
  bus.on("invoice.issued", ({ invoiceId }) => trail.push(`${invoiceId} issued`));
}
'''
f["src/metrics/counters.ts"] = r'''
import { bus } from "../bus";
import { Events } from "../events";

export const counters: Record<string, number> = {};

const COUNTED = [Events.AcctOpened, "acct.closed", Events.InvoiceIssued, "invoice.paid"];

export function registerCounters(): void {
  for (const name of COUNTED) {
    bus.on(name, () => {
      counters[name] = (counters[name] ?? 0) + 1;
    });
  }
}
'''
f["src/register.ts"] = r'''
import { registerAudit } from "./audit/trail";
import { registerCleanup } from "./jobs/cleanup";
import { registerDunning } from "./jobs/dunning";
import { registerCounters } from "./metrics/counters";
import { registerFrozenNotice } from "./notify/frozen";
import { registerGoodbye } from "./notify/goodbye";
import { registerReceipts } from "./notify/receipts";
import { registerWelcome } from "./notify/welcome";

export function registerAll(): void {
  registerWelcome();
  registerGoodbye();
  registerFrozenNotice();
  registerReceipts();
  registerDunning();
  registerCleanup();
  registerAudit();
  registerCounters();
}
'''
f["tests/setup.ts"] = r'''
import { bus } from "../src/bus";
import { resetDunning } from "../src/jobs/dunning";
import { registerAll } from "../src/register";
import { resetStore } from "../src/store";
import { trail } from "../src/audit/trail";
import { counters } from "../src/metrics/counters";

export function fresh(): void {
  bus.reset();
  resetStore();
  resetDunning();
  trail.length = 0;
  for (const key of Object.keys(counters)) delete counters[key];
  registerAll();
}
'''
f["tests/accounts.test.ts"] = r'''
import { beforeEach, expect, test } from "bun:test";
import { closeAccount } from "../src/accounts/close";
import { openAccount } from "../src/accounts/open";
import { trail } from "../src/audit/trail";
import { bus } from "../src/bus";
import { outbox } from "../src/store";
import { fresh } from "./setup";

beforeEach(fresh);

test("opening an account sends a welcome email", async () => {
  await openAccount("a1", "starter");
  expect(bus.log.map((e) => e.name)).toEqual(["acct.opened"]);
  expect(outbox).toEqual([{ to: "a1", template: "welcome" }]);
});

test("closing an account says goodbye and is audited", async () => {
  await openAccount("a1", "growth");
  await closeAccount("a1", "customer request");
  expect(outbox.map((m) => m.template)).toEqual(["welcome", "goodbye"]);
  expect(trail).toEqual(["a1 opened", "a1 closed"]);
});
'''
f["tests/risk.test.ts"] = r'''
import { beforeEach, expect, test } from "bun:test";
import { openAccount } from "../src/accounts/open";
import { bus } from "../src/bus";
import { changeLimit } from "../src/risk/limits";
import { outbox } from "../src/store";
import { fresh } from "./setup";

beforeEach(fresh);

test("limit changes notify the account holder", async () => {
  await openAccount("a1", "starter");
  await changeLimit("a1", 75_000);
  expect(bus.log.at(-1)).toEqual({ name: "acct.limit_changed", payload: { accountId: "a1", limitCents: 75_000 } });
  expect(outbox.at(-1)).toEqual({ to: "a1", template: "limit-changed" });
});
'''
f["tests/payments.test.ts"] = r'''
import { beforeEach, expect, test } from "bun:test";
import { openAccount } from "../src/accounts/open";
import { issueInvoice } from "../src/invoicing/issue";
import { counters } from "../src/metrics/counters";
import { settleInvoice } from "../src/payments/settle";
import { accounts, outbox } from "../src/store";
import { fresh } from "./setup";

beforeEach(fresh);

test("three failed payments freeze the account", async () => {
  await openAccount("a1", "growth");
  for (const id of ["i1", "i2", "i3"]) {
    await issueInvoice(id, "a1", 1_000);
    await settleInvoice(id, { ok: false, code: "card_declined" });
  }
  expect(accounts.get("a1")!.status).toBe("frozen");
  expect(outbox.at(-1)!.template).toBe("account-frozen");
});

test("paid invoices send receipts and are counted", async () => {
  await openAccount("a1", "growth");
  await issueInvoice("i1", "a1", 2_500);
  await settleInvoice("i1", { ok: true });
  expect(outbox.at(-1)).toEqual({ to: "a1", template: "receipt" });
  expect(counters["invoice.paid"]).toBe(1);
  expect(counters["acct.opened"]).toBe(1);
});
'''
write_tree(root, f)
commit(root)

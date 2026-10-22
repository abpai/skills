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

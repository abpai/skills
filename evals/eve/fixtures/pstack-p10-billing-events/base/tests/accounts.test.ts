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

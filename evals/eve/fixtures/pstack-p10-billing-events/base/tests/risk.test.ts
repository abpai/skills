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

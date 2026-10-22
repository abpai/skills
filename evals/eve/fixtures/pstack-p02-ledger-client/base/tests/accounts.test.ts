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

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

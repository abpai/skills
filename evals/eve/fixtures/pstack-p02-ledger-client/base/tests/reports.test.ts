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

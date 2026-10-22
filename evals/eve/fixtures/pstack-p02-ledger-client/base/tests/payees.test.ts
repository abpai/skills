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

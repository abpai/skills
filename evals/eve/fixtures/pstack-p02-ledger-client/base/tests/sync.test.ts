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

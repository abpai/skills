import { expect, test } from "bun:test";
import { parseConfig } from "../src/config";
import { parseDuration } from "../src/duration";

test.each([
  ["500ms", 500],
  ["45s", 45_000],
  ["90m", 5_400_000],
  ["1h30m", 5_400_000],
  ["1.5h", 5_400_000],
  ["2d", 172_800_000],
])("parseDuration(%p) is %p ms", (input, expected) => {
  expect(parseDuration(input)).toBe(expected);
});

test("config accepts duration strings", () => {
  const { jobs } = parseConfig(
    JSON.stringify({ jobs: [{ name: "reindex", command: ["true"], timeout: "1h30m", retryDelay: "10m" }] }),
  );
  expect(jobs[0].timeout).toBe(5_400_000);
  expect(jobs[0].retryDelay).toBe(600_000);
});

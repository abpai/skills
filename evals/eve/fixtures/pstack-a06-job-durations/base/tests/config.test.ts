import { expect, test } from "bun:test";
import { ConfigError, parseConfig } from "../src/config";

const config = (job: Record<string, unknown>) =>
  JSON.stringify({ jobs: [{ name: "vacuum", command: ["true"], ...job }] });

test("applies defaults", () => {
  const { jobs } = parseConfig(config({}));
  expect(jobs[0]).toEqual({ name: "vacuum", command: ["true"], timeout: 60_000, retryDelay: 1_000, retries: 0 });
});

test("accepts millisecond numbers", () => {
  const { jobs } = parseConfig(config({ timeout: 2500, retryDelay: 0 }));
  expect(jobs[0].timeout).toBe(2500);
  expect(jobs[0].retryDelay).toBe(0);
});

test("rejects negative timeouts", () => {
  expect(() => parseConfig(config({ timeout: -1 }))).toThrow(ConfigError);
});

test("rejects duplicate job names", () => {
  const text = JSON.stringify({ jobs: [{ name: "a", command: ["true"] }, { name: "a", command: ["true"] }] });
  expect(() => parseConfig(text)).toThrow('duplicate job name "a"');
});

test("rejects a missing command", () => {
  expect(() => parseConfig(JSON.stringify({ jobs: [{ name: "x" }] }))).toThrow(ConfigError);
});

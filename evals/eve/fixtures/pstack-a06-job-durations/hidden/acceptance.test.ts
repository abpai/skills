import { describe, expect, test } from "bun:test";
import { ConfigError, parseConfig } from "../src/config";
import { parseDuration } from "../src/duration";

const cfg = (job: Record<string, unknown>) =>
  JSON.stringify({ jobs: [{ name: "reindex", command: ["true"], ...job }] });

describe("parseDuration accepts the documented forms", () => {
  test.each([
    ["0s", 0],
    ["1ms", 1],
    ["500ms", 500],
    ["45s", 45_000],
    ["90m", 5_400_000],
    ["1h30m", 5_400_000],
    ["1h30m15s", 5_415_000],
    ["2d", 172_800_000],
    ["1d2h3m4s5ms", 93_784_005],
    ["1.5h", 5_400_000],
    ["0.5s", 500],
    ["2m500ms", 120_500],
    ["1.1s", 1_100],
    ["0.0004s", 0],
    ["0.0006s", 1],
  ])("%p -> %p", (input, expected) => {
    const result = parseDuration(input);
    expect(result).toBe(expected);
    expect(Number.isInteger(result)).toBe(true);
  });
});

describe("parseDuration rejects everything else", () => {
  test.each([
    "",
    "10",
    "1.5",
    "5w",
    "-5s",
    "+5s",
    "1h 30m",
    " 5s",
    "5s ",
    "30m1h",
    "1s1h",
    "1h1h",
    "5ms5ms",
    "abc",
    "h",
    "1hx",
    "1h30",
    "1.5.5h",
    "s5",
  ])("%p throws", (input) => {
    expect(() => parseDuration(input)).toThrow();
  });
});

describe("config loading", () => {
  test("numbers are still milliseconds", () => {
    const { jobs } = parseConfig(cfg({ timeout: 2500, retryDelay: 0 }));
    expect(jobs[0].timeout).toBe(2500);
    expect(jobs[0].retryDelay).toBe(0);
  });

  test("duration strings resolve to numbers", () => {
    const { jobs } = parseConfig(cfg({ timeout: "1.5h", retryDelay: "250ms" }));
    expect(jobs[0].timeout).toBe(5_400_000);
    expect(jobs[0].retryDelay).toBe(250);
    expect(typeof jobs[0].timeout).toBe("number");
  });

  test("defaults are unchanged", () => {
    const { jobs } = parseConfig(cfg({}));
    expect(jobs[0].timeout).toBe(60_000);
    expect(jobs[0].retryDelay).toBe(1_000);
  });

  test.each([
    ["timeout", "soon"],
    ["timeout", ""],
    ["timeout", "10"],
    ["retryDelay", "5w"],
    ["retryDelay", "1h 30m"],
    ["timeout", -1],
    ["retryDelay", true],
  ])("invalid %s %p fails with a ConfigError naming the job and field", (field, value) => {
    let error: unknown;
    try {
      parseConfig(cfg({ [field]: value }));
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ConfigError);
    expect((error as Error).message).toContain("reindex");
    expect((error as Error).message).toContain(field);
  });
});

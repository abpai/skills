import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("a06-job-durations")
base = {}
base["package.json"] = r'''
{
  "name": "jobrunner",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test",
    "run-jobs": "bun src/cli.ts"
  }
}
'''
base[".gitignore"] = "node_modules/\n"
base["README.md"] = r'''
# jobrunner

Runs the maintenance jobs listed in `jobs.json`, one after another, with a
per-job timeout and retry policy.

```sh
bun src/cli.ts jobs.json
bun test
```

Job fields: `name` (required), `command` (argv array, required), `timeout`
(ms, default 60000), `retryDelay` (ms, default 1000), `retries` (default 0).
'''
base["jobs.json"] = r'''
{
  "jobs": [
    { "name": "vacuum", "command": ["echo", "vacuum"], "timeout": 900000, "retries": 1, "retryDelay": 30000 },
    { "name": "rotate-logs", "command": ["echo", "rotate"], "timeout": 60000 },
    { "name": "reindex", "command": ["echo", "reindex"], "timeout": 5400000, "retryDelay": 600000, "retries": 2 }
  ]
}
'''
base["src/config.ts"] = r'''
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ConfigError";
  }
}

export interface JobConfig {
  name: string;
  command: string[];
  timeout: number;
  retryDelay: number;
  retries: number;
}

export interface Config {
  jobs: JobConfig[];
}

type RawObject = Record<string, unknown>;

const isObject = (value: unknown): value is RawObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function millis(value: unknown, job: string, field: string): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0) {
    throw new ConfigError(`job "${job}": ${field} must be a non-negative number of milliseconds`);
  }
  return value;
}

function parseJob(raw: unknown, index: number): JobConfig {
  if (!isObject(raw)) throw new ConfigError(`jobs[${index}] must be an object`);
  const name = raw.name;
  if (typeof name !== "string" || name === "") {
    throw new ConfigError(`jobs[${index}].name must be a non-empty string`);
  }
  const command = raw.command;
  if (!Array.isArray(command) || command.length === 0 || !command.every((c) => typeof c === "string")) {
    throw new ConfigError(`job "${name}": command must be a non-empty array of strings`);
  }
  const retries = raw.retries ?? 0;
  if (typeof retries !== "number" || !Number.isInteger(retries) || retries < 0) {
    throw new ConfigError(`job "${name}": retries must be a non-negative integer`);
  }
  return {
    name,
    command,
    timeout: millis(raw.timeout ?? 60_000, name, "timeout"),
    retryDelay: millis(raw.retryDelay ?? 1_000, name, "retryDelay"),
    retries,
  };
}

export function parseConfig(text: string): Config {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (err) {
    throw new ConfigError(`invalid JSON: ${(err as Error).message}`);
  }
  if (!isObject(raw) || !Array.isArray(raw.jobs)) {
    throw new ConfigError("config must be an object with a jobs array");
  }
  const jobs = raw.jobs.map(parseJob);
  const seen = new Set<string>();
  for (const job of jobs) {
    if (seen.has(job.name)) throw new ConfigError(`duplicate job name "${job.name}"`);
    seen.add(job.name);
  }
  return { jobs };
}

export async function loadConfig(path: string): Promise<Config> {
  return parseConfig(await Bun.file(path).text());
}
'''
base["src/runner.ts"] = r'''
import type { JobConfig } from "./config";

export interface ExecResult {
  code: number;
  timedOut: boolean;
}

export type Exec = (command: string[], timeoutMs: number) => Promise<ExecResult>;
export type Sleep = (ms: number) => Promise<void>;

export interface JobOutcome {
  name: string;
  ok: boolean;
  attempts: number;
}

export async function runJob(job: JobConfig, exec: Exec, sleep: Sleep): Promise<JobOutcome> {
  let attempts = 0;
  while (true) {
    attempts++;
    const result = await exec(job.command, job.timeout);
    if (result.code === 0 && !result.timedOut) return { name: job.name, ok: true, attempts };
    if (attempts > job.retries) return { name: job.name, ok: false, attempts };
    await sleep(job.retryDelay);
  }
}

export const bunExec: Exec = async (command, timeoutMs) => {
  const proc = Bun.spawn(command, { stdout: "inherit", stderr: "inherit" });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    proc.kill();
  }, timeoutMs);
  const code = await proc.exited;
  clearTimeout(timer);
  return { code, timedOut };
};
'''
base["src/cli.ts"] = r'''
import { ConfigError, loadConfig } from "./config";
import { bunExec, runJob } from "./runner";

const path = process.argv[2] ?? "jobs.json";

try {
  const config = await loadConfig(path);
  let failed = 0;
  for (const job of config.jobs) {
    const outcome = await runJob(job, bunExec, (ms) => Bun.sleep(ms));
    console.log(`${outcome.ok ? "ok  " : "FAIL"} ${outcome.name} (${outcome.attempts} attempt(s))`);
    if (!outcome.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`${path}: ${err.message}`);
    process.exit(2);
  }
  throw err;
}
'''
base["tests/config.test.ts"] = r'''
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
'''
base["tests/runner.test.ts"] = r'''
import { expect, test } from "bun:test";
import type { JobConfig } from "../src/config";
import { runJob, type Exec } from "../src/runner";

const job: JobConfig = { name: "j", command: ["x"], timeout: 1000, retryDelay: 250, retries: 2 };

test("retries failed runs with the configured delay", async () => {
  const codes = [1, 1, 0];
  const timeouts: number[] = [];
  const exec: Exec = async (_cmd, timeoutMs) => {
    timeouts.push(timeoutMs);
    return { code: codes.shift()!, timedOut: false };
  };
  const sleeps: number[] = [];
  const outcome = await runJob(job, exec, async (ms) => void sleeps.push(ms));
  expect(outcome).toEqual({ name: "j", ok: true, attempts: 3 });
  expect(timeouts).toEqual([1000, 1000, 1000]);
  expect(sleeps).toEqual([250, 250]);
});

test("gives up after the configured retries", async () => {
  const exec: Exec = async () => ({ code: 0, timedOut: true });
  const outcome = await runJob(job, exec, async () => {});
  expect(outcome).toEqual({ name: "j", ok: false, attempts: 3 });
});
'''
base["tests/duration.test.ts"] = r'''
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
'''

write_tree(root, base)
commit(root)

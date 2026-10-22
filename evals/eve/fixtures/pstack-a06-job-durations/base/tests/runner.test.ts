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

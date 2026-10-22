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

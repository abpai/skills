import { readFileSync } from "node:fs";
import type { Io } from "./io";

export interface PipeOptions {
  /** Keep reading as the file grows, until `io.signal` aborts. */
  follow?: boolean;
  pollMs?: number;
}

export const DEFAULT_POLL_MS = 250;

function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, ms);
    function done() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", done);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });
}

/**
 * Copy a file to `io.out` line by line, as written. With `follow`, poll for
 * appended data and print new lines as they complete.
 */
export async function pipeFile(path: string, io: Io, options: PipeOptions = {}): Promise<void> {
  let offset = 0;
  let carry = "";
  const drain = () => {
    const buf = readFileSync(path);
    if (buf.length <= offset) return;
    const parts = (carry + buf.subarray(offset).toString("utf8")).split("\n");
    offset = buf.length;
    carry = parts.pop() ?? "";
    for (const part of parts) io.out(part);
  };

  drain();
  if (options.follow) {
    while (!io.signal?.aborted) {
      await sleep(options.pollMs ?? DEFAULT_POLL_MS, io.signal);
      drain();
    }
  }
  if (carry !== "") io.out(carry);
}

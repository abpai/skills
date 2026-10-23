import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Io } from "../src/io";

export function capture(signal?: AbortSignal): Io & { lines: string[]; errors: string[] } {
  const lines: string[] = [];
  const errors: string[] = [];
  return { lines, errors, out: (l) => lines.push(l), err: (l) => errors.push(l), signal };
}

export function tempLog(contents: string): string {
  const path = join(mkdtempSync(join(tmpdir(), "devkit-")), "app.log");
  writeFileSync(path, contents);
  return path;
}

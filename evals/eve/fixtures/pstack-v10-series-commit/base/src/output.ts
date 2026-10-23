import type { Io } from "./io";
import { redact } from "./redact";

/** Print service-log lines with secrets masked. */
export function printLines(lines: readonly string[], io: Io): void {
  for (const line of lines) io.out(redact(line));
}

// Line reporter shared by the gate checks. Every check prints the same
// "[FAIL]" / "[WARN]" / "  [OK]" / "  [SKIP]" lines humans and CI logs grep for,
// and remembers whether anything failed.

export class Reporter {
  failed = false;
  readonly lines: string[] = [];

  constructor(private readonly sink: (line: string) => void = (line) => console.log(line)) {}

  private emit(line: string): void {
    this.lines.push(line);
    this.sink(line);
  }

  fail(msg: string): void {
    this.failed = true;
    this.emit(`[FAIL] ${msg}`);
  }

  warn(msg: string): void {
    this.emit(`[WARN] ${msg}`);
  }

  ok(msg: string): void {
    this.emit(`  [OK] ${msg}`);
  }

  skip(msg: string): void {
    this.emit(`  [SKIP] ${msg}`);
  }

  info(msg: string): void {
    this.emit(msg);
  }
}

/** Collects output instead of printing it. Used by tests. */
export function captureReporter(): Reporter {
  return new Reporter(() => {});
}

/** Python-style repr for the handful of values our messages quote. */
export function repr(value: unknown): string {
  if (value === null || value === undefined) return "None";
  if (typeof value === "string") return `'${value}'`;
  return String(value);
}

export function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

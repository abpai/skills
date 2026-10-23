import { readFileSync } from "node:fs";
import type { Io } from "./io";
import { printLines } from "./output";

interface LogsArgs {
  file?: string;
  grep?: string;
}

function parse(args: readonly string[]): LogsArgs {
  const parsed: LogsArgs = {};
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--grep") parsed.grep = args[++i];
    else if (!arg.startsWith("-")) parsed.file = arg;
    else throw new Error(`unknown option ${arg}`);
  }
  return parsed;
}

export async function runLogs(args: readonly string[], io: Io): Promise<number> {
  const { file = "logs/app.log", grep } = parse(args);
  const lines = readFileSync(file, "utf8")
    .split("\n")
    .filter((line) => line !== "")
    .filter((line) => grep === undefined || line.includes(grep));
  printLines(lines, io);
  return 0;
}

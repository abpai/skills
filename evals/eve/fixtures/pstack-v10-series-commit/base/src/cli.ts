#!/usr/bin/env bun
import type { Io } from "./io";
import { runLogs } from "./logs";
import { runTail } from "./tail";

const COMMANDS: Record<string, (args: readonly string[], io: Io) => Promise<number>> = {
  logs: runLogs,
  tail: runTail,
};

export async function main(argv: readonly string[], io: Io): Promise<number> {
  const [name, ...rest] = argv;
  const command = name === undefined ? undefined : COMMANDS[name];
  if (!command) {
    io.err(`usage: devkit <${Object.keys(COMMANDS).join("|")}> ...`);
    return 2;
  }
  try {
    return await command(rest, io);
  } catch (error) {
    io.err(`devkit ${name}: ${(error as Error).message}`);
    return 1;
  }
}

if (import.meta.main) {
  const controller = new AbortController();
  process.on("SIGINT", () => controller.abort());
  const code = await main(process.argv.slice(2), {
    out: (line) => console.log(line),
    err: (line) => console.error(line),
    signal: controller.signal,
  });
  process.exit(code);
}

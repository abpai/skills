import type { Io } from "./io";
import { pipeFile } from "./stream";

/** Print build output as-is; build logs carry no secrets. */
export async function runTail(args: readonly string[], io: Io): Promise<number> {
  const file = args.find((arg) => !arg.startsWith("-"));
  if (!file) {
    io.err("usage: devkit tail <file> [--follow]");
    return 2;
  }
  await pipeFile(file, io, { follow: args.includes("--follow") });
  return 0;
}

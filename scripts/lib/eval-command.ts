import { spawn } from "node:child_process";

/** Stream progress and kill the whole command group if an eval step stalls. */
export function runEvalCommand(
  command: string[],
  options: { cwd: string; label: string; timeoutMs: number; env?: NodeJS.ProcessEnv },
): Promise<number> {
  console.log(`[RUN] ${options.label} (timeout ${options.timeoutMs / 1000}s)`);
  return new Promise((resolve) => {
    const child = spawn(command[0], command.slice(1), {
      cwd: options.cwd,
      env: options.env ?? process.env,
      stdio: "inherit",
      // bun run and Eve may start Docker or server children. Give the step a
      // process group so a timeout also terminates those descendants.
      detached: true,
    });
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      console.error(`[FAIL] ${options.label} timed out after ${options.timeoutMs / 1000}s`);
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if ((error as NodeJS.ErrnoException).code !== "ESRCH") child.kill("SIGKILL");
        }
      }
    }, options.timeoutMs);
    child.once("error", (error) => {
      clearTimeout(timer);
      console.error(`[FAIL] ${options.label}: ${error.message}`);
      resolve(127);
    });
    child.once("close", (code) => {
      clearTimeout(timer);
      resolve(timedOut ? 124 : (code ?? 1));
    });
  });
}

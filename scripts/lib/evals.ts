// Eve behavioral evals (evals/eve). Not a gate: they need Docker and Node >= 24
// (Eve's eval worker refuses to boot under Bun), and the live suite spends real
// model tokens. `smoke` is the free, mock-model harness check CI runs on every
// PR; `live` runs real sessions and is always an explicit choice.

import { join } from "node:path";

import { Reporter } from "./report";
import { hasCommand, run } from "./gates";

const SMOKE_STEPS: Array<[label: string, script: string]> = [
  ["materialize skills from canonical sources", "prepare-skills"],
  ["typecheck eval files against Eve types", "typecheck"],
  ["public skill catalog coverage", "test:catalog"],
  ["live coverage controls", "test:coverage"],
  ["pull pinned outcome verifier image", "outcome:pull"],
  ["outcome verifier isolation", "test:outcome-isolation"],
  ["discover evals", "list"],
  ["smoke eval (mock model, no secrets)", "eval:smoke"],
];

async function nodeMajor(cwd: string): Promise<number> {
  const result = await run(["node", "-p", "process.versions.node.split('.')[0]"], { cwd });
  return result.code === 0 ? Number(result.output) : 0;
}

/** Missing prerequisites, as human-readable reasons. */
async function missingPrereqs(cwd: string, needDocker: boolean): Promise<string[]> {
  const missing: string[] = [];
  if (!hasCommand("node") || (await nodeMajor(cwd)) < 24) missing.push("Node.js >= 24 (Eve's eval worker does not run under Bun)");
  if (needDocker && (!hasCommand("docker") || (await run(["docker", "info"], { cwd })).code !== 0)) {
    missing.push("a running Docker daemon (outcome verifier)");
  }
  return missing;
}

async function install(cwd: string, rep: Reporter): Promise<boolean> {
  const result = await run(["bun", "install", "--frozen-lockfile"], { cwd });
  if (result.code === 0) return true;
  rep.fail("evals/eve: bun install --frozen-lockfile failed");
  rep.info(result.output);
  return false;
}

/** Returns an exit code: 0 pass, 1 failed, 3 prerequisite missing. */
export async function evalsSmoke(root: string, rep: Reporter): Promise<number> {
  const cwd = join(root, "evals", "eve");
  const missing = await missingPrereqs(cwd, true);
  if (missing.length > 0) {
    for (const reason of missing) rep.skip(`evals smoke not proven: needs ${reason}`);
    return 3;
  }
  if (!(await install(cwd, rep))) return 1;
  for (const [label, script] of SMOKE_STEPS) {
    const started = performance.now();
    const result = await run(["bun", "run", script], { cwd, env: { ...process.env, EVE_DEV: process.env.EVE_DEV ?? "0" } });
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (result.code !== 0) {
      rep.fail(`${label} (bun run ${script}, exit ${result.code}, ${seconds}s)`);
      rep.info(result.output);
      return 1;
    }
    rep.ok(`${label} (${seconds}s)`);
  }
  return 0;
}

/** Live evals stream straight to the terminal: they are long, and the output is the evidence. */
export async function evalsLive(root: string, ids: string[], rep: Reporter): Promise<number> {
  const cwd = join(root, "evals", "eve");
  const missing = await missingPrereqs(cwd, true);
  if (missing.length > 0) {
    for (const reason of missing) rep.skip(`live evals need ${reason}`);
    return 3;
  }
  if (!process.env.OPENAI_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    rep.fail("live evals need OPENAI_API_KEY or ANTHROPIC_API_KEY (set EVE_EVAL_PROVIDER=anthropic for Claude)");
    return 3;
  }
  rep.warn(`live evals spend real model tokens (${ids.length > 0 ? ids.join(" ") : "full --tag live suite, ~1M input tokens"})`);
  if (!(await install(cwd, rep))) return 1;
  for (const script of ["prepare-skills", "outcome:pull"]) {
    const result = await run(["bun", "run", script], { cwd });
    if (result.code !== 0) {
      rep.fail(`bun run ${script} failed`);
      rep.info(result.output);
      return 1;
    }
  }
  const args = ids.length > 0 ? ids : ["--tag", "live"];
  const proc = Bun.spawn(["bunx", "eve", "eval", ...args, "--strict"], {
    cwd,
    env: { ...process.env, EVE_DEV: process.env.EVE_DEV ?? "0" },
    stdio: ["inherit", "inherit", "inherit"],
  });
  return (await proc.exited) === 0 ? 0 : 1;
}

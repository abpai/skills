// Eve checks and integration share the same steps locally and in CI. Only
// integration needs Docker; live evals remain an explicit, paid choice.

import { join } from "node:path";

import { Reporter } from "./report";
import { hasCommand, run } from "./gates";
import { runEvalCommand } from "./eval-command";

type Step = [label: string, script: string, timeoutMs?: number];

const CHECK_STEPS: Step[] = [
  ["materialize skills from canonical sources", "prepare-skills"],
  ["typecheck eval files against Eve types", "typecheck"],
  ["public skill catalog coverage", "test:catalog"],
  ["live coverage controls", "test:coverage"],
  ["discover evals", "list"],
];

const INTEGRATION_STEPS: Step[] = [
  ["materialize skills from canonical sources", "prepare-skills"],
  ["pull pinned outcome verifier image", "outcome:pull", 130_000],
  ["outcome verifier isolation", "test:outcome-isolation", 180_000],
  ["smoke eval (mock model, no secrets)", "eval:smoke", 300_000],
];

async function nodeMajor(cwd: string): Promise<number> {
  const result = await run(["node", "-p", "process.versions.node.split('.')[0]"], { cwd });
  return result.code === 0 ? Number(result.output) : 0;
}

/** Missing prerequisites, as human-readable reasons. */
async function missingPrereqs(cwd: string, needDocker: boolean): Promise<string[]> {
  const missing: string[] = [];
  if (!hasCommand("node") || (await nodeMajor(cwd)) < 24) missing.push("Node.js >= 24 (Eve's eval worker does not run under Bun)");
  if (needDocker && (!hasCommand("docker") || (await runEvalCommand(["docker", "info", "--format", "{{.ServerVersion}}"], {
    cwd, label: "Docker daemon availability", timeoutMs: 10_000,
  })) !== 0)) {
    missing.push("a running Docker daemon (outcome verifier)");
  }
  return missing;
}

async function install(cwd: string, rep: Reporter): Promise<boolean> {
  const code = await runEvalCommand(["bun", "install", "--frozen-lockfile"], {
    cwd, label: "install Eve dependencies (frozen)", timeoutMs: 120_000,
  });
  if (code === 0) return true;
  rep.fail("evals/eve: bun install --frozen-lockfile failed");
  return false;
}

/** Returns an exit code: 0 pass, 1 failed, 3 prerequisite missing. */
export async function evalsSmoke(root: string, rep: Reporter, part: "check" | "integration" | "smoke" = "smoke"): Promise<number> {
  const cwd = join(root, "evals", "eve");
  const missing = await missingPrereqs(cwd, part === "integration");
  if (missing.length > 0) {
    for (const reason of missing) rep.skip(`evals ${part} not proven: needs ${reason}`);
    return 3;
  }
  if (!(await install(cwd, rep))) return 1;
  const steps = part === "check" ? CHECK_STEPS : part === "integration" ? INTEGRATION_STEPS : [...CHECK_STEPS, ...INTEGRATION_STEPS.slice(1)];
  for (const [label, script, timeoutMs = 120_000] of steps) {
    // Run the Docker prerequisite after the fast checks in the combined lane.
    if (part === "smoke" && script === "outcome:pull") {
      const missingDocker = await missingPrereqs(cwd, true);
      if (missingDocker.length > 0) {
        for (const reason of missingDocker) rep.skip(`evals integration not proven: needs ${reason}`);
        return 3;
      }
    }
    const started = performance.now();
    const code = await runEvalCommand(["bun", "run", script], {
      cwd, label, timeoutMs,
      env: {
        ...process.env, EVE_DEV: process.env.EVE_DEV ?? "0",
        // The smoke lane always uses the mock, including on developer machines
        // with provider credentials configured for the separate live lane.
        OPENAI_API_KEY: undefined, ANTHROPIC_API_KEY: undefined, EVE_EVAL_PROVIDER: undefined,
      },
    });
    const seconds = ((performance.now() - started) / 1000).toFixed(1);
    if (code !== 0) {
      rep.fail(`${label} (bun run ${script}, exit ${code}, ${seconds}s)`);
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
    const code = await runEvalCommand(["bun", "run", script], { cwd, label: script, timeoutMs: 130_000 });
    if (code !== 0) {
      rep.fail(`bun run ${script} failed`);
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

// The gate registry: every check the repo runs, in the order `skills gate`
// runs them. CI calls the same gates by id, so this list is the single source
// of truth for what "validated" means. Every gate only reads; `skills fix` is
// the one command that writes.

import { readFileSync } from "node:fs";
import { join } from "node:path";

import { checkVersionBumps } from "../skill-metadata";
import { Reporter, errorMessage } from "./report";
import { strictModeViolations } from "./strict-schema";
import { validateStructure } from "./structure";
import { checkSurfaces } from "./surfaces";

export type Status = "pass" | "fail" | "skip";

export interface Outcome {
  status: Status;
  /** What this gate could not prove (a missing tool, no network). Fails under --strict. */
  unproven: string[];
}

export interface GateContext {
  root: string;
  /** The ref version bumps and whitespace are measured against (default origin/main). */
  baseRef: string;
  rep: Reporter;
}

export interface Gate {
  id: string;
  summary: string;
  run(ctx: GateContext): Promise<Outcome>;
}

// ── helpers ─────────────────────────────────────────────────────────────────

export interface RunResult {
  code: number;
  output: string;
}

export async function run(cmd: string[], opts: { cwd: string; env?: Record<string, string | undefined> }): Promise<RunResult> {
  try {
    const proc = Bun.spawn(cmd, { cwd: opts.cwd, env: opts.env ?? process.env, stdout: "pipe", stderr: "pipe" });
    const [stdout, stderr, code] = await Promise.all([
      new Response(proc.stdout).text(),
      new Response(proc.stderr).text(),
      proc.exited,
    ]);
    return { code, output: `${stdout}${stderr}`.trimEnd() };
  } catch (error) {
    return { code: 127, output: errorMessage(error) };
  }
}

export function hasCommand(name: string): boolean {
  return Bun.which(name) !== null;
}

/** Print a step's verdict; on failure, include its captured output. */
function report(rep: Reporter, label: string, result: RunResult): boolean {
  if (result.code === 0) {
    rep.ok(label);
    return true;
  }
  rep.fail(`${label} (exit ${result.code})`);
  if (result.output) rep.info(result.output);
  return false;
}

const EXCLUDED = [/^evals\/eve\//, /(^|\/)node_modules\//, /(^|\/)__pycache__\//];

/** Tracked and untracked-but-not-ignored files with an extension, minus the Eve sub-project. */
async function repoFiles(root: string, ext: string): Promise<string[]> {
  // -z keeps unusual filenames unquoted; a git failure must fail the gate, not
  // read as "no files to check".
  const { code, output } = await run(["git", "ls-files", "-z", "--cached", "--others", "--exclude-standard"], { cwd: root });
  if (code !== 0) throw new Error(`git ls-files failed (exit ${code}): ${output}`);
  return output
    .split("\0")
    .filter((file) => file.endsWith(ext) && !EXCLUDED.some((re) => re.test(file)))
    .sort();
}

async function refExists(root: string, ref: string): Promise<boolean> {
  return (await run(["git", "rev-parse", "--verify", "--quiet", `${ref}^{commit}`], { cwd: root })).code === 0;
}

const outcome = (rep: Reporter, unproven: string[] = []): Outcome => ({
  status: rep.failed ? "fail" : "pass",
  unproven,
});

// ── gates ───────────────────────────────────────────────────────────────────

const surfaces: Gate = {
  id: "surfaces",
  summary: "plugin.json versions, versions.json and docs/index.html match the version sources",
  async run({ root, rep }) {
    checkSurfaces(root, rep);
    return outcome(rep);
  },
};

const structure: Gate = {
  id: "structure",
  summary: "manifests, SKILL.md frontmatter (installer YAML parse), openai.yaml, agents, hooks, marketplaces",
  async run({ root, rep }) {
    validateStructure(root, rep);
    return outcome(rep);
  },
};

const FINISH_LANE = "code/skills/code/scripts/finish-lane";

const tooling: Gate = {
  id: "tooling",
  summary: "repo tooling tests, finish-lane, TS builds, bash/python syntax, Codex schemas, mirrored docs",
  async run({ root, rep }) {
    const unproven: string[] = [];

    report(rep, "scripts/ unit tests (bun test)", await run(["bun", "test", "./scripts"], { cwd: root }));

    report(
      rep,
      `${FINISH_LANE}.ts (bun build)`,
      await run(["bun", "build", `${FINISH_LANE}.ts`, "--target=bun", "--outfile", "/dev/null"], { cwd: root }),
    );
    // finish-lane tests spawn temp git repos; bun's 5s default is tight on busy runners.
    report(
      rep,
      `${FINISH_LANE}.test.ts (bun test)`,
      await run(["bun", "test", "--timeout=30000", `./${FINISH_LANE}.test.ts`], { cwd: root }),
    );

    const tsFiles = (await repoFiles(root, ".ts")).filter((f) => !f.endsWith(".test.ts") && !f.startsWith(FINISH_LANE));
    const tsFailures = (
      await Promise.all(
        tsFiles.map(async (file) => {
          try {
            const result = await Bun.build({ entrypoints: [join(root, file)], target: "bun", throw: false });
            return result.success ? null : `${file}: bun build failed\n${result.logs.join("\n")}`;
          } catch (error) {
            return `${file}: bun build failed\n${errorMessage(error)}`;
          }
        }),
      )
    ).filter((failure): failure is string => failure !== null);
    for (const failure of tsFailures) rep.fail(failure);
    if (tsFailures.length === 0) rep.ok(`TypeScript helper builds (${tsFiles.length} files)`);

    const shFiles = await repoFiles(root, ".sh");
    const shResults = await Promise.all(shFiles.map((file) => run(["bash", "-n", file], { cwd: root })));
    shResults.forEach((result, i) => {
      if (result.code !== 0) rep.fail(`${shFiles[i]}: bash -n syntax check failed\n${result.output}`);
    });
    if (shResults.every((result) => result.code === 0)) rep.ok(`shell helper syntax (${shFiles.length} scripts, bash -n)`);

    const pyFiles = await repoFiles(root, ".py");
    if (pyFiles.length > 0) {
      if (!hasCommand("python3")) {
        rep.skip("python helper syntax (python3 not found)");
        unproven.push("python helper syntax: python3 not found");
      } else {
        // compile() parses without writing __pycache__ into the tree.
        const compile = "import sys\nfor f in sys.argv[1:]:\n    compile(open(f, encoding='utf-8').read(), f, 'exec')";
        report(rep, `python helper syntax (${pyFiles.length} scripts)`, await run(["python3", "-c", compile, ...pyFiles], { cwd: root }));
      }
    }

    const schemas = (await repoFiles(root, ".schema.json")).filter((file) => file.startsWith("codex-exec/"));
    const violations: string[] = [];
    for (const file of schemas) {
      try {
        strictModeViolations(JSON.parse(readFileSync(join(root, file), "utf8")), file, violations);
      } catch (error) {
        violations.push(`${file}: cannot read/parse schema: ${errorMessage(error)}`);
      }
    }
    for (const violation of violations) rep.fail(violation);
    if (violations.length === 0) rep.ok(`codex output schemas strict-mode (${schemas.length} files)`);

    // Plugins mirror support docs from the plugin root into skills/<name>/ so
    // installed skills can read them; the copies must stay byte-identical.
    for (const skillDoc of (await repoFiles(root, "/INTERFACES.md")).filter((f) => f.includes("/skills/"))) {
      const rootDoc = `${skillDoc.slice(0, skillDoc.indexOf("/skills/"))}/INTERFACES.md`;
      const mirror = Bun.file(join(root, rootDoc));
      if (!(await mirror.exists())) continue;
      if ((await mirror.text()) === (await Bun.file(join(root, skillDoc)).text())) {
        rep.ok(`mirrored support doc in sync (${skillDoc} == ${rootDoc})`);
      } else {
        rep.fail(`${skillDoc} drifted from its plugin-root mirror ${rootDoc} (must be byte-identical)`);
      }
    }

    return outcome(rep, unproven);
  },
};

/** test-cursor-runner.sh runs inside test-wrapper-parity.sh, so it is not listed here. */
export const RUNNER_TESTS = [
  "scripts/test-claude-runner.sh",
  "scripts/test-antigravity-runner.sh",
  "scripts/test-wrapper-parity.sh",
  "scripts/test-gate-before-push.sh",
];

/**
 * A fixture test that creates git repos must clear git's repo-local env first.
 * Run from a git hook, GIT_DIR and friends otherwise point its `git config`
 * writes at the caller's repo, which is how test identities leaked into
 * .git/config. The unset must come before the first `git init`.
 */
export function initsBeforeClearingGitEnv(script: string): boolean {
  let cleared = false;
  for (const line of script.split("\n")) {
    if (/^\s*#/.test(line)) continue;
    if (/^\s*unset \$\(git rev-parse --local-env-vars\)/.test(line)) cleared = true;
    if (/git( -C [^ ]+)? init/.test(line) && !cleared) return true;
  }
  return false;
}

const runners: Gate = {
  id: "runners",
  summary: "shell fixture tests for the Claude, Codex, Cursor and Antigravity runner wrappers",
  async run({ root, rep }) {
    for (const file of (await repoFiles(root, ".sh")).filter((f) => /^scripts\/test-[^/]+\.sh$/.test(f))) {
      if (initsBeforeClearingGitEnv(readFileSync(join(root, file), "utf8"))) {
        rep.fail(`${file}: runs git init before 'unset $(git rev-parse --local-env-vars)'`);
      }
    }
    // Each test builds its own temp repos and fake binaries, so they run in parallel.
    const results = await Promise.all(RUNNER_TESTS.map((test) => run(["bash", test], { cwd: root })));
    results.forEach((result, i) => report(rep, RUNNER_TESTS[i], result));
    return outcome(rep);
  },
};

const version: Gate = {
  id: "version",
  summary: "every changed plugin bumped its version once, measured against the base (default origin/main)",
  async run({ root, baseRef, rep }) {
    if (!(await refExists(root, baseRef))) {
      rep.skip(`version bumps (base ${baseRef} not found; run: git fetch origin main)`);
      return { status: "skip", unproven: [`version: base ${baseRef} not found`] };
    }
    const result = checkVersionBumps(root, baseRef);
    for (const line of result.ok) rep.ok(line);
    for (const line of result.failed) rep.fail(line);
    if (result.failed.length > 0) {
      rep.info("Fix: bin/skills bump <plugin> [patch|minor|major]");
    } else {
      rep.ok(`checked ${result.checked} changed plugin(s) against ${baseRef}`);
    }
    return outcome(rep);
  },
};

const install: Gate = {
  id: "install",
  summary: "every SKILL.md is discoverable by the real `npx skills` installer (needs network)",
  async run({ root, rep }) {
    const probe = await run(["npx", "--yes", "skills", "--version"], { cwd: root });
    if (probe.code !== 0) {
      rep.skip("npx skills installer unreachable (offline?)");
      return { status: "skip", unproven: ["install: npx skills installer unreachable"] };
    }
    // CI=1 makes the script hard-fail if its own probe cannot reach the
    // installer, instead of warning and exiting 0 with nothing checked.
    const result = await run(["bash", "scripts/validate-npx-install.sh"], { cwd: root, env: { ...process.env, CI: "1" } });
    if (result.code === 0) {
      rep.ok(result.output.split("\n").pop() ?? "npx skills install check");
    } else {
      rep.fail("npx skills installer could not discover every skill");
      rep.info(result.output);
    }
    return outcome(rep);
  },
};

const whitespace: Gate = {
  id: "whitespace",
  summary: "git diff --check against the base (whitespace errors, conflict markers)",
  async run({ root, baseRef, rep }) {
    const unproven: string[] = [];
    let base = "HEAD";
    if (await refExists(root, baseRef)) {
      base = (await run(["git", "merge-base", baseRef, "HEAD"], { cwd: root })).output || "HEAD";
    } else {
      unproven.push(`whitespace: base ${baseRef} not found, checked uncommitted changes only`);
    }
    const label = base === "HEAD" ? "uncommitted changes" : `changes since ${baseRef}`;
    report(rep, `git diff --check (${label})`, await run(["git", "diff", "--check", base], { cwd: root }));
    return outcome(rep, unproven);
  },
};

export const GATES: Gate[] = [surfaces, structure, tooling, runners, version, install, whitespace];

/** The fast, offline subset for pre-commit and the edit loop. */
export const CHECK_GATES = ["surfaces", "structure", "whitespace"];

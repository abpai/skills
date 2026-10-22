#!/usr/bin/env bun
// `skills`: the one front door for validating this repo.
//
//   skills check                 fast offline gates (surfaces, structure, whitespace); pre-commit runs this
//   skills gate [ids...]         the full lane CI runs, in order, stopping at the first failure
//   skills fix                   rewrite derived version surfaces (manifests, versions.json, docs cards)
//   skills bump <plugin> [level] bump a plugin once relative to the base, then fix
//   skills evals smoke|live      Eve behavioral evals (not a gate: Docker + Node >= 24)
//
// Exit codes: 0 ok, 1 a gate failed, 2 usage error, 3 prerequisite missing.

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { compareVersions, nextVersion, pluginVersionSource, versionAtRef } from "./skill-metadata";
import { evalsLive, evalsSmoke } from "./lib/evals";
import { CHECK_GATES, GATES, type Gate, type Outcome } from "./lib/gates";
import { Reporter, errorMessage } from "./lib/report";
import { pluginDirs } from "./lib/structure";
import { fixSurfaces } from "./lib/surfaces";

const ROOT = resolve(dirname(import.meta.path), "..");
const DEFAULT_BASE = "origin/main";

const USAGE = `Usage: skills <command> [options]

Commands:
  check                        fast offline gates: ${CHECK_GATES.join(", ")}
  gate [ids...]                run gates in order (default: all), stop at the first failure
  gate --list                  list gates
  fix                          rewrite plugin.json versions, versions.json and docs/index.html cards
  bump <plugin> [patch|minor|major]
                               bump a plugin's version once relative to the base, then fix
  evals smoke                  Eve harness smoke (mock model; needs Docker + Node >= 24)
  evals live [eval ids...]     Eve live evals (spends model tokens)

Options:
  --base <ref>       base for version/whitespace gates and bump (default ${DEFAULT_BASE})
  --strict           a skipped or unproven gate fails the run (CI uses this)
  --keep-going       run every gate even after a failure
  --json             machine report on stdout; logs move to stderr
  --force            bump: bump again even if already bumped against the base

Exit codes: 0 ok, 1 failed, 2 usage error, 3 prerequisite missing.`;

class UsageError extends Error {}

interface Options {
  base: string;
  strict: boolean;
  keepGoing: boolean;
  json: boolean;
  force: boolean;
  list: boolean;
  positionals: string[];
}

function parseOptions(args: string[]): Options {
  const options: Options = { base: DEFAULT_BASE, strict: false, keepGoing: false, json: false, force: false, list: false, positionals: [] };
  for (let i = 0; i < args.length; i += 1) {
    const arg = args[i];
    if (arg === "--base") {
      const value = args[++i];
      if (!value) throw new UsageError("--base needs a ref");
      options.base = value;
    } else if (arg === "--strict") options.strict = true;
    else if (arg === "--keep-going") options.keepGoing = true;
    else if (arg === "--json") options.json = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--list") options.list = true;
    else if (arg.startsWith("-")) throw new UsageError(`unknown option ${arg}`);
    else options.positionals.push(arg);
  }
  return options;
}

// ── gate ────────────────────────────────────────────────────────────────────

interface GateRecord extends Outcome {
  id: string;
  durationMs: number;
}

async function runGates(ids: string[], options: Options): Promise<number> {
  const unknown = ids.filter((id) => !GATES.some((gate) => gate.id === id));
  if (unknown.length > 0) throw new UsageError(`unknown gate(s): ${unknown.join(", ")} (see skills gate --list)`);
  const selected: Gate[] = ids.length > 0 ? GATES.filter((gate) => ids.includes(gate.id)) : GATES;

  const log = options.json ? (line: string) => console.error(line) : (line: string) => console.log(line);
  const records: GateRecord[] = [];
  let failed = false;

  for (const gate of selected) {
    log(`[gate:${gate.id}] ${gate.summary}`);
    const rep = new Reporter(log);
    const started = performance.now();
    let result: Outcome;
    try {
      result = await gate.run({ root: ROOT, baseRef: options.base, rep });
    } catch (error) {
      rep.fail(`${gate.id}: unexpected error: ${errorMessage(error)}`);
      result = { status: "fail", unproven: [] };
    }
    if (options.strict && result.status === "pass" && result.unproven.length > 0) result = { ...result, status: "fail" };
    if (options.strict && result.status === "skip") result = { ...result, status: "fail" };
    const durationMs = Math.round(performance.now() - started);
    records.push({ id: gate.id, durationMs, ...result });

    log(`[gate:${gate.id}] ${result.status} (${(durationMs / 1000).toFixed(1)}s)`);
    if (result.status === "fail") {
      failed = true;
      log(`  rerun: bin/skills gate ${gate.id}${options.base === DEFAULT_BASE ? "" : ` --base ${options.base}`}`);
      if (!options.keepGoing) break;
    }
  }

  const ran = new Set(records.map((record) => record.id));
  const notRun = selected.filter((gate) => !ran.has(gate.id)).map((gate) => gate.id);
  const unproven = records.flatMap((record) => record.unproven);
  const counts = (status: string) => records.filter((record) => record.status === status).length;

  log("");
  log(
    `skills gate: ${counts("pass")} passed, ${counts("fail")} failed, ${counts("skip")} skipped` +
      (notRun.length > 0 ? `, not run: ${notRun.join(", ")}` : ""),
  );
  for (const reason of unproven) log(`  not proven: ${reason}`);
  if (options.strict && unproven.length > 0) log("  --strict: skipped or unproven gates fail the run");

  if (options.json) {
    console.log(
      JSON.stringify(
        { schema: "skills-gate/v1", base: options.base, strict: options.strict, ok: !failed, gates: records, notRun },
        null,
        2,
      ),
    );
  }
  return failed ? 1 : 0;
}

// ── bump ────────────────────────────────────────────────────────────────────

const LEVELS = ["patch", "minor", "major"] as const;
type Level = (typeof LEVELS)[number];

/** Replace metadata.version inside a SKILL.md frontmatter, keeping its quoting. */
export function setSkillVersion(text: string, version: string): string {
  const lines = text.split("\n");
  let inMetadata = false;
  for (let i = 1; i < lines.length && lines[i].trim() !== "---"; i += 1) {
    if (lines[i].startsWith("metadata:")) {
      inMetadata = true;
      continue;
    }
    if (inMetadata && lines[i] && !/^\s/.test(lines[i])) inMetadata = false;
    const match = inMetadata ? lines[i].match(/^(\s+version:\s*)(["']?)[^"'\s]*\2(\s*)$/) : null;
    if (match) {
      lines[i] = `${match[1]}${match[2]}${version}${match[2]}${match[3]}`;
      return lines.join("\n");
    }
  }
  throw new Error("no metadata.version line found in frontmatter");
}

function bump(options: Options): number {
  const [plugin, rawLevel = "patch"] = options.positionals;
  const plugins = pluginDirs(ROOT).map((dir) => dir.slice(ROOT.length + 1));
  if (!plugin || !plugins.includes(plugin)) {
    throw new UsageError(`bump needs a plugin: ${plugins.join(", ")}`);
  }
  if (!LEVELS.includes(rawLevel as Level)) throw new UsageError(`level must be one of ${LEVELS.join(", ")}`);
  const level = rawLevel as Level;

  const source = pluginVersionSource(ROOT, plugin)!;
  const current = source.version;
  if (!current) {
    console.error(`[FAIL] ${source.path}: no version to bump`);
    return 1;
  }
  // Without the base, "file missing at base" and "base missing" look the same,
  // and an existing plugin would silently keep its version.
  if (Bun.spawnSync(["git", "rev-parse", "--verify", "--quiet", `${options.base}^{commit}`], { cwd: ROOT }).exitCode !== 0) {
    console.error(`[FAIL] base ${options.base} not found; run: git fetch origin main (or pass --base <ref>)`);
    return 3;
  }
  const base = versionAtRef(ROOT, options.base, source.path, source.kind);

  if (base === null) {
    console.log(`${plugin}: ${source.path} is new relative to ${options.base}; keeping ${current}.`);
  } else if (compareVersions(current, base) > 0 && !options.force) {
    // The point of measuring against the base: a branch bumps once, however
    // many times it is rebased or restacked.
    console.log(`${plugin}: already bumped ${base} -> ${current} against ${options.base}; nothing to do (--force to bump again).`);
  } else {
    const from = compareVersions(current, base) > 0 ? current : base;
    const next = nextVersion(from, level);
    const path = join(ROOT, source.path);
    if (source.kind === "skill") {
      writeFileSync(path, setSkillVersion(readFileSync(path, "utf8"), next));
    } else {
      const data = JSON.parse(readFileSync(path, "utf8"));
      data.version = next;
      writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
    }
    console.log(`${plugin}: ${current} -> ${next} (${level} from ${from}) in ${source.path}`);
  }
  return fix();
}

// ── fix ─────────────────────────────────────────────────────────────────────

function fix(): number {
  const changed = fixSurfaces(ROOT);
  for (const line of changed) console.log(`  ${line}`);
  console.log(changed.length > 0 ? `Fixed ${changed.length} derived surface(s).` : "Derived surfaces already up to date.");
  return 0;
}

// ── main ────────────────────────────────────────────────────────────────────

async function main(argv: string[]): Promise<number> {
  const [command, ...rest] = argv;
  if (!command || command === "help" || command === "--help" || command === "-h") {
    console.log(USAGE);
    return command ? 0 : 2;
  }
  const options = parseOptions(rest);

  switch (command) {
    case "check":
      return runGates(CHECK_GATES, options);
    case "gate":
      if (options.list) {
        for (const gate of GATES) console.log(`${gate.id.padEnd(11)} ${gate.summary}`);
        return 0;
      }
      return runGates(options.positionals, options);
    case "fix":
      return fix();
    case "bump":
      return bump(options);
    case "evals": {
      const [mode, ...ids] = options.positionals;
      const rep = new Reporter();
      if (mode === "smoke") return evalsSmoke(ROOT, rep);
      if (mode === "live") return evalsLive(ROOT, ids, rep);
      throw new UsageError("evals needs smoke or live");
    }
    default:
      throw new UsageError(`unknown command ${command}`);
  }
}

if (import.meta.main) {
  try {
    process.exit(await main(process.argv.slice(2)));
  } catch (error) {
    if (error instanceof UsageError) {
      console.error(`skills: ${error.message}\n\n${USAGE}`);
      process.exit(2);
    }
    console.error(`skills: ${errorMessage(error)}`);
    process.exit(1);
  }
}

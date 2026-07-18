import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";

import {
  checkVersionBumps,
  collectVersionSources,
  generateVersionsJson,
  syncPluginManifestVersions,
} from "./skill-metadata";

const tmpRoots: string[] = [];

afterEach(() => {
  for (const root of tmpRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function makeRoot(): string {
  const root = mkdtempSync(join(tmpdir(), "skill-metadata-"));
  tmpRoots.push(root);
  return root;
}

function write(path: string, text: string): void {
  mkdirSync(path.split("/").slice(0, -1).join("/"), { recursive: true });
  writeFileSync(path, text);
}

function writeManifest(root: string, plugin: string, version: string): void {
  const manifest = JSON.stringify(
    {
      name: plugin,
      version,
      description: `${plugin} plugin`,
      author: { name: "Test" },
      license: "MIT",
    },
    null,
    2,
  );
  write(join(root, plugin, ".claude-plugin", "plugin.json"), `${manifest}\n`);
  write(join(root, plugin, ".codex-plugin", "plugin.json"), `${manifest}\n`);
}

function writeSkill(root: string, plugin: string, skill: string, frontmatter: string): void {
  write(
    join(root, plugin, "skills", skill, "SKILL.md"),
    `---\nname: ${skill}\n${frontmatter.trimEnd()}\n---\n\n# ${skill}\n`,
  );
}

function fixtureEnv(overrides: Record<string, string> = {}): NodeJS.ProcessEnv {
  const inheritedWithoutGit = Object.fromEntries(
    Object.entries(process.env).filter(([name]) => !name.startsWith("GIT_")),
  );
  return { ...inheritedWithoutGit, ...overrides };
}

function git(root: string, args: string[]): string {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8", env: fixtureEnv() });
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

describe("skill metadata version sources", () => {
  test("isolates Git fixtures from inherited hook context", () => {
    const parent = makeRoot();
    git(parent, ["init"]);
    git(parent, ["config", "user.name", "Parent Repository"]);
    git(parent, ["config", "user.email", "parent@example.test"]);
    git(parent, ["config", "core.bare", "false"]);
    const originalGitDir = process.env.GIT_DIR;
    const originalGitIndexFile = process.env.GIT_INDEX_FILE;
    const originalGitWorkTree = process.env.GIT_WORK_TREE;

    process.env.GIT_DIR = join(parent, ".git");
    process.env.GIT_INDEX_FILE = join(parent, ".git", "index");
    process.env.GIT_WORK_TREE = parent;
    try {
      const child = makeRoot();
      git(child, ["init"]);
      git(child, ["config", "user.name", "Fixture Repository"]);
      expect(git(child, ["config", "user.name"])).toBe("Fixture Repository");
      expect(fixtureEnv().GIT_DIR).toBeUndefined();
      expect(fixtureEnv({ GIT_DIR: join(child, ".git") }).GIT_DIR).toBe(join(child, ".git"));
    } finally {
      for (const [name, value] of Object.entries({
        GIT_DIR: originalGitDir,
        GIT_INDEX_FILE: originalGitIndexFile,
        GIT_WORK_TREE: originalGitWorkTree,
      })) {
        if (value === undefined) delete process.env[name];
        else process.env[name] = value;
      }
    }

    expect(git(parent, ["config", "user.name"])).toBe("Parent Repository");
    expect(git(parent, ["config", "user.email"])).toBe("parent@example.test");
    expect(git(parent, ["config", "core.bare"])).toBe("false");
  });

  test("uses model-invocable SKILL.md metadata.version and ignores hidden wrappers", () => {
    const root = makeRoot();
    writeManifest(root, "cursor", "1.4.0");
    writeSkill(
      root,
      "cursor",
      "cursor",
      `
description: Cursor umbrella
metadata:
  version: "1.4"
`,
    );
    writeSkill(
      root,
      "cursor",
      "setup",
      `
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
  version: "9.9.9"
description: Hidden setup wrapper
`,
    );

    expect(collectVersionSources(root).versions).toEqual({
      cursor: "1.4",
    });
  });

  test("resolves metadata.version regardless of quote style or extra indentation", () => {
    const root = makeRoot();
    // Single-quoted value (valid YAML) — the resolver must strip single quotes
    // exactly as it strips double quotes, so the version source matches.
    writeManifest(root, "cursor", "1.4.0");
    writeSkill(
      root,
      "cursor",
      "cursor",
      `
description: Cursor umbrella
metadata:
  version: '1.4'
`,
    );
    // Deeper indentation under metadata: must still be found.
    writeManifest(root, "distill", "2.0.0");
    writeSkill(
      root,
      "distill",
      "distill",
      `
description: Distill
metadata:
    version: "2.0"
`,
    );

    expect(collectVersionSources(root).versions).toEqual({
      cursor: "1.4",
      distill: "2.0",
    });
  });

  test("uses plugin manifest version for command-only plugins", () => {
    const root = makeRoot();
    writeManifest(root, "pi", "0.11.1");
    writeSkill(
      root,
      "pi",
      "plan",
      `
disable-model-invocation: true
metadata:
  internal: true
description: Hidden plan command
`,
    );
    writeSkill(
      root,
      "pi",
      "review",
      `
disable-model-invocation: true
metadata:
  internal: true
description: Hidden review command
`,
    );

    expect(collectVersionSources(root).versions).toEqual({
      pi: "0.11.1",
    });
  });

  test("renders versions.json deterministically from version sources", () => {
    const root = makeRoot();
    writeManifest(root, "zeta", "2.0.0");
    writeSkill(
      root,
      "zeta",
      "zeta",
      `
description: Zeta
metadata:
  version: "2.0.0"
`,
    );
    writeManifest(root, "alpha", "1.0.0");
    writeSkill(
      root,
      "alpha",
      "alpha",
      `
description: Alpha
metadata:
  version: "1.0.0"
`,
    );

    expect(generateVersionsJson(root)).toBe(
      `{\n  "schema_version": 1,\n  "skills": {\n    "alpha": "1.0.0",\n    "zeta": "2.0.0"\n  }\n}\n`,
    );
  });

  test("syncs model-invocable skill versions to both manifests with semver normalization", () => {
    const root = makeRoot();
    writeManifest(root, "distill", "1.0.0");
    writeSkill(
      root,
      "distill",
      "distill",
      `
description: Distill
metadata:
  version: "1.1"
`,
    );

    const result = syncPluginManifestVersions(root);

    expect(result.updated).toEqual([
      { path: "distill/.claude-plugin/plugin.json", from: "1.0.0", to: "1.1.0" },
      { path: "distill/.codex-plugin/plugin.json", from: "1.0.0", to: "1.1.0" },
    ]);
    expect(JSON.parse(readFileSync(join(root, "distill", ".claude-plugin", "plugin.json"), "utf8")).version).toBe(
      "1.1.0",
    );
    expect(JSON.parse(readFileSync(join(root, "distill", ".codex-plugin", "plugin.json"), "utf8")).version).toBe(
      "1.1.0",
    );
  });

  test("throws when the base ref cannot be resolved (fail-closed)", () => {
    const root = makeRoot();
    git(root, ["init"]);
    git(root, ["config", "user.email", "test@example.com"]);
    git(root, ["config", "user.name", "Test User"]);
    writeManifest(root, "widget", "1.0.0");
    writeSkill(root, "widget", "widget", `description: Widget\nmetadata:\n  version: "1.0.0"\n`);
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "base"]);

    expect(() => checkVersionBumps(root, "refs/heads/definitely-not-a-real-base")).toThrow();
  });

  test("reports changed plugins whose version source was not bumped", () => {
    const root = makeRoot();
    git(root, ["init"]);
    git(root, ["config", "user.email", "test@example.com"]);
    git(root, ["config", "user.name", "Test User"]);
    writeManifest(root, "widget", "1.0.0");
    writeSkill(
      root,
      "widget",
      "widget",
      `
description: Widget
metadata:
  version: "1.0.0"
`,
    );
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "base"]);
    const base = git(root, ["rev-parse", "HEAD"]);

    writeSkill(
      root,
      "widget",
      "widget",
      `
description: Widget changed behavior
metadata:
  version: "1.0.0"
`,
    );
    git(root, ["add", "."]);
    git(root, ["commit", "-m", "change widget without bump"]);

    expect(checkVersionBumps(root, base)).toEqual({
      checked: 1,
      failed: ["widget: version (1.0.0) in widget/skills/widget/SKILL.md was not bumped"],
      ok: [],
    });
  });
});

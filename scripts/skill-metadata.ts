import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { basename, dirname, join, relative, sep } from "node:path";
import { spawnSync } from "node:child_process";

type JsonObject = Record<string, unknown>;

export type VersionSourceKind = "skill" | "manifest";

export interface VersionSource {
  key: string;
  version: string;
  kind: VersionSourceKind;
  pluginName: string;
  sourcePath: string;
}

export interface VersionSourceSet {
  versions: Record<string, string>;
  sources: VersionSource[];
}

export interface ManifestUpdate {
  path: string;
  from: string;
  to: string;
}

export interface SyncResult {
  updated: ManifestUpdate[];
}

export class MetadataError extends Error {
  failures: string[];

  constructor(failures: string[]) {
    super(failures.join("\n"));
    this.name = "MetadataError";
    this.failures = failures;
  }
}

interface SkillInfo {
  path: string;
  name: string;
  disabled: boolean;
  version: string | null;
}

interface PluginInfo {
  name: string;
  dir: string;
  claudeManifest: string;
  codexManifest: string;
}

function rel(root: string, path: string): string {
  return relative(root, path).split(sep).join("/");
}

function readJson(path: string): JsonObject {
  return JSON.parse(readFileSync(path, "utf8")) as JsonObject;
}

function writeJson(path: string, data: JsonObject): void {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`);
}

function isDirectory(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function walkFiles(root: string, fileName: string): string[] {
  if (!existsSync(root)) {
    return [];
  }

  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir).sort()) {
      const path = join(dir, entry);
      const stat = statSync(path);
      if (stat.isDirectory()) {
        stack.push(path);
      } else if (entry === fileName) {
        out.push(path);
      }
    }
  }
  return out.sort();
}

function listPlugins(root = process.cwd()): PluginInfo[] {
  return readdirSync(root)
    .sort()
    .filter((entry) => {
      const pluginDir = join(root, entry);
      return (
        isDirectory(pluginDir) &&
        existsSync(join(pluginDir, ".claude-plugin", "plugin.json"))
      );
    })
    .map((name) => {
      const dir = join(root, name);
      return {
        name,
        dir,
        claudeManifest: join(dir, ".claude-plugin", "plugin.json"),
        codexManifest: join(dir, ".codex-plugin", "plugin.json"),
      };
    });
}

function frontmatterLines(text: string): string[] {
  const lines = text.split(/\r?\n/);
  if (lines[0]?.trim() !== "---") {
    return [];
  }

  const out: string[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    if (lines[i].trim() === "---") {
      return out;
    }
    out.push(lines[i]);
  }
  return out;
}

function topLevelValue(lines: string[], key: string): string | null {
  const prefix = `${key}:`;
  for (const line of lines) {
    if (!line || line[0] === " " || line[0] === "\t" || line[0] === "#") {
      continue;
    }
    if (line.startsWith(prefix)) {
      return line.slice(prefix.length).trim().replace(/^["']|["']$/g, "");
    }
  }
  return null;
}

function metadataVersion(lines: string[]): string | null {
  let inMetadata = false;
  for (const line of lines) {
    if (line.startsWith("metadata:")) {
      inMetadata = true;
      continue;
    }
    if (inMetadata && line.startsWith("  version:")) {
      return line.slice(line.indexOf(":") + 1).trim().replace(/^"|"$/g, "");
    }
    if (inMetadata && line && !line.startsWith("  ")) {
      inMetadata = false;
    }
  }
  return null;
}

function skillInfo(path: string): SkillInfo {
  const lines = frontmatterLines(readFileSync(path, "utf8"));
  return {
    path,
    name: basename(dirname(path)),
    disabled: topLevelValue(lines, "disable-model-invocation") === "true",
    version: metadataVersion(lines),
  };
}

function pluginSkills(plugin: PluginInfo): SkillInfo[] {
  return walkFiles(join(plugin.dir, "skills"), "SKILL.md").map(skillInfo);
}

function manifestVersion(path: string): string | null {
  const data = readJson(path);
  const version = data.version;
  return typeof version === "string" ? version : null;
}

function normalizeManifestVersion(version: string): string {
  return /^\d+\.\d+$/.test(version) ? `${version}.0` : version;
}

function versionedSkillSources(plugin: PluginInfo): SkillInfo[] {
  return pluginSkills(plugin).filter((skill) => !skill.disabled);
}

export function collectVersionSources(root = process.cwd()): VersionSourceSet {
  const versions: Record<string, string> = {};
  const sources: VersionSource[] = [];
  const failures: string[] = [];

  for (const plugin of listPlugins(root)) {
    const versionedSkills = versionedSkillSources(plugin);
    let versionedSkillFound = false;

    for (const skill of versionedSkills) {
      if (!skill.version) {
        failures.push(`${rel(root, skill.path)}: missing metadata.version in frontmatter`);
        continue;
      }
      versions[skill.name] = skill.version;
      sources.push({
        key: skill.name,
        version: skill.version,
        kind: "skill",
        pluginName: plugin.name,
        sourcePath: rel(root, skill.path),
      });
      versionedSkillFound = true;
    }

    if (!versionedSkillFound) {
      const version = manifestVersion(plugin.claudeManifest);
      if (!version) {
        failures.push(`${rel(root, plugin.claudeManifest)}: missing version`);
        continue;
      }
      versions[plugin.name] = version;
      sources.push({
        key: plugin.name,
        version,
        kind: "manifest",
        pluginName: plugin.name,
        sourcePath: rel(root, plugin.claudeManifest),
      });
    }
  }

  if (failures.length > 0) {
    throw new MetadataError(failures);
  }

  return {
    versions: Object.fromEntries(Object.entries(versions).sort(([a], [b]) => a.localeCompare(b))),
    sources: sources.sort((a, b) => a.key.localeCompare(b.key)),
  };
}

export function generateVersionsJson(root = process.cwd()): string {
  const { versions } = collectVersionSources(root);
  const keys = Object.keys(versions).sort();
  const lines = [
    "{",
    '  "schema_version": 1,',
    '  "skills": {',
    ...keys.map((key, index) => {
      const comma = index === keys.length - 1 ? "" : ",";
      return `    ${JSON.stringify(key)}: ${JSON.stringify(versions[key])}${comma}`;
    }),
    "  }",
    "}",
    "",
  ];
  return lines.join("\n");
}

export function writeVersionsJson(root = process.cwd(), output = "versions.json"): number {
  const json = generateVersionsJson(root);
  const outputPath = join(root, output);
  writeFileSync(outputPath, json);
  return Object.keys(collectVersionSources(root).versions).length;
}

function firstModelInvocableSkillVersion(plugin: PluginInfo): string | null {
  for (const skill of versionedSkillSources(plugin)) {
    if (skill.version) {
      return skill.version;
    }
  }
  return null;
}

export function syncPluginManifestVersions(root = process.cwd()): SyncResult {
  const updated: ManifestUpdate[] = [];

  for (const plugin of listPlugins(root)) {
    const skillVersion = firstModelInvocableSkillVersion(plugin);
    if (!skillVersion) {
      continue;
    }
    const targetVersion = normalizeManifestVersion(skillVersion);
    for (const manifest of [plugin.claudeManifest, plugin.codexManifest]) {
      if (!existsSync(manifest)) {
        continue;
      }
      const data = readJson(manifest);
      const current = typeof data.version === "string" ? data.version : "";
      if (current === targetVersion) {
        continue;
      }
      data.version = targetVersion;
      writeJson(manifest, data);
      updated.push({ path: rel(root, manifest), from: current, to: targetVersion });
    }
  }

  return { updated };
}

function usage(): never {
  console.error(`Usage:
  bun scripts/skill-metadata.ts expected-versions [--root DIR] [--json]
  bun scripts/skill-metadata.ts generate-versions [--root DIR]
  bun scripts/skill-metadata.ts sync-plugin-versions [--root DIR]
  bun scripts/skill-metadata.ts check-version-bump BASE_REF [--root DIR]`);
  process.exit(2);
}

function parseRoot(args: string[]): { root: string; args: string[] } {
  let root = process.cwd();
  const rest: string[] = [];
  for (let i = 0; i < args.length; i += 1) {
    if (args[i] === "--root") {
      root = args[i + 1] ?? usage();
      i += 1;
    } else {
      rest.push(args[i]);
    }
  }
  return { root, args: rest };
}

function git(root: string, args: string[], { input, allowFail }: { input?: string; allowFail?: boolean } = {}): string {
  const result = spawnSync("git", args, {
    cwd: root,
    input,
    encoding: "utf8",
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    if (allowFail) return "";
    throw new Error(`git ${args.join(" ")} exited ${result.status}: ${result.stderr || result.stdout}`.trim());
  }
  return result.stdout;
}

function extractVersionFromSkillText(text: string): string | null {
  return metadataVersion(frontmatterLines(text));
}

function extractVersionFromManifestText(text: string): string | null {
  try {
    const data = JSON.parse(text) as JsonObject;
    return typeof data.version === "string" ? data.version : null;
  } catch {
    return null;
  }
}

export function checkVersionBumps(root: string, baseRef: string): { checked: number; failed: string[]; ok: string[] } {
  const changedFiles = git(root, ["diff", "--name-only", `${baseRef}...HEAD`])
    .split(/\r?\n/)
    .filter(Boolean);
  const changedDirs = [...new Set(changedFiles.map((file) => file.split("/")[0]))].sort();
  const failed: string[] = [];
  const ok: string[] = [];
  let checked = 0;

  for (const dir of changedDirs) {
    const pluginDir = join(root, dir);
    if (!existsSync(join(pluginDir, ".claude-plugin", "plugin.json"))) {
      continue;
    }
    const meaningful = changedFiles.some((file) => {
      if (!file.startsWith(`${dir}/`)) {
        return false;
      }
      return [
        `${dir}/skills/`,
        `${dir}/agents/`,
        `${dir}/commands/`,
        `${dir}/hooks/`,
        `${dir}/internal/`,
        `${dir}/.claude-plugin/plugin.json`,
        `${dir}/.codex-plugin/plugin.json`,
      ].some((prefix) => file.startsWith(prefix) || file === prefix);
    });
    if (!meaningful) {
      continue;
    }

    const plugin: PluginInfo = {
      name: dir,
      dir: pluginDir,
      claudeManifest: join(pluginDir, ".claude-plugin", "plugin.json"),
      codexManifest: join(pluginDir, ".codex-plugin", "plugin.json"),
    };
    const source =
      versionedSkillSources(plugin).find((skill) => skill.version) ??
      null;

    let versionFile: string;
    let currentVersion: string | null;
    let baseVersion: string | null;
    if (source) {
      versionFile = rel(root, source.path);
      currentVersion = source.version;
      baseVersion = extractVersionFromSkillText(git(root, ["show", `${baseRef}:${versionFile}`], { allowFail: true }));
    } else {
      versionFile = `${dir}/.claude-plugin/plugin.json`;
      currentVersion = manifestVersion(join(root, versionFile));
      baseVersion = extractVersionFromManifestText(git(root, ["show", `${baseRef}:${versionFile}`], { allowFail: true }));
    }

    if (!currentVersion) {
      continue;
    }
    checked += 1;
    if (baseVersion && currentVersion === baseVersion) {
      failed.push(`${dir}: version (${currentVersion}) in ${versionFile} was not bumped`);
    } else {
      ok.push(`${dir}: ${baseVersion || "new"} -> ${currentVersion} (${versionFile})`);
    }
  }

  return { checked, failed, ok };
}

function main(): void {
  const [command, ...rawArgs] = process.argv.slice(2);
  if (!command) {
    usage();
  }

  try {
    const { root, args } = parseRoot(rawArgs);
    if (command === "expected-versions") {
      const result = collectVersionSources(root);
      if (args.includes("--json")) {
        console.log(JSON.stringify(result.versions));
      } else {
        for (const source of result.sources) {
          console.log(`${source.key} ${source.version} ${source.sourcePath}`);
        }
      }
    } else if (command === "generate-versions") {
      const count = writeVersionsJson(root);
      console.log(`Generated versions.json with ${count} skills.`);
    } else if (command === "sync-plugin-versions") {
      const result = syncPluginManifestVersions(root);
      for (const update of result.updated) {
        console.log(`  ${update.path}: ${update.from} -> ${update.to}`);
      }
      console.log(`Synced plugin versions (${result.updated.length} file(s) updated).`);
    } else if (command === "check-version-bump") {
      const baseRef = args[0] ?? usage();
      const result = checkVersionBumps(root, baseRef);
      for (const line of result.ok) {
        console.log(`  [OK] ${line}`);
      }
      if (result.failed.length > 0) {
        for (const line of result.failed) {
          console.error(`::error::${line}`);
        }
        console.error("");
        console.error("Fix: bump metadata.version in the model-invocable SKILL.md, or version in .claude-plugin/plugin.json for command-only plugins.");
        process.exit(1);
      }
      console.log(`Checked ${result.checked} plugin(s). All changed plugins have proper version bumps.`);
    } else {
      usage();
    }
  } catch (error) {
    if (error instanceof MetadataError) {
      for (const failure of error.failures) {
        console.error(`[FAIL] ${failure}`);
      }
    } else {
      console.error(error instanceof Error ? error.message : String(error));
    }
    process.exit(1);
  }
}

if (import.meta.main) {
  main();
}

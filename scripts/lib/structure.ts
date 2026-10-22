// Structural validation for every authored plugin file: plugin manifests,
// SKILL.md frontmatter, agents/openai.yaml, plugin agents, hooks.json, and both
// marketplaces. Derived surfaces (versions.json, docs/index.html, manifest
// versions) are checked by ./surfaces.ts instead.
//
// SKILL.md frontmatter goes through the same `parse()` from the npm `yaml`
// package that the `npx skills` installer uses, so a skill that would be
// silently skipped at install time fails here. Field extraction stays
// line-based on purpose: the flag semantics (string compares, one layer of
// quote stripping) are the contract, not whatever YAML type a value parses to.

import { existsSync, lstatSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { parse as parseYaml } from "yaml";

import { Reporter, errorMessage, repr } from "./report";

const NAME_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SEMVER_RE = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/;

// Skills the model may start on its own. Every other entrypoint is explicit-only.
export const CLAUDE_MODEL_INVOCABLE = new Set(["codex-exec", "show-me", "visual-pr"]);
export const CODEX_IMPLICIT_INVOCABLE = new Set(["show-me", "visual-pr"]);

type Json = Record<string, unknown>;

function isMapping(value: unknown): value is Json {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFile(path: string): boolean {
  try {
    return statSync(path).isFile();
  } catch {
    return false;
  }
}

function isDir(path: string): boolean {
  try {
    return statSync(path).isDirectory();
  } catch {
    return false;
  }
}

function stripChars(value: string, ch: string): string {
  let start = 0;
  let end = value.length;
  while (start < end && value[start] === ch) start += 1;
  while (end > start && value[end - 1] === ch) end -= 1;
  return value.slice(start, end);
}

function unquote(value: string): string {
  return stripChars(stripChars(value, '"'), "'");
}

/** Recursive file walk that, like Python's rglob, does not descend symlinked dirs. */
function walk(root: string, match: (name: string) => boolean): string[] {
  if (!isDir(root)) return [];
  const out: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop()!;
    for (const entry of readdirSync(dir)) {
      const path = join(dir, entry);
      const stat = lstatSync(path);
      if (stat.isDirectory()) {
        stack.push(path);
      } else if (match(entry) && isFile(path)) {
        out.push(path);
      }
    }
  }
  return out.sort();
}

function loadJson(root: string, path: string, rep: Reporter): Json | null {
  try {
    return JSON.parse(readFileSync(path, "utf8")) as Json;
  } catch (error) {
    rep.fail(`${rel(root, path)}: cannot parse JSON: ${errorMessage(error)}`);
    return null;
  }
}

function rel(root: string, path: string): string {
  return relative(root, path).split(sep).join("/") || ".";
}

/** Run one validation unit; a crash becomes a [FAIL] instead of aborting siblings. */
function guarded(rep: Reporter, label: string, fn: () => void): void {
  try {
    fn();
  } catch (error) {
    rep.fail(`${label}: unexpected validation error: ${errorMessage(error)}`);
  }
}

// ── SKILL.md ────────────────────────────────────────────────────────────────

function strictYamlGate(label: string, fmLines: string[], rep: Reporter): boolean {
  let parsed: unknown;
  try {
    parsed = parseYaml(fmLines.join("\n"));
  } catch (error) {
    const detail = errorMessage(error).split("\n")[0].trim().replace(/:$/, "");
    rep.fail(
      `${label}: frontmatter is not valid YAML (${detail}) — ` +
        "the `npx skills` installer would skip this skill. " +
        "Quote any value containing ': ' (e.g. wrap the description in double quotes).",
    );
    return false;
  }
  if (!isMapping(parsed)) {
    rep.fail(`${label}: frontmatter does not parse to a mapping`);
    return false;
  }
  return true;
}

/** Lenient line-based extraction of top-level scalars plus the description. */
function extractSkillFields(fmLines: string[]): { fields: Map<string, string>; description: string | null } {
  const fields = new Map<string, string>();
  let description: string | null = null;
  let i = 0;
  while (i < fmLines.length) {
    const line = fmLines[i];
    if (!line || line[0] === " " || line[0] === "\t" || line[0] === "#" || !line.includes(":")) {
      i += 1;
      continue;
    }
    const colon = line.indexOf(":");
    const key = line.slice(0, colon).trim();
    const value = line.slice(colon + 1).trim();
    if (key === "description") {
      if ([">", "|", ">-", "|-", ">+", "|+", ""].includes(value)) {
        const parts: string[] = [];
        let j = i + 1;
        while (j < fmLines.length && (fmLines[j].startsWith("  ") || fmLines[j].startsWith("\t") || fmLines[j] === "")) {
          const stripped = fmLines[j].trim();
          if (stripped) parts.push(stripped);
          j += 1;
        }
        description = parts.join(" ");
        i = j;
        continue;
      }
      description = unquote(value);
    } else {
      fields.set(key, unquote(value));
    }
    i += 1;
  }
  return { fields, description };
}

function detectInternal(fmLines: string[]): boolean {
  let internal = false;
  let inMeta = false;
  for (const line of fmLines) {
    if (/^metadata:\s*$/.test(line)) {
      inMeta = true;
      continue;
    }
    if (inMeta) {
      if (line && !/^\s/.test(line)) {
        inMeta = false;
      } else if (/^\s+internal:\s*true\s*$/.test(line)) {
        internal = true;
      }
    }
  }
  return internal;
}

export function validateSkillMd(
  path: string,
  label: string,
  skillName: string,
  pluginName: string,
  hasUmbrella: boolean,
  rep: Reporter,
): void {
  const lines = readFileSync(path, "utf8").split(/\r?\n/);
  // splitlines() drops the empty string after a trailing newline.
  if (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();

  if (lines.length === 0 || lines[0].trim() !== "---") {
    rep.fail(`${label}: missing opening frontmatter fence ('---' as first line)`);
    return;
  }
  const fmLines: string[] = [];
  let closed = false;
  for (const line of lines.slice(1)) {
    if (line.trim() === "---") {
      closed = true;
      break;
    }
    fmLines.push(line);
  }
  if (!closed) {
    rep.fail(`${label}: missing closing frontmatter fence`);
    return;
  }

  if (!strictYamlGate(label, fmLines, rep)) return;

  const { fields, description } = extractSkillFields(fmLines);

  const name = fields.get("name");
  if (!name) {
    rep.fail(`${label}: missing 'name' in frontmatter`);
    return;
  }
  if (name !== skillName) rep.fail(`${label}: name '${name}' does not match folder '${skillName}'`);
  if (!NAME_RE.test(name)) rep.fail(`${label}: name '${name}' must be lowercase kebab-case`);
  if (name.length > 64) rep.fail(`${label}: name exceeds 64 chars`);

  if (!description) rep.fail(`${label}: missing 'description' in frontmatter`);

  if (lines.length > 500) rep.warn(`${label}: ${lines.length} lines exceeds 500-line spec recommendation`);

  if (description && description.length > 1024) {
    rep.fail(`${label}: description is ${description.length} chars (max 1024)`);
  }

  const disableMi = fields.get("disable-model-invocation") === "true";
  const userInvocable = fields.get("user-invocable");
  const hasAllowedTools = fields.has("allowed-tools");
  const internal = detectInternal(fmLines);
  const isUmbrella = skillName === pluginName;

  const claudeAutoInvocable =
    isUmbrella &&
    CLAUDE_MODEL_INVOCABLE.has(skillName) &&
    !internal &&
    fields.get("disable-model-invocation") === "false";
  if (!disableMi && !claudeAutoInvocable) {
    rep.fail(
      `${label}: every skill entrypoint must set ` +
        "'disable-model-invocation: true'; skills are human-invoked only",
    );
  }

  // A grouped pack's leaf entries are implementation shims. Pi remains a
  // command-only exception: its phase skills retain metadata.internal for
  // flat-installer packaging but stay human-invocable because it has no
  // umbrella router.
  if (hasUmbrella && !isUmbrella) {
    if (hasAllowedTools) {
      rep.fail(
        `${label}: per-command wrapper in an umbrella pack must not set ` +
          "'allowed-tools'; put the union allowlist on " +
          `${pluginName}/skills/${pluginName}/SKILL.md because the umbrella ` +
          "is the active routed skill",
      );
    }
    if (!disableMi) {
      rep.fail(
        `${label}: per-command wrapper in an umbrella pack must set ` +
          "'disable-model-invocation: true' (so the model routes through the " +
          "umbrella, not the wrapper; see CLAUDE.md)",
      );
    }
    if (!internal) {
      rep.fail(
        `${label}: per-command wrapper requires 'metadata.internal: true' ` +
          "(user-only wrappers must be hidden from flat-list installers like " +
          "npx skills/Codex; add a metadata block with 'internal: true')",
      );
    }
    if (userInvocable !== "false") {
      rep.fail(
        `${label}: per-command wrapper in an umbrella pack requires ` +
          "'user-invocable: false' (wrappers must stay out of the Claude Code " +
          "/ menu so the umbrella is the only scoped entry)",
      );
    }
  } else if (!isUmbrella) {
    // Umbrella-less pack (pi): the phase commands are the only entrypoints,
    // so they stay human-invocable, but they must keep metadata.internal so
    // flat-list installers do not surface them as standalone skills.
    if (!internal) {
      rep.fail(
        `${label}: phase command in an umbrella-less pack requires ` +
          "'metadata.internal: true' (keeps the phase out of flat-list " +
          "installers like npx skills/Codex; add a metadata block with " +
          "'internal: true')",
      );
    }
    if (userInvocable === "false") {
      rep.fail(
        `${label}: command-only internal skills must omit 'user-invocable' or ` +
          "set it to true so humans can invoke them explicitly",
      );
    }
  } else if (userInvocable === "false") {
    rep.fail(`${label}: public explicit-only skills must omit 'user-invocable' or set it to true`);
  }
}

// ── agents/openai.yaml ──────────────────────────────────────────────────────

/** Validate required Codex policy and optional UI metadata beside a skill. */
export function validateOpenaiYaml(path: string, label: string, skillName: string, rep: Reporter): void {
  const text = readFileSync(path, "utf8");

  // Enforce a portable subset (two-space indent, quoted interface strings) on
  // top of the YAML parse, so every consumer reads the file the same way.
  let policyMalformed = false;
  let inInterface = false;
  let inPolicy = false;
  for (const line of text.split(/\r?\n/)) {
    if (line === "interface:") {
      inInterface = true;
      inPolicy = false;
      continue;
    }
    if (line === "policy:") {
      inPolicy = true;
      inInterface = false;
      continue;
    }
    if ((inInterface || inPolicy) && line && !/^\s/.test(line)) {
      inInterface = false;
      inPolicy = false;
    }
    // Blank lines and comments are structural noise in either block; the two
    // blocks are commonly separated by a blank line.
    if (!line.trim() || line.trimStart().startsWith("#")) continue;
    if (inPolicy) {
      if (!/^ {2}allow_implicit_invocation:\s*(true|false)\s*$/.test(line)) {
        rep.fail(`${label}: policy must contain exactly two-space indented allow_implicit_invocation: true|false`);
        // Keep scanning so interface problems surface in the same run.
        policyMalformed = true;
      }
      continue;
    }
    if (!inInterface) continue;
    if (!/^ {2}[a-z_]+:\s*"[^"]*"\s*$/.test(line)) {
      rep.fail(`${label}: interface entries must use two-space indentation and quoted string values`);
      return;
    }
  }

  let data: unknown;
  try {
    data = parseYaml(text);
  } catch (error) {
    rep.fail(`${label}: cannot parse YAML: ${errorMessage(error)}`);
    return;
  }
  if (!isMapping(data)) {
    rep.fail(`${label}: must contain a YAML mapping`);
    return;
  }

  const policy = data.policy;
  const implicit = CODEX_IMPLICIT_INVOCABLE.has(skillName);
  if (!isMapping(policy) || policy.allow_implicit_invocation !== implicit) {
    // A malformed portable policy line already reported the specific defect.
    if (!policyMalformed) {
      rep.fail(
        `${label}: must set policy.allow_implicit_invocation: ${implicit} (see CODEX_IMPLICIT_INVOCABLE)`,
      );
    }
  }

  const iface = data.interface;
  if (iface === undefined || iface === null) return;
  if (!isMapping(iface)) {
    rep.fail(`${label}: interface must be a mapping when present`);
    return;
  }

  for (const field of ["display_name", "short_description", "default_prompt"]) {
    const value = iface[field];
    if (typeof value !== "string" || !value.trim()) {
      rep.fail(`${label}: interface.${field} must be a non-empty string`);
    }
  }

  const short = iface.short_description;
  if (typeof short === "string" && !(short.length >= 25 && short.length <= 64)) {
    rep.fail(`${label}: interface.short_description must be 25-64 characters (found ${short.length})`);
  }

  const prompt = iface.default_prompt;
  if (typeof prompt === "string" && !prompt.includes(`$${skillName}`)) {
    rep.fail(`${label}: interface.default_prompt must mention '$${skillName}'`);
  }
}

// ── plugin agents ───────────────────────────────────────────────────────────

export function validateAgent(path: string, label: string, expectedName: string, rep: Reporter): void {
  const text = readFileSync(path, "utf8");
  if (!text.startsWith("---\n")) {
    rep.fail(`${label}: missing opening frontmatter fence`);
    return;
  }
  const fence = text.indexOf("\n---\n");
  if (fence === -1) {
    rep.fail(`${label}: missing closing frontmatter fence`);
    return;
  }
  const fields = new Map<string, string>();
  for (const line of text.slice(0, fence).split(/\r?\n/).slice(1)) {
    if (!line || line[0] === " " || line[0] === "\t" || line[0] === "#") continue;
    const colon = line.indexOf(":");
    if (colon === -1) continue;
    fields.set(line.slice(0, colon).trim(), stripChars(line.slice(colon + 1).trim(), '"'));
  }
  const name = fields.get("name");
  if (!name) return rep.fail(`${label}: missing 'name' in frontmatter`);
  if (name !== expectedName) return rep.fail(`${label}: name '${name}' does not match file '${expectedName}.md'`);
  if (!NAME_RE.test(name)) return rep.fail(`${label}: name '${name}' must be lowercase kebab-case`);
  if (name.length > 64) return rep.fail(`${label}: name exceeds 64 chars`);
  if (!fields.get("description")) return rep.fail(`${label}: missing 'description' in frontmatter`);
  for (const unsupported of ["hooks", "mcpServers", "permissionMode"]) {
    if (fields.has(unsupported)) {
      return rep.fail(`${label}: plugin agents must not declare unsupported '${unsupported}' frontmatter`);
    }
  }
}

// ── hooks.json ──────────────────────────────────────────────────────────────

function validateHooks(root: string, path: string, rep: Reporter): void {
  const data = loadJson(root, path, rep);
  if (data === null) return;
  const label = rel(root, path);
  if (!isMapping(data)) return rep.fail(`${label}: hooks file must contain a JSON object`);
  if (!("hooks" in data)) return rep.fail(`${label}: missing top-level "hooks" object`);
  if (!isMapping(data.hooks)) rep.fail(`${label}: top-level "hooks" must be an object`);
}

// ── plugin.json manifests ───────────────────────────────────────────────────

interface ManifestRules {
  flavor: string;
  pathKeys: string[];
  objectKeys: string[];
  crossCheck?: Json;
}

function realOrResolved(path: string): string {
  return existsSync(path) ? realpathSync(path) : resolve(path);
}

function validateManifest(root: string, path: string, expectedName: string, rep: Reporter, rules: ManifestRules): boolean {
  const label = rel(root, path);
  const metaDir = dirname(path);
  const pluginDir = dirname(metaDir);
  const pluginReal = realOrResolved(pluginDir);

  const data = loadJson(root, path, rep);
  if (data === null) return false;

  const name = data.name;
  if (!name) return fail(`${label}: missing name`);
  if (name !== expectedName) return fail(`${label}: name "${name}" does not match directory "${expectedName}"`);
  if (typeof name !== "string" || !NAME_RE.test(name)) return fail(`${label}: name "${name}" must be lowercase kebab-case`);

  const version = data.version;
  if (!version) return fail(`${label}: missing version`);
  if (!SEMVER_RE.test(String(version))) return fail(`${label}: version "${version}" is not semantic-version shaped`);

  if (!data.description) return fail(`${label}: missing description`);

  if ("commands" in data) {
    return fail(
      `${label}: declares a "commands" path — flat commands/*.md do not ` +
        "acquire the plugin namespace; convert each into skills/<name>/SKILL.md (see CLAUDE.md)",
    );
  }
  if (isDir(join(pluginDir, "commands"))) {
    return fail(
      `${rel(root, pluginDir)}: plugin-root commands/ directory is forbidden — flat ` +
        "commands/*.md do not acquire the plugin namespace; convert each " +
        "into skills/<name>/SKILL.md (see CLAUDE.md)",
    );
  }

  const extras = readdirSync(metaDir).filter((entry) => entry !== "plugin.json").sort();
  if (extras.length > 0) {
    return fail(`${rel(root, metaDir)}: only plugin.json belongs in ${rules.flavor} (found: ${extras.join(", ")})`);
  }

  const validatePathEntry = (key: string, entry: unknown): boolean => {
    if (typeof entry !== "string") return fail(`${label}: ${key} entries must be strings`);
    if (!entry.startsWith("./")) return fail(`${label}: ${key} path "${entry}" must start with ./`);
    const target = realOrResolved(join(pluginDir, entry.slice(2)));
    if (target !== pluginReal && !target.startsWith(pluginReal + sep)) {
      return fail(`${label}: ${key} path "${entry}" escapes the plugin root`);
    }
    if (!existsSync(target)) return fail(`${label}: ${key} path "${entry}" does not exist`);
    return true;
  };

  for (const key of rules.pathKeys) {
    const value = data[key];
    if (value === undefined || value === null) continue;
    const entries = typeof value === "string" ? [value] : value;
    if (!Array.isArray(entries)) return fail(`${label}: ${key} must be a string or list of strings`);
    for (const entry of entries) if (!validatePathEntry(key, entry)) return false;
  }

  for (const key of rules.objectKeys) {
    const value = data[key];
    if (value === undefined || value === null || isMapping(value)) continue;
    const entries = typeof value === "string" ? [value] : value;
    if (!Array.isArray(entries)) {
      return fail(`${label}: ${key} must be a relative path, list of relative paths, or inline object`);
    }
    for (const entry of entries) if (!validatePathEntry(key, entry)) return false;
  }

  if (rules.crossCheck) {
    const claude = rules.crossCheck;
    if (name !== claude.name) return fail(`${label}: name "${name}" does not match .claude-plugin name "${claude.name}"`);
    if (version !== claude.version) {
      return fail(`${label}: version "${version}" does not match .claude-plugin version "${claude.version}"`);
    }
  }
  return true;

  function fail(msg: string): false {
    rep.fail(msg);
    return false;
  }
}

function validatePlugin(root: string, pluginDir: string, rep: Reporter): void {
  const pluginName = basename(pluginDir);
  const manifest = join(pluginDir, ".claude-plugin", "plugin.json");

  if (
    !validateManifest(root, manifest, pluginName, rep, {
      flavor: ".claude-plugin",
      pathKeys: ["agents", "skills", "outputStyles"],
      objectKeys: ["hooks", "mcpServers", "lspServers"],
    })
  ) {
    return; // a malformed manifest skips the rest of this plugin (and its [OK])
  }

  const skillFiles = walk(join(pluginDir, "skills"), (name) => name === "SKILL.md");
  const agentFiles = walk(join(pluginDir, "agents"), (name) => name.endsWith(".md"));
  if (skillFiles.length === 0 && agentFiles.length === 0) rep.fail(`${rel(root, pluginDir)}: no skills or agents found`);

  const hasUmbrella = isFile(join(pluginDir, "skills", pluginName, "SKILL.md"));

  for (const skillFile of skillFiles) {
    const label = rel(root, skillFile);
    const skillName = basename(dirname(skillFile));
    guarded(rep, label, () => validateSkillMd(skillFile, label, skillName, pluginName, hasUmbrella, rep));
    const openaiYaml = join(dirname(skillFile), "agents", "openai.yaml");
    if (!isFile(openaiYaml)) {
      rep.fail(`${label}: missing agents/openai.yaml with a policy.allow_implicit_invocation setting`);
    } else {
      const yamlLabel = rel(root, openaiYaml);
      guarded(rep, yamlLabel, () => validateOpenaiYaml(openaiYaml, yamlLabel, skillName, rep));
    }
  }

  for (const agentFile of agentFiles) {
    const label = rel(root, agentFile);
    guarded(rep, label, () => validateAgent(agentFile, label, basename(agentFile, ".md"), rep));
  }

  const hooksFile = join(pluginDir, "hooks", "hooks.json");
  if (isFile(hooksFile)) guarded(rep, rel(root, hooksFile), () => validateHooks(root, hooksFile, rep));

  const codexManifest = join(pluginDir, ".codex-plugin", "plugin.json");
  if (isFile(codexManifest)) {
    guarded(rep, rel(root, codexManifest), () => {
      validateManifest(root, codexManifest, pluginName, rep, {
        flavor: ".codex-plugin",
        pathKeys: ["skills", "apps"],
        objectKeys: ["mcpServers"],
        crossCheck: loadJson(root, manifest, rep) ?? {},
      });
    });
  }

  // Printed even when a skill/agent/hooks/codex sub-check failed above; only a
  // malformed .claude-plugin manifest skips it.
  rep.ok(pluginName);
}

// ── marketplaces ────────────────────────────────────────────────────────────

/** Top-level plugin folders: every non-hidden dir with a manifest of `flavor`. */
export function pluginDirs(root: string, flavor = ".claude-plugin"): string[] {
  return readdirSync(root)
    .filter((entry) => !entry.startsWith(".") && isFile(join(root, entry, flavor, "plugin.json")))
    .sort()
    .map((entry) => join(root, entry));
}

function manifestNames(root: string, flavor: string, rep: Reporter): Map<string, unknown> | null {
  const names = new Map<string, unknown>();
  for (const dir of pluginDirs(root, flavor)) {
    const data = loadJson(root, join(dir, flavor, "plugin.json"), rep);
    if (data === null) return null;
    names.set(basename(dir), data.name);
  }
  return names;
}

function entryPathName(source: unknown): string | null {
  const path = typeof source === "string" ? source : isMapping(source) ? source.path : null;
  if (typeof path !== "string" || !path) return null;
  return basename(path.replace(/^[./]+/, "")) || null;
}

function crossCheckMarketplace(
  label: string,
  names: Set<string>,
  entryPath: Map<string, string>,
  manifests: Map<string, unknown>,
  kind: string,
  extraHint: string,
  rep: Reporter,
): boolean {
  let failed = false;
  const expected = new Set(manifests.keys());
  const missing = [...expected].filter((name) => !names.has(name)).sort();
  const extra = [...names].filter((name) => !expected.has(name)).sort();
  if (missing.length > 0) {
    rep.fail(`${label}: missing plugins (have ${kind} manifest but no marketplace entry): ${missing.join(", ")}`);
    failed = true;
  }
  if (extra.length > 0) {
    rep.fail(`${label}: unexpected plugins (marketplace entry with no ${kind} manifest${extraHint}): ${extra.join(", ")}`);
    failed = true;
  }
  for (const name of [...names].filter((n) => expected.has(n)).sort()) {
    if (entryPath.has(name) && entryPath.get(name) !== name) {
      rep.fail(`${label}: plugin "${name}" source path points at "${entryPath.get(name)}" (expected folder "${name}")`);
      failed = true;
    }
    if (manifests.get(name) !== name) {
      rep.fail(`${label}: plugin "${name}" manifest name is ${repr(manifests.get(name))} (expected "${name}")`);
      failed = true;
    }
  }
  return !failed;
}

function validateMarketplace(root: string, path: string, rep: Reporter): void {
  const label = rel(root, path);
  const data = loadJson(root, path, rep);
  if (data === null) return;
  if (!data.name) return rep.fail(`${label}: missing name`);
  if (!data.owner) return rep.fail(`${label}: missing owner`);
  const plugins = Array.isArray(data.plugins) ? (data.plugins as Json[]) : [];
  if (plugins.length === 0) return rep.fail(`${label}: no plugins listed`);

  const names = new Set<string>();
  const entryPath = new Map<string, string>();
  for (const [i, plugin] of plugins.entries()) {
    const name = plugin.name as string;
    if (!name) return rep.fail(`${label}: plugins[${i}] missing name`);
    if (names.has(name)) return rep.fail(`${label}: duplicate plugin name "${name}"`);
    names.add(name);
    if (!plugin.source) return rep.fail(`${label}: plugins[${i}] ("${name}") missing source`);
    const sourceName = entryPathName(plugin.source);
    if (sourceName) entryPath.set(name, sourceName);
  }

  const manifests = manifestNames(root, ".claude-plugin", rep);
  if (manifests === null) return;
  if (crossCheckMarketplace(label, names, entryPath, manifests, "Claude", "", rep)) {
    rep.ok(`marketplace.json (${plugins.length} plugins)`);
  }
}

function validateCodexMarketplace(root: string, path: string, rep: Reporter): void {
  const label = rel(root, path);
  const data = loadJson(root, path, rep);
  if (data === null) return;
  const plugins = data.plugins ?? [];
  if (!Array.isArray(plugins)) return rep.fail(`${label}: plugins must be a list`);

  const rootReal = realOrResolved(root);
  const names = new Set<string>();
  const entryPath = new Map<string, string>();
  for (const [i, plugin] of (plugins as Json[]).entries()) {
    const name = plugin.name as string;
    const source = plugin.source ?? {};
    const relPath = isMapping(source) ? source.path : source;
    if (!name) return rep.fail(`${label}: plugins[${i}] missing name`);
    if (names.has(name)) return rep.fail(`${label}: duplicate plugin name "${name}"`);
    names.add(name);
    if (!relPath) return rep.fail(`${label}: plugins[${i}] ("${name}") missing source.path`);
    // A repo-scoped marketplace: every source.path must be a repo-local
    // "./<plugin>", so "../elsewhere/distill" cannot pass on its basename.
    if (typeof relPath !== "string" || !relPath.startsWith("./")) {
      return rep.fail(`${label}: plugins[${i}] ("${name}") source.path ${repr(relPath)} must start with ./`);
    }
    const target = realOrResolved(join(root, relPath));
    if (target !== rootReal && !target.startsWith(rootReal + sep)) {
      return rep.fail(`${label}: plugins[${i}] ("${name}") source.path ${repr(relPath)} escapes the repo root`);
    }
    if (relPath !== `./${name}`) {
      return rep.fail(`${label}: plugins[${i}] ("${name}") source.path ${repr(relPath)} must be "./${name}"`);
    }
    if (!existsSync(target)) {
      return rep.fail(`${label}: plugins[${i}] ("${name}") points to missing path ${repr(relPath)}`);
    }
    if (!existsSync(join(target, ".codex-plugin", "plugin.json"))) {
      return rep.fail(
        `${label}: plugins[${i}] ("${name}") points to ${repr(relPath)} but that folder has no .codex-plugin/plugin.json`,
      );
    }
    entryPath.set(name, basename(relPath));
  }

  const manifests = manifestNames(root, ".codex-plugin", rep);
  if (manifests === null) return;
  if (crossCheckMarketplace(label, names, entryPath, manifests, "Codex", ", e.g. the Codex-excluded pi", rep)) {
    rep.ok(`${label} (${plugins.length} plugins)`);
  }
}

// ── entrypoint ──────────────────────────────────────────────────────────────

export function validateStructure(root: string, rep: Reporter): void {
  const plugins = pluginDirs(root);
  if (plugins.length === 0) {
    rep.fail("No plugins found (no .claude-plugin/plugin.json files).");
    return;
  }

  rep.info(`Found ${plugins.length} plugins.`);
  for (const dir of plugins) guarded(rep, rel(root, dir), () => validatePlugin(root, dir, rep));

  const marketplace = join(root, ".claude-plugin", "marketplace.json");
  if (isFile(marketplace)) {
    guarded(rep, rel(root, marketplace), () => validateMarketplace(root, marketplace, rep));
  } else {
    rep.warn("No .claude-plugin/marketplace.json found");
  }

  const codexMarketplace = join(root, ".agents", "plugins", "marketplace.json");
  if (isFile(codexMarketplace)) {
    guarded(rep, rel(root, codexMarketplace), () => validateCodexMarketplace(root, codexMarketplace, rep));
  } else {
    rep.warn("No .agents/plugins/marketplace.json found");
  }
}

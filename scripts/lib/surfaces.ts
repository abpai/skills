// Derived version surfaces: both plugin.json manifests, versions.json, and the
// plugin cards in docs/index.html. Each one is computed from the version
// sources (public SKILL.md metadata.version, else .claude-plugin/plugin.json).
// `checkSurfaces` only reads; `fixSurfaces` is the one place that rewrites them.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import {
  MetadataError,
  collectVersionSources,
  generateVersionsJson,
  planManifestSync,
  syncPluginManifestVersions,
} from "../skill-metadata";
import { Reporter, errorMessage, repr } from "./report";

const FIX_HINT = "run `bin/skills fix`";

function expectedVersions(root: string, rep: Reporter): Record<string, string> | null {
  try {
    return collectVersionSources(root).versions;
  } catch (error) {
    if (error instanceof MetadataError) {
      for (const failure of error.failures) rep.fail(failure);
    } else {
      rep.fail(`version sources: ${errorMessage(error)}`);
    }
    return null;
  }
}

// ── docs/index.html ─────────────────────────────────────────────────────────

interface DocsIndex {
  cards: Array<{ name: string; version: string }>;
  metaCounts: Array<{ label: string; content: string }>;
  pluginCount: string | null;
  resultCount: string | null;
}

function attrs(raw: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const match of raw.matchAll(/([\w:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
    out.set(match[1], match[2] ?? match[3] ?? "");
  }
  return out;
}

function decode(text: string): string {
  return text
    .replace(/&ensp;|&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

/** A small tag scanner, enough for the card markup this page uses. */
export function parseDocsIndex(html: string): DocsIndex {
  const doc: DocsIndex = { cards: [], metaCounts: [], pluginCount: null, resultCount: null };
  let inCard = false;
  let inVersion = false;
  let capture: "name" | "version" | "plugin-count" | "result-count" | null = null;
  let name = "";
  let version = "";

  const token = /<(\/?)([a-zA-Z][\w-]*)([^>]*)>|([^<]+)/g;
  for (const match of html.matchAll(token)) {
    const [, closing, rawTag, rawAttrs, text] = match;
    if (text !== undefined) {
      const data = decode(text);
      if (capture === "name") name += data;
      else if (capture === "version") version += data;
      else if (capture === "plugin-count") doc.pluginCount = (doc.pluginCount ?? "") + data;
      else if (capture === "result-count") doc.resultCount = (doc.resultCount ?? "") + data;
      continue;
    }
    const tag = rawTag.toLowerCase();
    if (!closing) {
      const attributes = attrs(rawAttrs);
      const classes = new Set((attributes.get("class") ?? "").split(/\s+/).filter(Boolean));
      if (tag === "meta") {
        const label = attributes.get("name") ?? attributes.get("property");
        const content = attributes.get("content");
        if ((label === "description" || label === "og:description") && content) {
          doc.metaCounts.push({ label, content: decode(content) });
        }
      } else if (tag === "article" && classes.has("skill-card")) {
        inCard = true;
        name = "";
        version = "";
      } else if (inCard && tag === "h3" && classes.has("card-name")) {
        capture = "name";
      } else if (inCard && tag === "span" && classes.has("card-version")) {
        inVersion = true;
      } else if (inCard && inVersion && tag === "strong") {
        capture = "version";
      } else if (tag === "strong" && attributes.get("id") === "pluginCount") {
        capture = "plugin-count";
        doc.pluginCount ??= "";
      } else if (tag === "span" && attributes.get("id") === "resultCount") {
        capture = "result-count";
        doc.resultCount ??= "";
      }
      continue;
    }
    if (tag === "h3" && capture === "name") capture = null;
    else if (tag === "strong" && (capture === "version" || capture === "plugin-count")) capture = null;
    else if (tag === "span" && capture === "result-count") capture = null;
    else if (tag === "span" && inVersion) inVersion = false;
    else if (tag === "article" && inCard) {
      doc.cards.push({ name: name.trim(), version: version.trim() });
      inCard = false;
      inVersion = false;
      capture = null;
    }
  }
  return doc;
}

function checkDocsIndex(path: string, label: string, expected: Record<string, string>, rep: Reporter): void {
  const doc = parseDocsIndex(readFileSync(path, "utf8"));
  let failed = false;
  const fail = (msg: string) => {
    rep.fail(msg);
    failed = true;
  };

  const cardVersions = new Map<string, string>();
  const duplicates = new Set<string>();
  for (const card of doc.cards) {
    if (!card.name) {
      fail(`${label}: plugin card missing card-name`);
      continue;
    }
    if (!card.version) {
      fail(`${label}: plugin card for ${repr(card.name)} missing card-version`);
      continue;
    }
    if (cardVersions.has(card.name)) duplicates.add(card.name);
    cardVersions.set(card.name, card.version);
  }
  if (duplicates.size > 0) fail(`${label}: duplicate plugin cards: ${[...duplicates].sort().join(", ")}`);

  const names = Object.keys(expected);
  const missing = names.filter((name) => !cardVersions.has(name)).sort();
  const extra = [...cardVersions.keys()].filter((name) => !(name in expected)).sort();
  if (missing.length > 0) fail(`${label}: missing plugin cards: ${missing.join(", ")}`);
  if (extra.length > 0) fail(`${label}: unexpected plugin cards: ${extra.join(", ")}`);
  for (const name of names.filter((n) => cardVersions.has(n)).sort()) {
    if (cardVersions.get(name) !== expected[name]) {
      fail(
        `${label}: ${name} card version ${repr(cardVersions.get(name))} does not match ` +
          `version source ${repr(expected[name])} (${FIX_HINT})`,
      );
    }
  }

  const count = names.length;
  if (doc.pluginCount === null) fail(`${label}: missing #pluginCount stat`);
  else if (doc.pluginCount.trim() !== String(count)) {
    fail(`${label}: #pluginCount is ${repr(doc.pluginCount.trim())} (expected ${count})`);
  }
  const expectedResult = `${count} / ${count}`;
  if (doc.resultCount === null) fail(`${label}: missing #resultCount text`);
  else {
    const result = doc.resultCount.trim().split(/\s+/).join(" ");
    if (result !== expectedResult) fail(`${label}: #resultCount is ${repr(result)} (expected ${repr(expectedResult)})`);
  }
  if (doc.metaCounts.length === 0) fail(`${label}: missing description/og:description plugin count`);
  for (const { label: meta, content } of doc.metaCounts) {
    const first = content.match(/\b\d+\b/);
    if (!first) fail(`${label}: ${meta} meta description has no plugin count`);
    else if (Number(first[0]) !== count) {
      fail(`${label}: ${meta} meta description count ${first[0]} does not match ${count}`);
    }
  }

  if (!failed) rep.ok(`${label} (${count} plugin cards)`);
}

/** Rewrite existing card versions in docs/index.html. Adding or removing a card stays a manual edit. */
function fixDocsIndex(path: string, expected: Record<string, string>): string[] {
  const html = readFileSync(path, "utf8");
  const changed: string[] = [];
  const next = html.replace(/<article class="skill-card"[\s\S]*?<\/article>/g, (card) => {
    const name = card.match(/<h3 class="card-name">([^<]*)<\/h3>/)?.[1]?.trim();
    const want = name ? expected[name] : undefined;
    if (!want) return card;
    return card.replace(/(<span class="card-version">[^<]*<strong>)([^<]*)(<\/strong>)/, (whole, open, have, close) => {
      if (have.trim() === want) return whole;
      changed.push(`docs/index.html ${name}: ${have.trim()} -> ${want}`);
      return `${open}${want}${close}`;
    });
  });
  if (next !== html) writeFileSync(path, next);
  return changed;
}

// ── entrypoints ─────────────────────────────────────────────────────────────

export function checkSurfaces(root: string, rep: Reporter): void {
  const expected = expectedVersions(root, rep);
  if (expected === null) return;

  const manifestUpdates = planManifestSync(root);
  for (const update of manifestUpdates) {
    rep.fail(`${update.path}: version ${repr(update.from)} should be ${repr(update.to)} (${FIX_HINT})`);
  }
  if (manifestUpdates.length === 0) rep.ok("plugin manifest versions match their version sources");

  const versionsPath = join(root, "versions.json");
  if (!existsSync(versionsPath)) {
    rep.fail(`versions.json: missing file (${FIX_HINT})`);
  } else {
    const actual = readFileSync(versionsPath, "utf8");
    if (actual === generateVersionsJson(root)) {
      rep.ok(`versions.json (${Object.keys(expected).length} skills)`);
    } else {
      let skills: Record<string, string> = {};
      try {
        skills = (JSON.parse(actual).skills ?? {}) as Record<string, string>;
      } catch {
        // A parse failure is still just "stale": the fix regenerates it.
      }
      const drift = Object.keys(expected)
        .filter((key) => skills[key] !== expected[key])
        .map((key) => `${key} ${skills[key] ?? "missing"} != ${expected[key]}`);
      const extra = Object.keys(skills).filter((key) => !(key in expected));
      const detail = [...drift, ...extra.map((key) => `${key} unexpected`)].join("; ") || "formatting differs";
      rep.fail(`versions.json is stale: ${detail} (${FIX_HINT})`);
    }
  }

  const docsIndex = join(root, "docs", "index.html");
  if (existsSync(docsIndex)) checkDocsIndex(docsIndex, "docs/index.html", expected, rep);
  else rep.warn("No docs/index.html found");
}

/** Rewrite every derived surface from the version sources. Returns what changed. */
export function fixSurfaces(root: string): string[] {
  const changed = syncPluginManifestVersions(root).updated.map((u) => `${u.path}: ${u.from} -> ${u.to}`);
  const versionsPath = join(root, "versions.json");
  const json = generateVersionsJson(root);
  if (!existsSync(versionsPath) || readFileSync(versionsPath, "utf8") !== json) {
    writeFileSync(versionsPath, json);
    changed.push("versions.json regenerated");
  }
  const docsIndex = join(root, "docs", "index.html");
  if (existsSync(docsIndex)) changed.push(...fixDocsIndex(docsIndex, collectVersionSources(root).versions));
  return changed;
}

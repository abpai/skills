import { afterEach, describe, expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { setSkillVersion } from "../skills";
import { initsBeforeClearingGitEnv } from "./gates";
import { captureReporter } from "./report";
import { strictModeViolations } from "./strict-schema";
import { validateOpenaiYaml, validateSkillMd } from "./structure";
import { parseDocsIndex } from "./surfaces";

const tmpDirs: string[] = [];

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

function tempFile(name: string, content: string): string {
  const dir = mkdtempSync(join(tmpdir(), "skills-structure-"));
  tmpDirs.push(dir);
  const path = join(dir, name);
  writeFileSync(path, content);
  return path;
}

describe("agents/openai.yaml", () => {
  function validate(content: string, skillName = "status-update") {
    const rep = captureReporter();
    validateOpenaiYaml(tempFile("openai.yaml", content), "openai.yaml", skillName, rep);
    return { failed: rep.failed, output: rep.lines.join("\n") };
  }

  const complete = `policy:
  allow_implicit_invocation: false
interface:
  display_name: "Status Update"
  short_description: "Understand long-running agent work quickly."
  default_prompt: "Use $status-update to summarize this task."
`;

  test("accepts a complete interface", () => {
    expect(validate(complete).failed).toBe(false);
  });

  test("rejects a default_prompt without the skill reference", () => {
    const { failed, output } = validate(complete.replace("Use $status-update to summarize", "Summarize"));
    expect(failed).toBe(true);
    expect(output).toContain("must mention '$status-update'");
  });

  test("rejects unquoted interface values", () => {
    const { failed, output } = validate(complete.replace('"Status Update"', "Status Update"));
    expect(failed).toBe(true);
    expect(output).toContain("quoted string values");
  });

  test("accepts policy-only metadata", () => {
    expect(validate("policy:\n  allow_implicit_invocation: false\n").failed).toBe(false);
  });

  test("rejects a missing explicit-only policy", () => {
    const { failed, output } = validate(complete.split("interface:")[1].replace(/^/, "interface:"));
    expect(failed).toBe(true);
    expect(output).toContain("allow_implicit_invocation: false");
  });

  test("rejects an implicit Codex policy on an explicit-only skill", () => {
    const { failed, output } = validate("policy:\n  allow_implicit_invocation: true\n");
    expect(failed).toBe(true);
    expect(output).toContain("allow_implicit_invocation: false");
  });

  test("requires the implicit policy for allowlisted skills", () => {
    expect(validate("policy:\n  allow_implicit_invocation: true\n", "visual-pr").failed).toBe(false);
    const { failed, output } = validate("policy:\n  allow_implicit_invocation: false\n", "visual-pr");
    expect(failed).toBe(true);
    expect(output).toContain("allow_implicit_invocation: true");
  });

  test("accepts blank lines and comments around the policy", () => {
    const { failed, output } = validate(
      complete.replace("policy:\n", "policy:\n  # Explicit invocation only.\n").replace("interface:", "\ninterface:"),
    );
    expect(failed, output).toBe(false);
  });

  test("reports interface problems alongside a malformed policy", () => {
    const { failed, output } = validate(
      "policy:\n  allow_implicit_invocation: nope\ninterface:\n  display_name: Status Update\n",
    );
    expect(failed).toBe(true);
    expect(output).toContain("two-space indented");
    expect(output).toContain("quoted string values");
  });
});

describe("SKILL.md frontmatter", () => {
  function validate(frontmatter: string, opts: { skill?: string; plugin?: string; hasUmbrella?: boolean } = {}) {
    const rep = captureReporter();
    const path = tempFile("SKILL.md", `---\n${frontmatter}---\n\n# Phase\n`);
    validateSkillMd(path, "SKILL.md", opts.skill ?? "plan", opts.plugin ?? "pi", opts.hasUmbrella ?? false, rep);
    return { failed: rep.failed, output: rep.lines.join("\n") };
  }

  test("Claude auto-invocation is limited to allowlisted public umbrellas", () => {
    for (const [plugin, skill, internal, accepted] of [
      ["codex-exec", "codex-exec", false, true],
      ["other", "other", false, false],
      ["codex-exec", "other", false, false],
      ["codex-exec", "codex-exec", true, false],
    ] as const) {
      const { failed } = validate(
        `name: ${skill}\ndescription: Delegate work.\ndisable-model-invocation: false\n` +
          (internal ? "metadata:\n  internal: true\n" : ""),
        { skill, plugin },
      );
      expect(failed, `${plugin}/${skill} internal=${internal}`).toBe(!accepted);
    }
  });

  test("requires the internal marker on umbrella-less phase commands", () => {
    const { failed, output } = validate("name: plan\ndescription: Plan a change.\ndisable-model-invocation: true\n");
    expect(failed).toBe(true);
    expect(output).toContain("metadata.internal: true");
  });

  test("accepts an umbrella-less phase command with the internal marker", () => {
    const { failed, output } = validate(
      "name: plan\ndescription: Plan a change.\ndisable-model-invocation: true\nmetadata:\n  internal: true\n",
    );
    expect(failed, output).toBe(false);
  });

  // The installer parses frontmatter with npm `yaml` and silently skips a
  // skill that fails, so these must fail here instead.
  test("rejects frontmatter the npx skills installer cannot parse", () => {
    const unquoted = validate(
      "name: plan\ndescription: Subcommands: 'a' and 'b'\ndisable-model-invocation: true\nmetadata:\n  internal: true\n",
    );
    expect(unquoted.failed).toBe(true);
    expect(unquoted.output).toContain("the `npx skills` installer would skip this skill");

    const duplicate = validate(
      "name: plan\nname: plan\ndescription: Plan.\ndisable-model-invocation: true\nmetadata:\n  internal: true\n",
    );
    expect(duplicate.failed).toBe(true);
  });
});

describe("docs/index.html", () => {
  test("reads cards, counts and meta descriptions", () => {
    const doc = parseDocsIndex(`
      <meta name="description" content="Marketplace of 2 plugins.">
      <strong id="pluginCount">2</strong>&ensp;Plugins
      <span class="result-count" id="resultCount">2 / 2</span>
      <article class="skill-card"><h3 class="card-name">a</h3>
        <span class="card-version">v <strong>1.0.0</strong></span></article>
      <article class="skill-card"><h3 class="card-name">b</h3>
        <span class="card-version">v <strong>2.1.0</strong></span></article>`);
    expect(doc.cards).toEqual([
      { name: "a", version: "1.0.0" },
      { name: "b", version: "2.1.0" },
    ]);
    expect(doc.pluginCount).toBe("2");
    expect(doc.resultCount).toBe("2 / 2");
    expect(doc.metaCounts).toEqual([{ label: "description", content: "Marketplace of 2 plugins." }]);
  });
});

describe("skills bump", () => {
  test("rewrites metadata.version and keeps its quoting", () => {
    const text = '---\nname: x\nversion: 9.9.9\nmetadata:\n  internal: false\n  version: "1.2.3"\n---\nversion: 1.2.3\n';
    expect(setSkillVersion(text, "1.2.4")).toBe(
      '---\nname: x\nversion: 9.9.9\nmetadata:\n  internal: false\n  version: "1.2.4"\n---\nversion: 1.2.3\n',
    );
  });

  test("fails loudly without a metadata.version", () => {
    expect(() => setSkillVersion("---\nname: x\n---\n", "1.0.0")).toThrow("no metadata.version");
  });
});

describe("fixture test hygiene", () => {
  test("flags a git init before clearing git's repo-local env", () => {
    expect(initsBeforeClearingGitEnv('git init "$repo"\nunset $(git rev-parse --local-env-vars)\n')).toBe(true);
    expect(initsBeforeClearingGitEnv('unset $(git rev-parse --local-env-vars)\ngit -C "$r" init\n')).toBe(false);
    expect(initsBeforeClearingGitEnv("# git init in a comment\n")).toBe(false);
  });
});

describe("strict-mode schemas", () => {
  test("requires every property in required", () => {
    expect(strictModeViolations({ type: "object", properties: { a: {}, b: {} }, required: ["a", "b"] }, "s")).toEqual([]);
    expect(strictModeViolations({ properties: { a: {}, b: {} }, required: ["a"] }, "s")[0]).toContain("missing property key(s): b");
    expect(strictModeViolations({ items: [{ properties: { a: {} } }] }, "s")[0]).toContain("s/items[0]: object has properties");
  });
});

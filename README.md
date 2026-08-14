# abpai/skills — Claude Code Marketplace + Codex Plugin Repo

A collection of reusable AI workflow plugins and skills for structured
planning, cross-domain thinking, multi-model tooling, and developer
productivity.

This repository now ships metadata for both runtimes:

- Claude Code plugins via `.claude-plugin/plugin.json` plus the root Claude marketplace
- Codex plugins via `.codex-plugin/plugin.json` plus a repo-scoped Codex marketplace at `.agents/plugins/marketplace.json`

## Quick Start

### Claude Code

Run these slash commands **inside a Claude Code session**:

```bash
# Add the marketplace (once)
/plugin marketplace add abpai/skills

# Install common plugins
/plugin install distill@abpai-skills
/plugin install lateral-thinking@abpai-skills
/plugin install engineering@abpai-skills
/plugin install harness@abpai-skills
/plugin install code@abpai-skills
/plugin install tutorial@abpai-skills
/plugin install codex-exec@abpai-skills
/plugin install codex-session@abpai-skills
/plugin install cursor@abpai-skills
/plugin install status-update@abpai-skills
```

### Codex

Codex currently documents repo-scoped and personal local marketplaces. This
repo includes a repo marketplace at `.agents/plugins/marketplace.json` that
points at the top-level plugin folders with local `source.path` entries.

```bash
git clone https://github.com/abpai/skills.git
cd skills
codex
```

Then start or restart Codex in this repo, open the plugin directory, and install the
plugins from the repo marketplace exposed by this checkout.

Codex public plugin-directory publishing is still documented as coming soon, so
the Codex path in this repo is repo-local rather than the Claude-style remote
marketplace flow above.

## Plugins

### Planning & Reasoning

| Plugin | What it does | Standalone? |
|--------|-------------|-------------|
| **distill** | Decompose complex systems into essential primitives. Codebases, papers, transcripts. | Yes |
| **lateral-thinking** | Cross-domain hypothesis generation. Find transferable mechanisms from distant fields. | Yes |
| **codex-exec** | Run Codex headlessly for implementation, review, monitored work, and exact continuation with durable liveness artifacts. | Yes |
| **codex-session** | Inspect local Codex transcripts by UUID without launching Codex or contacting a model provider. | Yes |
| **cursor** | Run Cursor Agent headlessly with durable liveness, review, and exact session continuation. | Yes |

### Code Workflows

| Plugin | What it does |
|--------|-------------|
| **code** | Four focused workflows under `/code`: `prepare-pr --effort low\|medium\|high` carries changes through risk-scaled review, validation, commit, seal, push, and PR update; `simplify [scope]` applies behavior-preserving improvements—including high-signal test-suite pruning—to a named scope or proposes a ranked whole-repo batch; `understand` writes a runnable real-code snippet and an HTML map on request; `handoff` creates a cold-start continuation prompt. |
| **hexagon-audit** | Audit Ports & Adapters (Hexagonal Architecture) compliance in a `packages/` + `adapters/` monorepo, with a deterministic scanner for inward-dependency violations, peer-adapter imports, and vendor SDKs leaking into ports. Standalone — install per project |

### Engineering Practices

| Plugin | What it does |
|--------|-------------|
| **engineering** | Groups engineering-practice workflows behind one scoped `/engineering` umbrella command; run a workflow with `/engineering grill-me`, `/engineering tdd`, `/engineering zoom-out`, `/engineering improve-architecture`, `/engineering defined-terms`, `/engineering complexity-report`, or `/engineering reduce`. Code cleanup now lives under `/code simplify`. |

### Developer Productivity

| Plugin | What it does |
|--------|-------------|
| **cli-design-expert** | Design or review CLIs for usability: flags, exit codes, TTY behavior |
| **harness** | Prepare a repository for agent-driven development with `/harness adopt`, audit readiness or a change with `/harness doctor`, and protect uncertain behavior with `/harness capture` |
| **status-update** | Turn long-running agent work into a concise, evidence-backed snapshot of what is done, active, left, slowing progress, or newly surprising |

Migration aliases are documented rather than silently executed: `review-and-commit`
moves to `code prepare-pr --effort low` and now pushes; `dead-code`,
`thermo-nuclear`, and `test-deslop` move to `code simplify`; `walkthrough` moves
to `code understand`; `secure-dependencies` moves to `harness adopt`;
`engineering clean-code` moves to `code simplify`.

### Tools

| Plugin | What it does |
|--------|-------------|
| **claude** | Run Claude headlessly with deterministic auth and transfer gating, scoped repository reviews, durable artifacts, and exact continuation. |
| **claude-session** | Inspect local Claude Code transcripts by UUID without invoking Claude or contacting Anthropic. |
| **visualize** | Generate single-file HTML visualizations in an ivory/clay editorial gallery style for systems, plans, or code flows |

### Languages & Platforms

| Plugin | What it does |
|--------|-------------|
| **bun-expert** | Expert Bun runtime guidance: setup, package management, servers, latest built-in APIs, testing, bundling, and Node.js migration |

### Writing

| Plugin | What it does |
|--------|-------------|
| **tutorial** | Write hands-on, self-verified tutorials where every step ends in a runnable action |
| **improve-prompt** | Upgrade vague prompts into sharp, reusable prompts for planning, coding, review, and decision work |
| **human-writer** | Edit prose to sound natural and human-written — deslop model-generated text |

## Repo Structure

```
abpai/skills/
├── .agents/plugins/
│   └── marketplace.json       ← Codex repo marketplace
├── .claude-plugin/
│   └── marketplace.json       ← Claude marketplace catalog
├── <plugin>/                  ← most plugins ship both runtimes
│   ├── .claude-plugin/plugin.json
│   ├── .codex-plugin/plugin.json  ← optional when a plugin is installable in Codex
│   ├── internal/              (optional plugin-private docs/modules)
│   └── skills/<skill>/
│       ├── SKILL.md
│       └── references/        (if any)
├── code/                      ← grouped coding workflows
│   ├── hooks/                 ← always-registered gate-before-push PreToolUse(Bash) hook
│   │   ├── hooks.json
│   │   └── gate-before-push.sh
│   └── skills/
│       ├── code/              ← umbrella skill (/code) + flat workflow modules
│       │   ├── *.md           ← prepare-pr.md, simplify.md, understand.md, handoff.md
│       │   ├── references/
│       │   ├── review-patterns/        ← per-gate lenses
│       │   │   └── scripts/   ← ported executable review assets
│       │   └── scripts/       ← bundled helpers (e.g. finish-lane.ts preflight)
│       ├── prepare-pr/        ← /code:prepare-pr
│       ├── simplify/          ← /code:simplify
│       └── <workflow>/        ← one namespaced skill per workflow
├── engineering/               ← grouped engineering-practice workflows
│   └── skills/
│       ├── engineering/       ← umbrella skill (/engineering) + flat modules
│       │   ├── *.md
│       │   ├── references/
│       │   └── scripts/       ← bundled helpers (e.g. complexity scanner)
│       └── <workflow>/        ← /engineering:<workflow> (one SKILL.md each)
├── harness/                   ← grouped agent-harness workflows
│   └── skills/
│       ├── harness/           ← umbrella skill (/harness) + flat modules
│       │   ├── baseline.md    ← production behavior-baseline workflow
│       │   ├── docs.md        ← progressive-disclosure docs workflow
│       │   └── doctor.md      ← Harness Doctor audit and diff-review workflow
│       ├── baseline/          ← /harness:baseline wrapper
│       ├── doctor/            ← /harness:doctor wrapper
│       └── docs/              ← /harness:docs wrapper
└── README.md
```

Within each plugin folder, only `plugin.json` belongs inside
`.claude-plugin/`. `skills/`, `agents/`, `hooks/`, and optional `internal/`
support docs stay at the plugin root. `internal/` is deliberately not a runtime
discovery directory; use it for flat plugin-private playbooks or supporting
material that should be bundled without becoming separate skills.

### Why every namespaced command is a `skills/<name>/SKILL.md`

> **Do not add a plugin-root `commands/` directory to expose `/<plugin>:<name>`
> commands.** Flat Markdown files under a plugin's `commands/` directory do
> **not** acquire the plugin namespace — they never appear as
> `/code:simplify`, `/engineering:tdd`, etc., so the command is
> silently missing from the `/` menu. Only a **skill subdirectory**
> (`code/skills/simplify/SKILL.md`) deterministically produces the
> namespaced command `/code:simplify`, per the
> [skills command-name rules](https://code.claude.com/docs/en/skills#how-a-skill-gets-its-command-name)
> ("Use `skills/` for new plugins").

Every skill entrypoint in this marketplace is explicit-only: humans invoke it
with `$skill` in Codex or `/skill` in Claude. `SKILL.md` sets
`disable-model-invocation: true` for Claude and the skill-local
`agents/openai.yaml` sets `policy.allow_implicit_invocation: false` for Codex.

The pattern for a grouped workflow pack:

- `skills/<plugin>/SKILL.md` — the explicit human-invoked **umbrella** skill that
  collapses to `/<plugin>` (the single scoped entry in the `/` menu) and routes
  `/<plugin> <workflow>` to the bundled workflow modules (`skills/<plugin>/*.md`,
  which are loose support files, not skills).
- `skills/<workflow>/SKILL.md` — one **per-command** skill per workflow, carrying
  `disable-model-invocation: true`, `user-invocable: false`, and
  `metadata.internal: true`. Together these keep the wrapper out of the model's
  auto-routing, out of the Claude Code `/` menu, and out of flat-list installers,
  leaving the umbrella as the only menu entry — reach a workflow via
  `/<plugin> <workflow>`. The `user-invocable: false` flag matters because Claude
  Code lists each `skills/<workflow>/SKILL.md` in the `/` menu under its **bare
  leaf name** (`/<workflow>`) even though the command itself is namespaced;
  leaving wrappers user-invocable sprawls those leaf-name entries across the menu
  where they collide with each other and with built-ins (e.g. a pack's `/review`
  next to the built-in `/review`).
The umbrella directly reads its bundled Markdown modules and review patterns
after the human invocation. Those modules are not entrypoint skills and do not
need their own invocation policy.

If you reintroduce a `commands/` directory, the namespaced commands disappear.
Keep new workflows as `skills/<name>/SKILL.md`.

## Packaging Notes

This repo follows the current [Codex plugin docs](https://developers.openai.com/codex/plugins/build)
and [Claude Code plugin docs](https://code.claude.com/docs/en/plugins):

- Codex plugins use `.codex-plugin/plugin.json` as the required entry point,
  point `skills` at `./skills/`, and are exposed through the repo marketplace
  at `.agents/plugins/marketplace.json`.
- Claude Code plugins use `.claude-plugin/plugin.json` for identity and expose
  namespaced skills from plugin-root `skills/<name>/SKILL.md` directories. A
  namespaced command (`/<plugin>:<name>`) **must** be a skill subdirectory;
  flat files in a plugin `commands/` directory do not get the namespace and
  never appear in the menu (see [Why every namespaced command is a
  `skills/<name>/SKILL.md`](#why-every-namespaced-command-is-a-skillsnameskillmd)).
- Shared support files stay inside the owning plugin folder. Paths must not
  rely on files outside the plugin, because installed plugins are copied into a
  runtime cache.
- For grouped workflow packs with one public skill, keep workflow modules
  directly inside `skills/<skill>/` and shared supporting docs under
  `skills/<skill>/references/`.
- Use flat files in `internal/` only for plugin-private implementation notes,
  prompts, or command modules that are not part of a public skill.

## Installing Plugins

### Claude Code

#### From the marketplace

Lines starting with `/plugin` are slash commands you run **inside a Claude Code
session**; lines starting with `claude plugin` are run **from your terminal /
CLI**.

```bash
# Inside a session: add the marketplace (once)
/plugin marketplace add abpai/skills

# Inside a session: browse available plugins
/plugin

# From your terminal: install a plugin (user scope, default)
claude plugin install distill@abpai-skills

# Install to project scope (shared with team via .claude/settings.json)
claude plugin install distill@abpai-skills --scope project

# Install to local scope (gitignored, personal)
claude plugin install distill@abpai-skills --scope local
```

#### From a local checkout

```bash
# Test a single plugin without installing
claude --plugin-dir ./distill

# Load multiple plugins at once
claude --plugin-dir ./distill --plugin-dir ./lateral-thinking
```

Inside a running session, use `/reload-plugins` to pick up changes without restarting.

#### Uninstall

```bash
claude plugin uninstall distill@abpai-skills
```

### Codex

#### From this repo (repo-scoped marketplace)

This repo ships a Codex marketplace at `.agents/plugins/marketplace.json` with
local `source.path` entries. Clone the repo and start Codex inside it:

```bash
git clone https://github.com/abpai/skills.git
cd skills
codex
```

Open the plugin directory with `codex /plugins` — the repo marketplace appears
there, and you install the Codex-compatible plugins from it (it is not a fully
automatic install).

The grouped workflow packs, including `engineering` and
`harness`, are Codex-compatible as single umbrella skills. Claude also gets the
namespaced command wrappers such as `/engineering:*` and `/harness:*`.

#### Personal installation

Copy a plugin into your personal plugin directory and register it in your
personal marketplace:

```bash
# Copy the plugin
mkdir -p ~/.codex/plugins
cp -R ./distill ~/.codex/plugins/distill

# Add to personal marketplace (~/.agents/plugins/marketplace.json)
# Each entry needs name, source.path, and policy:
```

```json
{
  "name": "my-plugins",
  "plugins": [
    {
      "name": "distill",
      "source": { "source": "local", "path": "./.codex/plugins/distill" },
      "policy": { "installation": "AVAILABLE" },
      "category": "Productivity"
    }
  ]
}
```

Restart Codex to pick up new plugins.

#### Disable / re-enable

Toggle individual plugins in `~/.codex/config.toml`:

```toml
[plugins.distill]
enabled = false
```

## Validating Plugins

### Claude Code built-in validation

```bash
# Validate a single plugin manifest
claude plugin validate ./distill

# Validate all plugins
for dir in */; do
  [ -f "$dir.claude-plugin/plugin.json" ] && claude plugin validate "./$dir"
done
```

### Codex

Codex does not currently have a built-in `validate` command. Use the project
validation script below, which checks both Claude and Codex manifests.

### Project validation script

This repo includes a comprehensive validator at `scripts/validate-skills.sh` that checks:

- Claude and Codex plugin manifests (name, version, description, paths)
- SKILL.md frontmatter (name, description, explicit-only Claude policy, and
  version metadata for public umbrella skills)
- Skill-local Codex policy (`agents/openai.yaml` must set
  `policy.allow_implicit_invocation: false`) and grouped-pack wrapper
  invariants (wrappers with an umbrella require `metadata.internal: true` and
  `user-invocable: false`)
- Both marketplace.json catalogs (completeness and consistency)
- versions.json (all skills present with matching versions)
- docs/index.html catalog cards, versions, and plugin counts

```bash
bash scripts/validate-skills.sh
```

The script is also run automatically as a pre-commit hook.

## License

MIT

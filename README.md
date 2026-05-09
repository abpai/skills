# abpai/skills — Claude Code Marketplace + Codex Plugin Repo

A collection of reusable AI workflow plugins and skills for structured
planning, cross-domain thinking, multi-model tooling, and developer
productivity.

This repository now ships metadata for both runtimes:

- Claude Code plugins via `.claude-plugin/plugin.json` plus the root Claude marketplace
- Codex plugins via `.codex-plugin/plugin.json` plus a repo-scoped Codex marketplace at `.agents/plugins/marketplace.json`

## Quick Start

### Claude Code

```bash
# Add the marketplace (once)
/plugin marketplace add abpai/skills

# Install planning-oriented skills
/plugin install distill@abpai-skills
/plugin install lateral-thinking@abpai-skills
/plugin install mp@abpai-skills
/plugin install codex-exec@abpai-skills
/plugin install pi@abpai-skills
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

`pi` is intentionally excluded from the Codex marketplace in this repo. It is a
Claude-native workflow that shells out to the `codex` CLI for second-provider
research and review. The debate workflow now lives inside `pi` as
`/pi:debate`, so it is Claude-only too.

## Plugins

### Planning & Reasoning

| Plugin | What it does | Standalone? |
|--------|-------------|-------------|
| **distill** | Decompose complex systems into essential primitives. Codebases, papers, transcripts. | Yes |
| **lateral-thinking** | Cross-domain hypothesis generation. Find transferable mechanisms from distant fields. | Yes |
| **codex-exec** | Delegate prompts to OpenAI Codex CLI for second opinions and adversarial review. | Yes |
| **pi** | Claude-native planner/generator/evaluator harness for long-running engineering work, plus `/pi:debate` for structured architecture debate. | Claude-only |

### Code Quality

| Plugin | What it does |
|--------|-------------|
| **code-simplifier** | Simplify and refine code for clarity, consistency, and maintainability |
| **dead-code-eliminator** | Audit for unreachable functions, unused imports, orphaned classes, stale flags |
| **review-and-commit** | Review uncommitted changes, then prepare safe atomic commits |

### Security

| Plugin | What it does |
|--------|-------------|
| **secure** | Additive security hardening workflows, starting with `/secure:dependencies` for dependency resolution and supply-chain policy |

### Matt Pocock Inspired

| Plugin | What it does |
|--------|-------------|
| **mp** | Groups the imported Matt Pocock-inspired workflows under `/mp:grill-me`, `/mp:tdd`, `/mp:zoom-out`, and `/mp:improve-codebase-architecture` |

### Developer Productivity

| Plugin | What it does |
|--------|-------------|
| **cli-design-expert** | Design or review CLIs for usability: flags, exit codes, TTY behavior |
| **scratch** | Understand a project's internals through runnable .scratch/ exploration scripts |
| **socratic-code-owner** | Quiz the developer on AI-built code to ensure understanding |
| **task** | Convert a rough ask into a hands-off task brief an agent can execute end-to-end |

### Tools

| Plugin | What it does |
|--------|-------------|
| **agent-browser** | Browser automation: navigate, fill forms, click, screenshot, extract data |
| **claude** | Run Claude Code CLI for delegation, session continuation, machine-readable output |
| **try** | Evaluate a new library, tool, or repo before adopting it — prompt-driven demos |
| **visualize** | Generate self-contained HTML visualizations for systems, plans, or code flows |

### Languages & Platforms

| Plugin | What it does |
|--------|-------------|
| **bun-expert** | Expert Bun runtime guidance: setup, servers, APIs, testing, Node.js migration |

### Writing

| Plugin | What it does |
|--------|-------------|
| **explain** | Write dense, progressive-disclosure explainers, tutorials, walkthroughs, and onboarding docs |
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
│   ├── commands/              (if any)
│   └── skills/<skill>/
│       ├── SKILL.md
│       └── references/        (if any)
├── pi/                        ← intentional Claude-only exception
│   ├── .claude-plugin/plugin.json
│   ├── agents/
│   ├── commands/
│   ├── internal/
│   │   └── debate/
│   └── skills/pi-protocol/
└── README.md
```

Within each plugin folder, only `plugin.json` belongs inside
`.claude-plugin/`. `skills/`, `agents/`, `commands/`, and `hooks/` stay at the
plugin root.

## Installing Plugins

### Claude Code

#### From the marketplace

```bash
# Add the marketplace (once)
/plugin marketplace add abpai/skills

# Browse available plugins
/plugin

# Install a plugin (user scope, default)
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

Open the plugin directory with `codex /plugins` — all Codex-compatible
plugins appear automatically from the repo marketplace.

`pi` stays Claude-only in this repo and therefore does not appear in the Codex
marketplace list. The Matt Pocock-inspired workflows are Codex-compatible as
the grouped `mp` plugin.

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
- SKILL.md frontmatter (name, description, metadata.version)
- Agent and command frontmatter
- Both marketplace.json catalogs (completeness and consistency)
- versions.json (all skills present with matching versions)

```bash
bash scripts/validate-skills.sh
```

The script is also run automatically as a pre-commit hook.

## Security Scanning

This repository is configured with [Cisco Skill Scanner](https://github.com/cisco-ai-defense/skill-scanner)
via pre-commit.

1. Install pre-commit: `uv tool install pre-commit`
2. Install hooks: `uvx pre-commit install`
3. (Optional) copy `.env.example` to `.env` and customize scanner settings
4. Run manually: `uvx pre-commit run --all-files`

## License

MIT

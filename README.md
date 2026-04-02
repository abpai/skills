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
/plugin install codex-exec@abpai-skills
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
| **codex-exec** | Delegate prompts to OpenAI Codex CLI for second opinions and adversarial review. | Yes |

### Code Quality

| Plugin | What it does |
|--------|-------------|
| **code-simplifier** | Simplify and refine code for clarity, consistency, and maintainability |
| **dead-code-eliminator** | Audit for unreachable functions, unused imports, orphaned classes, stale flags |
| **review-and-commit** | Review uncommitted changes, then prepare safe atomic commits |

### Developer Productivity

| Plugin | What it does |
|--------|-------------|
| **arch-council** | Architecture debate between Claude and Codex — propose, critique, synthesize |
| **cli-design-expert** | Design or review CLIs for usability: flags, exit codes, TTY behavior |
| **dev-squad** | Scaffold Claude Code hooks, review gates, agents, and team workflows |
| **project-memory** | Always-on memory via `.agents/LEARNINGS.md` — mistakes, patterns, preferences |
| **socratic-code-owner** | Quiz the developer on AI-built code to ensure understanding |

### Tools

| Plugin | What it does |
|--------|-------------|
| **agent-browser** | Browser automation: navigate, fill forms, click, screenshot, extract data |
| **beautiful-mermaid** | Render Mermaid diagrams as SVG and PNG |
| **claude** | Run Claude Code CLI for delegation, session continuation, machine-readable output |
| **try** | Explore and evaluate a library or repo in an isolated scratch environment |
| **visualize** | Generate self-contained HTML visualizations for systems, plans, or code flows |

### Languages & Platforms

| Plugin | What it does |
|--------|-------------|
| **bun-expert** | Expert Bun runtime guidance: setup, servers, APIs, testing, Node.js migration |
| **dokploy** | Operate Dokploy via CLI: projects, environments, apps, databases |

### Writing

| Plugin | What it does |
|--------|-------------|
| **human-writer** | Edit prose to sound natural and human-written — deslop model-generated text |

## Repo Structure

```
abpai/skills/
├── .agents/plugins/
│   └── marketplace.json       ← Codex repo marketplace
├── .claude-plugin/
│   └── marketplace.json       ← Claude marketplace catalog
├── <plugin>/                  ← each plugin follows the same pattern
│   ├── .claude-plugin/plugin.json
│   ├── .codex-plugin/plugin.json
│   └── skills/<plugin>/
│       ├── SKILL.md
│       └── references/        (if any)
└── README.md
```

## Security Scanning

This repository is configured with [Cisco Skill Scanner](https://github.com/cisco-ai-defense/skill-scanner)
via pre-commit.

1. Install pre-commit: `uv tool install pre-commit`
2. Install hooks: `uvx pre-commit install`
3. (Optional) copy `.env.example` to `.env` and customize scanner settings
4. Run manually: `uvx pre-commit run --all-files`

## License

MIT

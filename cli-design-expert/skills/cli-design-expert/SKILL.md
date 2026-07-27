---
name: cli-design-expert
disable-model-invocation: true
description: "Design or review a command-line interface for usability and automation, backed by the clig.dev guidelines — help text, flags, output streams, exit codes, safety, and scriptability."
license: CC-BY-SA-4.0
compatibility: Works with any CLI language/framework. Best with an args parser library and POSIX conventions (stdout/stderr, exit codes, signals). See references/CLI_GUIDELINES.md.
metadata:
  version: "1.2.3"
  author: "cli-guidelines-community"
  upstream_guidelines: "https://clig.dev"
  reference_file: "references/CLI_GUIDELINES.md"
---

# CLI Design Expert

Design, review, or refactor CLIs against the [clig.dev](https://clig.dev)
conventions. Load `references/CLI_GUIDELINES.md` for anything past the P0s and
rubric below: command model, args-vs-flags, help text, TTY behavior, config
precedence, signals, and worked examples all live there.

## P0s — flag any of these first

- Never accept secrets via flags (they leak via `ps` and shell history). Use
  stdin, a secret-file flag, or an OS keychain instead.
- Every interactive prompt needs a non-interactive path (flag/arg/file/stdin)
  and a `--no-input` to disable prompting entirely.
- Destructive actions need confirmation that scales with risk, plus a
  scriptable bypass (`--force`/`--yes`).

## Standard flags

`--json`, `--no-color`, `--no-input`, `-q`/`--quiet`, `-v`/`--verbose`,
`-n`/`--dry-run`.

## Error message shape

```
Error: <what failed, in plain language>.
Cause: <most likely reason>.
Fix: <exact next step / command / flag>.
```

## Design mode

A finished design specifies: command model, args/flags tables, the
stdout/stderr contract, an exit-code map, draft help text, error and safety
design, TTY behavior, and config precedence (if any config exists). Pull the
criteria for each from `references/CLI_GUIDELINES.md`.

Done when all of those are specified and the P0s above are satisfied.

## Review mode

Score each 0-2: command structure and naming; args/flags clarity; help
discoverability (examples first); stdout/stderr correctness; exit-code
discipline; scriptability (non-TTY behavior); machine-output mode (when
appropriate); safety (`--dry-run`, confirmations); secrets handling; signal
handling (Ctrl-C); config precedence (if applicable); future-proofing.

Then list fixes by severity: P0 correctness/safety/scriptability failures, P1
usability/discoverability issues, P2 polish/consistency.

Done when every P0/P1 finding cites command output, help text, or source
evidence; names a concrete change; and includes a validation command or manual
check.

## Reference

Full guideline text: `references/CLI_GUIDELINES.md`.

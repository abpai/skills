# CLI Agent Ergonomics

Review CLI / script / dev-tool surfaces as the first *blind* invocation by an agent at a shell: it guesses a command, parses the output, branches on the exit code, and recovers from a wrong guess — all without reading the source.

## When this gate applies

- Diff touches a command, subcommand, flag, env var, exit code, or output schema (`--json`/robot mode), or the `--help`/usage text.
- Diff touches error/diagnostic text, a setup/doctor/health flow, or a destructive op (delete, force-push, drop, reset, prune).
- The surface is agent-facing or CI-invoked (piped, non-TTY, `CI=true`) — not a tiny human-only one-off script.
- Skip: docs-only changes describing no executable command; internal library changes with no shell surface; generated artifacts owned by another gate.

## Gotchas

The heart of this lens. Hunt these named failure modes; each maps to a verbatim axiom/operator from the source skill.

1. **Silent-fail is the single worst outcome — auto-P0.** A command that fails but exits 0 with empty stdout is "the agent's worst nightmare — they can't even *detect* the failure to retry." Hunt this first; it outranks every other finding regardless of scores. Every failure path (crash, network error, lock conflict, missing prereq) must hit stderr with a non-zero exit. (`🚫 Never-Silent-Fail`)

2. **The intent-corpus outcome ladder — grade every wrong invocation.** Worst→best: `silent_fail` (exit 0, nothing said) < `useless_error` (exit≠0, generic msg) < `useful_hint` (exit≠0, names the right form) < `inferred_and_acted` (succeeded + warned). This is the gradeable scale that turns "errors should teach" into a verdict — push every wrong-invocation finding *up* the ladder. `useless_error` is a finding; `useful_hint` is the acceptable floor.

3. **Exit 1 must never mean "ran fine, no results."** Empty result = exit 0 with an empty `[]` in JSON. Exit codes are a documented dictionary surfaced in `--help` and `capabilities --json`: `0`=success, `1`=user-input-error, `2`=safety-block, `3`=tool-environment-error, `4`=upstream-failure, `5`=conflict. Check: an agent can write `case $? in 1) …; 2) …; esac` deterministically.

4. **Stdout is data; stderr is diagnostics — mixing them is the #1 cause of agent fragility.** `tool X --json | jq` must work without filtering log lines. Capture both streams separately; progress, warnings, deprecations, and prompts belong on stderr.

5. **TUI-on-bare-invocation hangs the agent forever (P0).** Bare `<tool>` dropping into a REPL/ncurses consumes stdin and never returns on a pipe — the agent times out. Either bare `<tool>` prints help/triage and exits, or `<tool> tui` is the explicit opt-in — *never both*. Detect non-TTY via `isatty`/`is_terminal`, print a one-line guide to `--json`, exit non-zero. (Axiom 15)

6. **Errors need THREE parts, not "see --help":** (a) what failed, (b) where (`file:line` if applicable), (c) the *exact copy-pasteable* command the agent should have typed instead. For a missing arg, also name the **discover-the-value** move: `to find an ID: mytool list --json | jq '.items[].id'`. The "to find an ID" hint is gold — it names the canonical way to get the value. (`🩹 Error-Teaches`)

7. **Auto-correcting a typo is dangerous for destructive flags.** Levenshtein-1 "did you mean `--json`?" is useful, but only *act on* the correction when it is non-destructive and stable. **Destructive flags must NEVER be auto-corrected.** Compare suggestions directly with the parser/help source; do not maintain a second extracted flag registry.

8. **Gate AND teach in the same breath.** Every irreversible op (delete, force-push, drop, reset, prune) requires explicit `--yes`/`--force`/`--confirm=<token>` AND the refusal must name a safe alternative (`--dry-run`/`--plan`/`--diff`; canonical example `dcg`'s "use git revert instead"). A bare "this is destructive, pass `--yes`" without naming the safe path still leaves the agent stuck. (`🛡 Safe-Alternative-Always`)

9. **Changing a public flag in one PR breaks every dependent agent.** Use the 5-stage deprecation ladder: `0. introduce` (new+old both work) → `1. warn` (old emits deprecation warning) → `2. error` (old fails with migration recipe) → `3. remove` (old gone from source). Span ≥2 passes; **NEVER skip stages on a public CLI.** A rename in a single PR is a finding.

10. **Non-determinism breaks golden tests and agent parsing.** Hashmap-iteration ordering, raw timestamps/wall-clock in free-text stdout (timestamps belong in JSON fields), non-stable IDs. Pin time/seed when supported, run twice, canonicalize documented volatile fields, and diff the bytes.

11. **ANSI/progress leak into piped stdout** on nearly every audit. Probe piped output plus `NO_COLOR=1`, `CI=true`, `TERM=dumb`, and closed stdin; fail on ANSI, prompts, or hangs.

12. **Round-trip economy — the mega-command.** Collapse 3 read round-trips into 1 call returning `quick_ref + recommendations + commands + project_health`. Four canonical shapes: TRIAGE / DIAGNOSE / PLAN / CAPABILITIES. This is the most-cited single uplift in the source — flag any read flow that forces an agent through 3 separate calls.

13. **Self-describing surfaces.** `<tool> capabilities --json` returns version + `contract_version` + features + commands + the exit-code dictionary + env-var dictionary, so the agent reads the contract from the tool instead of an out-of-band doc lookup. `<tool> robot-docs guide` (or `--robot-help`) prints a paste-ready agent handbook (<80 lines) in-tool. Both "cheap to add, outsized leverage."

14. **Universal JSON envelope.** Every `--json` output shares one shape: `{ ok, tool_version, data, meta:{request_id, ts_iso, data_hash, contract_version}, warnings:[], commands:[] }`. `commands` carries copy-paste-ready follow-ups; `meta` enables provenance / fallback-mode detection. An unstable or per-verb-divergent envelope is a finding — "emit JSON" alone is unactionable without the shape.

## Quick pass

Bounded check for normal PR prep on a changed command:

1. Enumerate the changed commands/flags/env vars/exit codes/output schemas/prompts/side effects.
2. Run bare command, `--help`, one success path, one failure path. Bare command must NOT block (Gotcha 5).
3. Pipe output: JSON validity, stdout/stderr split, stable ordering, no ANSI/progress leak (Gotchas 4, 10, 11).
4. Trip a typo and a deprecated flag; grade the result on the outcome ladder (Gotcha 2). Confirm the error has all three parts (Gotcha 6).
5. Confirm each contract is pinned by a test/snapshot/golden/transcript.

Fast scan — **the 8 hard signs of an agent-hostile CLI:** (1) bare invocation launches a TUI in non-TTY · (2) `--help` >200 lines, no TOC, no AGENT/AUTOMATION footer · (3) no `--json` for read verbs · (4) no `capabilities --json` · (5) prose-only errors, no "did you mean" · (6) destructive op on first invocation without `--yes` · (7) non-deterministic ordering (hashmap iteration) · (8) ANSI leaks into piped stdout.

## Deep pass

Escalate for agent-facing or CI-invoked CLIs and any destructive surface.

- **Rank findings: `priority = frequency × score_gap × blast_radius`** where `score_gap = (1000 − weighted_score)/1000` and `blast_radius = 0.10` (cosmetic) / `0.50` (workflow) / `1.00` (blocker). Fix the worst-scoring high-traffic surfaces first.
- Run the non-TTY/`CI`/`NO_COLOR` matrix, JSON-schema validation, a failure matrix mapping inputs→exit codes, dry-run output checks, idempotence on re-run, and a destructive-op safety review (Gotcha 8).
- Re-run the binary twice and byte-diff (Gotcha 10). Compare changed README command/flag claims directly with the real `--help` output.
- **The 8 universal recs** (default top-N for almost any agent CLI audit): U-1 `capabilities --json` · U-2 `robot-docs guide` · U-3 `--robot-*`/`--json` on read verbs · U-4 levenshtein-1 typo correction · U-5 schema-pin `capabilities` regression test · U-6 `recommended_action` field on `doctor`/`health` output · U-7 `meta._provenance`/`--robot-meta` for fallback-mode detection · U-8 AGENT/AUTOMATION footer in every subcommand's `--help`.

Use the target repository's real CLI and schema. The removed bundled probes
guessed `--json` placement and volatile-field names, and leaked diagnostic temp
files; direct commands are shorter and more accurate for the actual interface.

## False positives

- **Tiny human-only one-off scripts** — do not force `--json`, `capabilities`, or an envelope on a 10-line dev helper no agent calls. Match the surface to the audience.
- **"It's destructive but the gate exists"** — a gate without a *named* safe alternative is still a finding (Gotcha 8); do not pass it just because `--yes` is required.
- **Auto-correct that "helpfully" acts on a destructive typo** — this is a *finding*, not a feature. Do not rationalize it as ergonomic (Gotcha 7).
- **A rename "with a note in the changelog"** — that is not the deprecation ladder; a single-PR rename of a public flag stays a finding (Gotcha 9).
- **Green suite over an unstable envelope** — a test that snapshots one verb's JSON does not prove the universal envelope holds across verbs; do not treat per-verb snapshots as envelope coverage.
- **Don't redesign the CLI during PR prep** — flag, fix the in-scope diff, or defer; suppress out-of-scope architecture rewrites with a one-line deferral.

## Evidence to record

Per finding: the command, exit code, the stdout/stderr split, an output snippet, the JSON/schema validation result, **the intent-corpus class** (`silent_fail`…`inferred_and_acted`), the deep-pass `priority` if computed, the source `file:line`, and the test/snapshot/transcript that pins the behavior. Any "this is fine" claim on a high-stakes surface needs a transcript, not a vibe. On skip/override/blocked, record the one-line reason (and, if blocked on missing credentials/runtime, the missing piece + that source-level contracts were reviewed instead).

---
Provenance: distilled from `agent-ergonomics-and-intuitiveness-maximization-for-cli-tools` (jeffery-skills) — its 19-axiom kernel, 33 operators, 11-dimension rubric, CHEAT-SHEET, and ERROR-REWRITING-COOKBOOK. See that skill for the full scoring loop and worked exemplars.

# Snapshot Testing Check

Decide whether complex stable output should be frozen behind a golden / snapshot / approval artifact (and with which comparison strategy), or skipped for stronger evidence — and catch goldens committed without scrubbing or human review that silently lock in noise or a regression as "expected."

## When this gate applies

- Diff adds/changes `*.snap`, `*.snap.new`, `*.golden`, `*.approved`, `*.received`, `*.ambr`, or files under `__snapshots__/`, `snapshots/`, `golden/`, `goldenfiles/`.
- Diff touches `insta`, `assert_*_snapshot!`, `toMatchSnapshot`, `expect_test`, `goldenfile`, or any `UPDATE_GOLDENS` / `INSTA_UPDATE` / `UPDATE_SNAPSHOTS` reference.
- A change produces complex stable output (CLI/UI render, compiler/query/serialization result, API response) where whole-artifact diffing beats field-by-field assertions.
- CI config (`.github/workflows/*`) runs snapshot/golden tests.

## Gotchas

1. **A blindly accepted golden bakes in the bug.** The diff a reviewer skips ("it changed, just update it") is exactly how a real regression becomes the expected output. Every golden change must run **update → `git diff` the golden → human reads it → commit with the reason**. A PR that updates goldens with no per-change rationale fails this gate.

2. **Pattern is chosen by output TYPE, not by taste — use the decision tree.** Deterministic text (CLI, rendered HTML, formatted code) → **Exact**. Structured data with dynamic fields (JSON w/ timestamps/IDs) → **Scrubbed**. Floating-point / numeric (scores, scientific) → **Fuzzy** (epsilon compare). Binary (images, protobuf, archives) → **Semantic** (decode then compare structure). Multi-platform (line endings, paths) → **Canonicalized**. Output that changes frequently → **Structural** (compare shape, not values, e.g. `expect.any(String)`). Picking the wrong branch is the root cause of most golden flake. Pick the cheapest branch that stays stable across runs.

3. **Volatility ≥ 4 (1–5 scale) MUST use scrubbing or fuzzy matching, never byte-exact.** Exact-match goldens for volatile output cause test rot — perpetual flaky failures. Classify each golden's volatility; if it changes often, an exact golden is the wrong tool.

4. **Scrub the full catalog, each to a named placeholder — not just "timestamps and UUIDs."** The classes that silently leak nondeterminism: UUID `[UUID]`, ISO-8601 `[TIMESTAMP]`, **Unix epoch** `\b1[6-9]\d{8}\b` `[UNIX_TS]`, duration (ms/us/µs/ns/s/min/h) `[DURATION]`, memory address `0x…` `[ADDR]`, absolute/home/tmp path → `/HOME/` `/TMP/` `[PATH]`, **port in URL** `localhost:[PORT]`, **PID** `pid=[PID]`. The commonly-dropped classes (Unix epochs, ports, PIDs) are exactly the ones that leak. Build it once as a reusable `Scrubber::standard()` with a `with_custom` hook. (Script: `golden-scrub-check.sh`.)

5. **Scrubbing can hide a real regression too — prefer validating redaction.** A too-greedy regex blanket masks the very change you wanted to catch. Prefer **path-based redaction with validation**: insta `dynamic_redaction(|value,_| { Uuid::parse_str(value)?; "[uuid]" })` asserts the field WAS a UUID before masking it; field-path redactions `".id" => "[uuid]"`, `".**.secret" => "[redacted]"`, `".items[].id"`; Jest `expect.any(String)` / `expect.stringMatching(/^user-/)`. Validating redaction proves shape while neutralizing value; a blind regex pass does not.

6. **Map / collection iteration order is its own nondeterminism source**, separate from timestamps and IDs — it's the most common reason a golden "changes every run" with no obvious dynamic value. Sort before snapshotting: insta `set_sort_maps(true)`, `".tags" => insta::sorted_redaction()`, or sort JSON keys before write. If the diff is pure reordering, the fix is sorting, not re-accepting.

7. **Binary goldens have a hard NEVER list — never byte-compare.** Protobuf/MessagePack (field order varies → decode + compare struct). SQLite `.db` file (WAL state + page layout nondeterministic → **query the data, golden the results**). Compiled binary (platform-dependent → **golden the behavior**, never the bytes). Compressed/zip/tar (timestamps + ordering differ → decompress/extract first, diff contents). Images PNG/JPG (rendering differs → **perceptual hash or pixel-RMSE tolerance**, not byte-exact). PDF (font embedding + metadata differ → extract text). Files >100KB are unreviewable and >10MB slow CI — split into smaller focused goldens. Helper patterns: image RMSE, archive extract-to-map, db-state query, protobuf decode-then-eq.

8. **"CI fails but local passes" has a fixed cause table.** Line endings (canonicalize `\r\n`→`\n`, `\\`→`/`). **Locale** → set `LC_ALL=C` in CI. **Timezone** → use UTC everywhere or scrub timestamps. **Tool version drift** → pin Rust/Node in CI. Stale snapshots → `INSTA_UPDATE=unseen` to detect orphans. Locale and timezone are the non-obvious "works on my machine" flakes; name them before they bite.

9. **CI must COMPARE ONLY, never write.** `INSTA_UPDATE=no` is **mandatory** in CI (not `auto`/`always`/`new`); custom frameworks run with `UPDATE_GOLDENS=""`. A PR carrying `*.snap.new` or `*.actual` residue is an unreviewed pending update — CI must detect that residue (`find . -name '*.snap.new'` / `-name '*.actual'` → fail) and upload it as an artifact for review. `--accept-unseen` / `insta accept` / `-u` in a workflow is an auto-update hole. (Script: `golden-ci-gate-check.sh`.)

10. **A "mismatch" with no diff is an anti-pattern.** The harness's failure message MUST emit a unified diff PLUS the exact update command and a diff path (`panic!("GOLDEN MISMATCH: {name}\n{diff}\nTo update: UPDATE_GOLDENS=1 …\nTo review: diff …")`), and write the `.actual` file for diffing. A suite whose failure says only "mismatch" gives the reviewer nothing to act on — flag it.

11. **No PROVENANCE = irreproducible golden.** `goldens/PROVENANCE.md` must record the generator version + exact command so a stale golden can be regenerated 6 months later. Missing PROVENANCE is a listed anti-pattern. Also: don't commit transient `.actual` files (`.gitignore *.actual`).

12. **Routing to other evidence.** When exact output is a **weak oracle** (you cannot state the exact right answer), route to `invariant-testing-check.md` instead; snapshot only once a value is validated. A snapshot is the **frozen reference** for a conformance harness. A **fuzz-found crash should be frozen as a snapshot regression test** — that's the right home for it, not a one-off assert.

## Quick pass

1. List the golden/snapshot files the PR adds or changes; for each, name the output contract it asserts.
2. Classify output (deterministic / dynamic / numeric / binary / cross-platform / volatile) → pick the pattern per the gotcha-2 tree.
3. Run `golden-scrub-check.sh` over the changed goldens; confirm every dynamic class is scrubbed/normalized and maps are sorted.
4. Run the repo generate/update command, then the normal validation command; capture both with exit status.
5. Read the golden diff line by line; write a one-line "what changed and why" per file.

## Deep pass

Risk-gated, for a durable golden suite or a correctness-sensitive change:

- Run `golden-ci-gate-check.sh` to confirm the gate is compare-only: no `.snap.new`/`.actual` residue, no `INSTA_UPDATE=always|auto`/`UPDATE_GOLDENS=1`/`--accept-unseen` in CI workflows.
- Verify the harness emits a unified diff + reproduction command on mismatch (gotcha 10), and CI uploads `.actual`/`.snap.new` as artifacts.
- For binary goldens, confirm the semantic comparator matches the type (image RMSE tolerance, archive extract-and-diff, db query-state, protobuf decode-then-eq) — never byte-compare.
- For volatile/numeric output, confirm validating redaction or epsilon tolerance is defined, not a blind regex.
- Confirm `PROVENANCE.md` records generator version + command, `*.actual` is gitignored, and no golden exceeds 100KB.

## Scripts

- [`scripts/golden-scrub-check.sh`](scripts/golden-scrub-check.sh) — greps changed golden/snapshot files for the full scrub catalog (UUID, ISO + Unix timestamp, duration, mem address, home/tmp path, port, PID) and reports any RAW (un-`[PLACEHOLDER]`'d) dynamic value. Invoke: `git diff --name-only --diff-filter=AM <base>...HEAD | grep -E '\.(snap|golden|approved|received|ambr)$|/(__snapshots__|snapshots|golden|goldenfiles)/' | xargs -r scripts/golden-scrub-check.sh`.
- [`scripts/golden-ci-gate-check.sh`](scripts/golden-ci-gate-check.sh) — verifies the CI gate is compare-only: flags committed `*.snap.new`/`*.actual` residue and any auto-update/accept env-var or flag in `.github/workflows/*`. Invoke: `scripts/golden-ci-gate-check.sh <repo-root>`.

## False positives

- **Don't demand scrubbing of a value that is part of the contract.** A fixed enum, a stable hash of stable input, or a deterministic seeded ID is the assertion, not noise — scrub only genuinely dynamic classes.
- **A pure-reordering diff is a sort bug, not a behavior change** — fix with `set_sort_maps`/`sorted_redaction`; don't flag it as a regression and don't re-accept it as-is.
- **Structural/`expect.any` goldens legitimately don't pin values** — for high-volatility output that's the correct pattern, not under-assertion. Don't push them to exact.
- **Inline snapshots with `@""` placeholders are not "empty goldens"** — insta fills them on first run; that's the intended workflow.
- **Rationalization blacklist (block these):** "it changed, just update it"; "the snapshot test is green so it's fine" (green can mean a stale or auto-accepted golden); "scrubbing hides it anyway so exact is simpler" (scrubbing-then-validating is the point); "CI passed" when CI runs in a writable golden mode.

## Evidence to record

- Per golden: the file path, chosen pattern (exact/scrubbed/fuzzy/semantic/canonicalized/structural) and the output-type justification.
- The scrub/canonicalization rule applied and `golden-scrub-check.sh` result; map-sort confirmation.
- Generate/update command + validation command, each with captured exit status.
- The reviewed diff summary (one line per changed golden) and the update rationale.
- Gate state from `golden-ci-gate-check.sh`: CI compare-only, no residue, harness emits diff, PROVENANCE present.
- On skip: name the stronger evidence that replaces the snapshot (exact assertion already covers it / too volatile-or-large to review / no safe canonicalization / routed to invariant testing for the oracle problem / fuzz crash frozen elsewhere).

---
Provenance: distilled from `jeffery-skills/testing-golden-artifacts` (SKILL.md + references/SCRUBBERS, CI-GOLDENS, BINARY-GOLDENS, INSTA, TROUBLESHOOTING).

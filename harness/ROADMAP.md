# Harness roadmap

Where the `harness` skill and the `harness-doctor` scanner go next, and why. This
is a planning doc, not a spec — it routes work, it does not gate it.

Harness prepares repos for autonomous agent loops. GarageBand runs and evaluates
those loops. Harness Doctor proves repo shape and obvious hazards deterministically.
Today the skill covers repo-readiness + docs-routing well; the rest of that
pipeline — behavior capture, GarageBand onboarding, eval seeding, the outer
learning loop — is still unbuilt. This roadmap sequences the gap.

## Verdict

Two truths drive the ordering:

1. **The vision is mostly unbuilt.** The skill covers docs-routing and a
   readiness audit. The transcript's larger arc — capture → onboard → evals →
   outer loop — does not exist yet as workflows.
2. **The one adoption we have was not smooth.** In a live dogfood (garage-band,
   session `725ae783`; figures below are read from that transcript, not from
   either repo), ~34 of 55 shell calls were spent fighting or reverse-engineering
   `harness-doctor`, and the first scan reported a score of **0 / "At risk" that
   the operating agent judged to be mostly noise** — throwaway trees plus
   dead-code false-flagging dynamically-loaded fixtures. These are dogfood-derived
   judgments from a single session, not measured facts about the general case;
   the friction items in Phase 1 are hypotheses to confirm, not settled bugs.

So the roadmap fixes the friction observed in that session before it builds the
vision on top: vision work layered on a scanner an operator distrusts compounds
the problem. Note the current harness-doctor working tree already ignores `dist`
and folds `.gitignore` into dead-code ignores
(`packages/core/src/project-info/constants.ts`, `check-dead-code.ts`), so Phase 1
is partly "verify/extend what exists," not "build from scratch."

## Key ideas from the source transcript (harness-relevant)

- **Behavior capture is the stated *first* job of harness** — "before we make any
  changes … let's capture the behavior as it exists today" (unit/e2e/API
  snapshots). The skill references this in its operating model but ships no
  `capture` workflow. This is the largest single vision-value gap.
- **Two-loop model.** Inner loop = the agent completes the task. Outer loop =
  reviews the inner loop and edits the substrate (tool, repo harness, prompt,
  eval, docs). **Harness is what the outer loop edits.** Today harness has no
  outer-loop hooks.
- **Dogfooding is a concrete mechanism:** sub-agent uses the skill → orchestrator
  reviews the transcript → patches the skill → loop until confident. (This
  roadmap's adoption findings were produced exactly this way.)
- **Evals are e2e tests for agents** — GarageBand owns them; harness can seed them
  from a repo's spec-contract proof menu.
- **Deterministic vs. fuzzy split is deliberate:** Harness Doctor does anything
  checkable deterministically; the skill/agent keeps the fuzzy judgment.

## Inventory: mechanized vs. prose-only

Most of the "autonomous substrate" vision is already *in the skill as prose /
agent-judgment*. The gap is that it lives at the bottom of the enforcement
hierarchy (prose an agent reads) rather than the top (a deterministic check), and
that the pre-repo workflows do not exist at all.

| Capability | Deterministic (`harness-doctor`) | Prose / agent-judged (skill) | Exists? |
| --- | --- | --- | --- |
| Doc existence, byte/line budgets, link resolution, CLAUDE shim | yes | — | yes |
| pnpm supply-chain hardening | yes | — | yes |
| Dead-code / deslop | yes (noisy) | — | yes |
| Spec-contract *sections present* | yes (heading string-match) | yes | yes |
| Spec-contract supply/demand alignment (rows → real commands) | no | yes | prose only |
| Command / CI / proof-lane **discovery** | no | partial (agent greps) | prose only |
| One-command bootstrap + health smoke | no | yes | prose only |
| Parallel-safety (ports, shared DB, hermetic tests) | no | yes | prose only |
| Reversibility / rollback | no | yes | prose only |
| Loop-readiness verdict | no | yes | prose only |
| **Behavior capture** | no | no | **missing** |
| **Onboard → GarageBand gate** | no | no | **missing** |
| **Eval seeding** | no | no | **missing** |
| **Dogfood loop** | no | no | **missing** |
| **Outer-loop feedback ingestion** | no | no | **missing** |

Two correctness notes:

- **Two unrelated scores share one 0-100 scale.** `harness-doctor` computes
  `100 − 2·errors − 1·warnings` (every rule defaults to `warn`, so effectively
  `100 − warning_count`); the skill computes a weighted D1-D6 readiness score.
  Same scale, different meaning — a live footgun. **Decided end state: the scanner
  emits the D1-D6 readiness band** (Phase 4), deterministic where possible.
- **Config-filename drift.** The skill still says `harness-doctor.config.ts`
  (`docs.md:282`, `doctor.md:15`, `doctor.md:86`), but the tool no longer loads
  that name: `harness-doctor` reads `harness.config.{ts,mts,cts,js,mjs,cjs,json,jsonc}`
  or `package.json#harnessDoctor` (`packages/core/src/load-config.ts`). The config
  basename was changed from `doctor.config` to `harness.config` in commit
  `dba4382c` — `harness-doctor.config.*` was never the loaded name, so the skill's
  reference is simply wrong and the fix stands regardless of history. In the live
  session the agent had to recover the schema from `dist/index.d.ts` in the npx
  cache.

## Adoption learnings (garage-band dogfood)

These are observations from the one dogfood session, not measured general facts —
each is a cheap thing to confirm-and-fix that, if real, taxes future adoptions:

1. **First-run noise dominates the score** (gitignored/throwaway trees +
   dead-code vs. dynamic fixtures). No warning in `doctor.md`.
2. **Config is undocumented** — schema recovered from compiled `.d.ts`; the
   `rules` subcommand returned empty without a TTY.
3. **Suppression rule-keys must be plugin-prefixed**
   (`harness-doctor/docs-structure/...`) — undocumented; first override silently
   no-op'd.
4. **`docs/todos/INDEX.md` is case-load-bearing** — lowercase `index.md` was
   graded as a malformed spec.
5. **The readiness ladder has no terminal state for human-gate-by-design repos.**
   garage-band correctly landed `supervised-only` — but permanently, by design
   ("the human merge gate is the product"), which reads as an unfixed gap.
6. **No combined route.** "Make this repo harness compliant" maps to neither
   `docs` nor `doctor`, forcing a clarifying round-trip.
7. **No stale-vs-reformat triage** for pre-existing content (stale todo specs
   referencing retired milestones).
8. **False-positive triage is unguided:** tool-owned single-file formats (a
   452-line `DESIGN.md` for `/impeccable`) vs. the monolith rule; dynamic
   fixtures vs. dead-code.

Protect what worked: the `docs.md` authoring pipeline produced correct artifacts
in one pass with zero user corrections; "route, don't duplicate" and
enforcement-hierarchy dropping of already-enforced rules both fired correctly; and
the highest-value catch was a *docs* finding (a stale `AGENTS.md` pointing agents
at a dead branch), not a scanner finding.

## Phased plan

Ordered unblock-first, then by leverage. Phases 0-2 make the current thing
trustworthy; 3-6 build the vision. Cost is rough T-shirt size.

| Phase | Theme | Deliverables | Repo | Cost |
| --- | --- | --- | --- | --- |
| 0 | Drift & parity | Fix `harness.config.ts` filename in `docs.md`/`doctor.md`; update harness-doctor's own `SPEC_CONTRACT.md` to fast/full + Sufficiency shape (dogfood parity); reconcile `--diff` vs full-audit wording; document the two-scores distinction as interim (converges in Phase 4). | both | XS |
| 1 | Kill scanner noise | Verify/extend the default ignore-set (`dist` + `.gitignore` already handled; confirm `.scratch`/`.understand`/worktrees); dead-code opt-in or gated with a dynamic-loading caveat; `doctor.md` "raw pre-scoping scores are unreliable" warning + false-positive triage section; confirm and fix `rules`-without-TTY and count instability; document `HarnessDoctorConfig` schema + plugin-prefixed rule-key format; accept lowercase `index.md` or emit a rename hint. | mostly harness-doctor | S |
| 2 | Routing & verdict fit | Combined `harness compliant`/`overhaul` route (doctor → docs → re-scan); `human-gate-by-design` terminal verdict state; stale-vs-reformat triage in the todos path. | skill | S |
| 3 | Behavior capture | `harness capture` workflow: characterize current behavior (unit/e2e/API snapshots) before changes; output a behavior ledger + coverage-gap report. | skill | M |
| 4 | Mechanize the prose gates | Teach harness-doctor to discover, not just check existence: parse `package.json` scripts / `.github/workflows` / Make/just into a **signals menu** (JSON); statically verify every proof-menu row references a command that exists (execution stays in the skill workflow, per `doctor.md`); detect bootstrap/smoke presence; parallel-safety hazard scan (ports, shared DB, non-hermetic tests); **emit the D1-D6 readiness band** (retire or subsume the penalty score). | harness-doctor | L |
| 5 | Onboard + evals | `harness onboard` (readiness → GarageBand-consumable `autonomous-ready` gate + checklist); `harness evals` seeding eval cases from the spec-contract proof menu. | skill + GarageBand seam | L |
| 6 | Outer loop | `harness dogfood` (sub-agent uses skill → orchestrator reviews transcript → patches skill); feedback ingestion (PR comments, failed evals, DataDog P1s, support tickets → harness/prompt/tool/doc repairs); append-only JSONL evidence ledger + hill-climb hook. | skill + GarageBand | XL |

Ordering notes vs. an intuitive vision-first plan:

- **Scanner noise (1) precedes onboard/capture** because, in the one dogfood we
  have, a first `doctor` run was hard to trust; onboarding on a score an operator
  distrusts teaches them to ignore it.
- **Capture (3) precedes proof-inventory mechanization (4)** — it is the
  transcript's named first job and it is a skill-only workflow (cheap), vs. the
  engine work of teaching the scanner to discover commands.

## Best first PRs

1. **Phase 0 config drift (skill only)** — fix `harness.config.ts` across
   `docs.md`/`doctor.md`. Trust-restoring, near-zero risk, XS. Keep the
   harness-doctor `SPEC_CONTRACT.md` reshape as a separate PR — it is a
   dogfood-parity change, not config drift.
2. **Phase 1 ignore-set verification + first-run warning** — every future
   adoption benefits. Pair with the `HarnessDoctorConfig` schema doc and a
   plugin-prefixed rule-key example.
3. **Phase 2 `human-gate-by-design` verdict state** — small skill edit; fixes the
   dogfood repo's own misleading verdict.
4. **Phase 3 `harness capture` module** — first real vision increment; start once
   the scanner is trustworthy.

## Alignment with prior versioning

This continues the v1.3 (universal readiness, shipped) / v1.4 (autonomous
substrate, deferred) cut. Phases 0-2 are v1.3 hardening; Phase 4's signals menu,
parallel-safety scan, plus Phase 6's evidence ledger, are the v1.4 items; Phases 3, 5, 6 are
the GarageBand-facing extensions beyond that.

# Prose Quality And PR Copy

Skeptical technical-editor lens for changed user-facing prose and generated PR copy: deslop line by line, verify every claim against the repo, and treat any changelog/release-history as a research artifact, not a summary. Keep the meaning; cut the slop; mark anything unverifiable as unknown.

## When this gate applies

- Changed `**/*.md`, `README*`, `docs/**`, `CHANGELOG*`, release notes, handoff text, or inline user-facing strings in the diff.
- Generated PR copy: PR title/body, `gh pr create`/`--body` text, release-note blurbs.
- Any prose that asserts behavior, commands, paths, flags, versions, links, dates, or project history.
- A changed window touching a changelog or release page (release-vs-tag and link claims must be verified).

## Gotchas

1. **You cannot deslop with a script or regex — read EACH changed line and recast.** A find-replace pass misses most slop; the whole technique is manual, systematic, line-by-line revision. From de-slopify: "you MUST manually read each line of the text and revise it manually in a systematic, methodical, diligent way. Use ultrathink." The mechanical scans (`finish-lane.ts` slop grep, `validate-changelog-md.py`) only surface *candidates*; the fix is judgment per line, not substitution.

2. **Emdash overuse is the #1 AI tell — fix it with a substitution menu, not deletion.** de-slopify names it as "one big tell." Replace overuse, do not blanket-ban: `X—Y—Z` → `X; Y; Z` or `X, Y, Z`; parenthetical `The tool—which is powerful—works` → commas; `We built this—and it works` → comma; sometimes split into two sentences. Nuance that prevents over-correction: **one or two emdashes per document is fine** — the rule is overuse, not a ban.

3. **Hunt exact slop phrases, not vibes.** The scrub list (cut or recast each): formulaic contrast — "It's not X, it's Y" / "It's not just X, it's also Y" / "It's not about X, it's about Y"; clickbait lead-ins — "Here's why" / "Here's why it matters" / "Here's the thing" / "Here's what you need to know"; forced enthusiasm — "Let's dive in" / "Let's get started" / "Excited to share" / "We're thrilled to announce" / "Get ready to"; pseudo-profound openers — "At its core" / "Fundamentally" / "In essence" / "At the end of the day" / "When it comes to"; unnecessary hedges — "It's worth noting" / "It's important to remember" / "Keep in mind that" / "It should be noted" / "It goes without saying". The fix is almost always to delete the opener and just say the thing (e.g. "We chose Rust. Here's why: performance matters." → "We chose Rust because performance matters.").

4. **Thoroughness is NOT slop — do not gut structure, depth, or code.** de-slopify "What NOT to Fix": technical accuracy, necessary structure (headers/lists are fine), clear explanations ("being thorough isn't slop"), and code examples ("focus on prose, not code"). Edit prose; leave correct structure, complete explanations, and code blocks intact. Do not expand a small docs edit into a full rewrite.

5. **A changelog is a research artifact — if the history work is weak, the prose is fake.** changelog-md-workmanship core rule: "Never draft a serious changelog from memory." Research exhaustively (git, tags, releases, tracker, existing docs) before writing. Evidence hierarchy on conflict: **git history > tags/release metadata > issue tracker > existing changelog/release notes > README/docs. If sources disagree, history wins.**

6. **Release ≠ tag — the highest-frequency changelog link trap.** "If a GitHub Release does not exist, do not pretend it does." Link `releases/tag/<version>` ONLY when a real Release exists; otherwise link `tree/<version>` or the tag page. If a release is a draft, say so explicitly. Never fabricate release pages for tag-only versions. Verify with `gh release list` / `gh release view <tag>` before linking.

7. **Live links, scoped links, representative links.** Use full commit URLs (`github.com/owner/repo/commit/<sha>`), never naked hashes. Scope tracker links tightly to the real record (e.g. `.beads/issues.jsonl`) instead of broad repo search. Pick REPRESENTATIVE commits — architecture landings, major features, correctness fixes, performance turning points, reliability hardening — rather than flooding with every commit.

8. **Concrete dates only.** Changelogs and release prose use absolute dates (`2026-03-21` / `March 21, 2026`), never relative phrasing ("last week", "recently", "today"). Relative dates are a named weakness signal and rot immediately.

9. **Do not flatten into a commit dump, and do not write a marketing page.** This is orientation infrastructure. Strong section shape: short narrative paragraph + `Delivered capability` + `Closed workstreams` + `Representative commits`, organized by capability waves above a visible version timeline. Failure signals: vague summaries ("many improvements", "various fixes"), sections that could apply to any repo, no explanation of WHY a wave mattered.

10. **Long histories breed slop under context pressure.** If the changed window is large: create the changelog skeleton + a `CHANGELOG_RESEARCH.md` memo EARLY, research in bounded chunks (one tag range / one sprint / 50–150 non-merge commits / one epic), distill each chunk into the live doc immediately, and keep a coverage ledger (chunk, range, status, themes, open questions). "If you delay writing until all research is done, you will lose detail and create slop."

11. **READMEs convert scanners into users in under 60 seconds — lead with value, not installation.** The dominant README failure is burying the value proposition under install steps. Technique: TL;DR (The Problem / The Solution / "Why use X?" feature table) BEFORE Quick Start; a curl one-liner above the fold as an escape hatch; every feature claim gets a concrete example (show, don't tell); comparison tables beat prose; an honest Limitations section + a Troubleshooting section (top 5 errors with fixes) build trust. README anti-patterns with fixes: "This is a tool that…" (passive/abstract) → "Solves X by doing Y"; screenshot-heavy → ASCII + copy-paste code blocks; single install method → curl + package manager + source (3+ paths); outdated badges look abandoned.

## Quick pass

1. From `changed-files.txt`, list the changed prose files + any generated PR/README/changelog copy.
2. Deslop each changed line by hand: emdash overuse (gotcha 2) and the exact phrase catalog (gotcha 3). Do NOT touch code, headers, lists, or correct explanations (gotcha 4).
3. Verify every command, path, flag, version, link, date against the repo; mark anything you cannot confirm as **unknown** rather than polishing over it.
4. Shape the copy: PR body = behavior change → why it matters → brief how → validation commands + QA evidence → selected/skipped gates → residual risk. README = value-first (gotcha 11).
5. Record files reviewed (with `file:line`) and every claim left unverified.

## Deep pass

Escalate for public READMEs, release notes, changelogs, setup docs users follow, or high-visibility PRs.

- **Changelog / release history**: run the version-spine + history-clustering + tracker scripts (below) to get ground truth, then audit the draft. Apply gotchas 5–10: research-first, release-vs-tag, live/scoped/representative links, absolute dates, capability-wave structure over a version spine, chunked coverage for large windows.
- **Fresh-eyes draft-auditor pass**: return severity-tagged FINDINGS, not a rewrite, against this fixed priority list — (1) missing/weak scope framing, (2) incorrect release-vs-tag treatment, (3) bare hashes instead of live links, (4) weak capability synthesis / commit dump, (5) missing tracker intent, (6) coverage gaps. Prefer precise findings over generic praise.
- **README deep pass**: run or trace each example command where practical; confirm install paths, badges, and comparison claims; flag the anti-patterns in gotcha 11.
- Keep a before/after prose diff for every rewritten passage.

## Scripts

Ported from changelog-md-workmanship; run directly (shebangs present), prose work stays in this lens.

- [`scripts/validate-changelog-md.py`](scripts/validate-changelog-md.py) — audit a finished `CHANGELOG.md` for structural/evidence problems (enforces release-vs-tag, live-link, concrete-date, generic-phrase gotchas). Invoke: `scripts/validate-changelog-md.py <path/to/CHANGELOG.md>`; network link-check: `scripts/validate-changelog-md.py --verify-links <path>`.
- [`scripts/build-version-spine.py`](scripts/build-version-spine.py) — generate a version-timeline skeleton from local git tags + GitHub releases, correctly distinguishing Releases from plain tags (ground truth to verify version/date/link claims). Invoke: `scripts/build-version-spine.py --repo . --format markdown`.
- [`scripts/cluster-history.py`](scripts/cluster-history.py) — group commits into candidate capability waves for the synthesis-not-dump check. Invoke: `scripts/cluster-history.py --repo . --format markdown`.
- [`scripts/extract-tracker-workstreams.py`](scripts/extract-tracker-workstreams.py) — normalize beads / GitHub Issues / Linear / Jira / milestone evidence into scoped workstreams (the scoped-tracker-link source). Invoke: `scripts/extract-tracker-workstreams.py --repo . --format markdown`.

## False positives

- **Occasional emdash** (one or two per document) is fine — do not flag or strip them. The defect is overuse.
- **Necessary structure and code**: headers, lists, tables, and code blocks are not slop. Thoroughness is not slop. Don't "improve" them away.
- **A precise short phrase that happens to contain a catalog word** (e.g. a literal heading "Why" in a decision log) is not automatically a "Here's why" tell — judge the sentence, not the substring.
- **Real-but-unflashy claims**: a plain, specific statement backed by the diff needs no rewrite just because it is not "punchy." Resist turning PR text into marketing.
- **Scoped docs edits**: a one-line doc fix does not license a full-doc rewrite.

## Evidence to record

Write into the finish-lane context/PR-body draft:

- Files reviewed with `file:line` for each changed claim; before/after snippets for every rewritten passage.
- The commands/links run to verify examples, versions, releases, and history, and their results.
- For changelogs: release-vs-tag determination per version, the script outputs used as ground truth, and the date format used.
- Every claim left **unknown** (could not verify against the repo or a cited source) — never written around.
- If skipped: a one-line rationale (e.g. "no human-facing prose or PR copy in scope"). Stop and mark unknown when a claim needs external truth you cannot verify.

# Handoff

Source: https://github.com/joshuadavidthomas/opencode-handoff
Upstream commit: b18d546e567c8c15c7ce8377f82f1b81cd838890.
Upstream license: MIT.

Create a focused continuation prompt for a fresh coding session. This adapts the upstream OpenCode `/handoff` idea to the grouped `code` workflow pack: preserve the useful context-loading discipline, but do not assume OpenCode session APIs, automatic new-session creation, or a `read_session` tool.

Use this when the user wants to pause, continue elsewhere, transfer work to another agent, create a reviewer/operator handoff, or turn the current coding thread into a prompt that works cold.

Do not use this for defining a new autonomous goal from scratch; clarify the goal first when the work is still underspecified. Do not use this for teaching a newcomer; use `/tutorial` for that. Do not use this for tracing a code path; use `understand.md`.

## Core Rule

The next session should not need archaeology. Frontload the facts, file refs, current state, decisions, constraints, and exact verification commands that let a new agent continue immediately.

The handoff must work without hidden transcript access. If a runtime has prior-session tools, mention them only as optional fallback; never rely on them as the primary context.

## Success Criteria

A good handoff lets a new agent start without asking what repo, branch, files, current state, next action, or verification command to use. If any of those are not known, mark the field `UNKNOWN` rather than guessing.

## Process

### 1. Resolve the continuation target

Use the user's argument as the next-session goal. If it is empty, infer the natural continuation from the recent conversation and current worktree.

If the goal changes the task materially, make that explicit:

```text
Continuation target: finish the auth migration, not continue debugging the old OAuth callback branch.
```

### 2. Inspect live state before writing

Before using tools, say briefly what state you are checking and why. Then inspect the minimum live state needed to fill the handoff fields.

When inside a repository, gather only the state needed to make the handoff true:

- `git status -sb`
- current branch and base branch when relevant
- changed files and the high-level diff shape
- recent commits if they affect where the next session starts
- open PR/issue/check state when the current work depends on it
- validation commands already run, with pass/fail/unknown status

Read the relevant files, tests, configs, docs, and generated artifacts before naming them. Do not trust stale plans, old summaries, or memory over the live tree.

Stop once the handoff can work cold. Do not keep searching for completeness if the next action, required context, and verification path are already clear.

### 3. Select file refs

Choose files the next session should load first:

- files likely to be edited
- neighboring tests and fixtures
- configuration or schemas that constrain the change
- docs/specs/goals that contain live acceptance criteria
- generated artifacts only when they are source-of-truth for status

Target 8-15 files for normal work. Use up to 20 for complex handoffs. Use fewer when the task is small. Prefer exact relative paths and line anchors when they matter.

For Claude/OpenCode-style consumers, include a single `@file` preload line. For Codex or generic agents, keep the same files in Markdown bullets.

### 4. Write the handoff prompt

Default to returning the prompt in chat. If the user asks for a file, or if the handoff is long enough that it should be durable, also write `.handoff/<short-slug>.md` in the target repo.

Use this shape:

```md
# Handoff: <goal>

Continuing work from <repo/branch/thread/pr if known>. This prompt is self-contained; do not assume access to the previous transcript.

## Goal
<one concrete outcome for the next session>

## Current State
- Branch/worktree/PR/check state:
- What is already done:
- What is still open:

## Relevant Files
@path/to/file
@path/to/test

- `path/to/file` - why it matters
- `path/to/test` - what it verifies

## Decisions And Constraints
- Preserve:
- Avoid:
- User preferences:

## Next Steps
1. <specific next action>
2. <specific next action>
3. <specific next action>

## Verification
- `<command>` - current status: PASS | FAIL | NOT RUN | BLOCKED

## Evidence And Unknowns
- Verified facts:
- Unknowns:
- Do not infer successful validation from intention, old notes, or partial logs.

## Watchouts
- <risk, conflict, flaky check, or likely false trail>

## Completion Report
When done, reply with changed files, checks run, remaining risk, and any follow-up PR/issue links.
```

### 5. Keep it sharp

- Prefer facts over narrative.
- Use concrete paths, commands, branch names, commit SHAs, PR numbers, ticket IDs, and error text.
- Preserve decisions and constraints that would be expensive to rediscover.
- Include dead ends only when they prevent repeated wasted work.
- Mark unknowns as `UNKNOWN` or `NOT RUN`; do not smooth them into confidence.
- Do not dump raw chat logs. Summarize the load-bearing details.

### 6. Quality check before finalizing

Ask: Could a new agent continue from this prompt without needing the previous transcript? If not, fill the missing field from live evidence or mark it `UNKNOWN`.

## Output Rules

- The final handoff is the deliverable. Keep extra commentary short.
- If writing `.handoff/<slug>.md`, tell the user the path and still include a concise summary.
- Do not implement the next task during handoff generation.
- Do not claim checks passed unless they were run in this or a clearly identified prior session.
- Do not expose secrets, tokens, private credentials, or full environment dumps.

---
name: status-update
description: Summarize a long-running agent task as a concise, evidence-backed snapshot of completed outcomes, current activity, remaining work, friction, surprises, and any required user action. Use when the user asks for a status update, progress report, catch-up, what has been done, what is active, what is left, why work is taking so long, what blockers or issues exist, what improvements are locked in, or whether anything surprising changed the plan.
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  tags: "status progress long-running agents blockers handoff operations"
---

# Status Update

Give the user an accurate control-panel view of the work, not a transcript.
Default to a quick update that is easy to scan and easy to drill into by
selecting any bold label.

## Establish current truth

Treat a status request as read-only. Do not interrupt workers, edit files,
restart commands, deploy, or otherwise alter the task merely to report it.

Inspect the smallest set of live sources that can answer the request:

1. Read the task's current plan or goal, recent turns, active worker states, and
   running command output.
2. Check repository, PR, CI, or runtime state when a claim depends on it.
3. Prefer current primary evidence over earlier commentary, plans, worker
   claims, docs, or memory.
4. State important unknowns instead of filling gaps with a plausible story.

When reporting another Codex task, resolve the exact task first and read its
recent turns. When reporting this task, use the current conversation and live
execution state. Do not ask an active worker for a redundant status report when
its existing state and evidence are sufficient.

## Classify the work honestly

Use these rules before writing:

- **Done** means the outcome exists and its relevant proof passed. An edit,
  attempted command, worker claim, or open PR is not automatically done.
- **Active** means an operation is executing or a worker is presently pursuing
  it. Name the exact step and the latest meaningful liveness evidence. A plan
  item marked in progress is not enough by itself.
- **Left** means required acceptance work remains. Order it by dependency and
  decision value, not by file or chronology.
- **Friction** is a recoverable problem, repeated rework, slow gate, ambiguity,
  or failed attempt. Call something a **blocker** only when progress cannot
  continue without user action or an external state change.
- **Surprise** is a new fact that changed the plan, scope, risk, or mental model.
  Routine test failures and expected iteration are not surprises.
- **Locked in** means a durable, verified improvement is present in the actual
  code, configuration, artifact, or live system. Keep it distinct from work
  that was merely explored. When the user asks what is locked in, mark those
  outcome labels with `(locked in)` instead of making them infer it.

For parallel work, summarize each meaningful workstream's objective and state.
Do not list agents by name unless identity helps the user understand ownership
or a dependency.

## Choose the overall signal

Open with one of these verdicts and one plain-language sentence:

- `On track` — work is advancing with no decision-changing risk.
- `At risk` — work is advancing, but a known issue threatens scope, quality, or
  timing.
- `Blocked` — no meaningful progress can continue without an external change.
- `Waiting on you` — the next required action or decision belongs to the user.
- `Idle` — nothing is executing even though autonomous work remains.
- `Complete` — the requested outcome and required proof are finished.

If nothing is currently executing but autonomous work remains, say `Idle`,
explain why, and do not disguise it as active.

Apply the signal to the scope the user asked about. If a long task drifted into
several programs, name the scope in the opening sentence. A documented handoff
does not make the original outcome complete unless the user explicitly changed
the objective to producing that handoff; otherwise report the original outcome
as blocked, waiting, or left. When scope is genuinely ambiguous, give the
narrow and broad verdicts in one sentence instead of silently choosing one.

## Write the quick update

Keep the default around 150-250 words even when the underlying task is large.
Use at most three Done bullets, one Active bullet, three Left items, two
Friction bullets, and two Surprises. Collapse related outcomes before adding
detail. Use short bullets, concrete outcomes, and bold noun labels that the
user can select for follow-up. Omit empty optional sections except `Surprises`,
which should say `None that changed the plan` when the user explicitly asked
about surprises.

Use this shape:

```markdown
**Status — <signal>:** <one-sentence verdict and most important implication>

**Done**

- **<outcome label> (locked in):** <what changed and the strongest compact proof>.

**Active now**

- **<step label>:** <what is running, who/what owns it, and latest liveness>.

**Left**

1. **<next gate>:** <remaining outcome or dependency>.
2. **<later gate>:** <remaining outcome or dependency>.

**Friction**

- **<issue label> (<resolved|recoverable|blocker>):** <cause, impact, response>.

**Surprises**

- **<discovery label>:** <how it changed the plan or risk>.

**Need from you**

- <only a required decision, permission, credential, or external action>.
```

Do not force every section to contain several bullets. Prefer one strong bullet
over a miniature changelog. Include exact PRs, task ids, commands, files, or
artifacts only when they provide useful drill-down anchors.

## Expand only on request

For `detailed`, preserve the same answer-first order, then add only the relevant
detail:

- a workstream-by-workstream state;
- proof run, failure, and skip details;
- resolved versus unresolved issues;
- decisions that changed the execution path;
- remaining acceptance criteria and their dependencies.

Do not repeat the quick summary in longer prose. Keep confirmed facts,
judgment, and unknowns distinguishable.

## Final checks

Before sending, confirm that:

- the opening verdict matches the evidence;
- completed work is not confused with attempted work;
- current activity is genuinely live or clearly labeled idle/stalled;
- remaining work includes the next meaningful proof or decision gate;
- friction explains impact and response, not just an error message;
- surprises are decision-relevant;
- user action appears only when truly required;
- the update can be understood without reading prior commentary.

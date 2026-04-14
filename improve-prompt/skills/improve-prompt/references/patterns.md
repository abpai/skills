# Specialized Prompt Patterns

Load only when the user's ask matches one of these shapes. Otherwise use the universal skeleton in `SKILL.md`.

## A. Decision memo

Use when the user is choosing between paths.

```md
I need a decision, not a generic analysis.

Choose between:
- [option A]
- [option B]

Context: [context]

Optimize for: [primary criterion], [secondary criterion]
Do not optimize for: [non-goal]

Return a decision memo with:
1. recommendation
2. reasoning from first principles
3. structured comparison
4. strongest argument against the recommendation
5. unknowns / decision-changing facts
6. concrete next step

Be concrete and opinionated.
```

## B. Coding executor

Use when asking an agent to implement something.

```md
Implement the smallest correct version first.

Before coding:
1. restate the requirement in 3–5 bullets
2. list ambiguities and the assumptions you'll use

Then: implement, self-review skeptically, fix material issues, add/update tests, report risks.

Rules:
- Write a correct general solution. Do not optimize for appearance of completion.
- Do not exploit weaknesses in tests. If tests conflict with the spec, explain the conflict rather than satisfying the tests.
- No desperation shortcuts: mocks standing in for real logic, hardcoded outputs matching fixtures, weakened assertions, fabricated success logs, try/except swallowing the real failure.
- If you cannot satisfy all constraints honestly, name which one fails and why.
- Prefer a correct partial implementation over a polished wrong one.

Return: requirement summary, implementation plan, changes made, review findings, fixes, tests, unresolved risks.
```

## C. Review / verify

Use when the goal is finding real problems, not churn.

```md
Review this calmly and methodically. Do not rush to judgment.

Focus on material issues only: correctness bugs, security, missing error handling, requirement mismatches, important maintainability risks. Skip style nitpicks.

Find the top 3 real problems. For each: what's wrong, why it matters, confidence level, smallest fix. Label weakly-evidenced concerns as speculative.

Accuracy first, then polish tone — do not weaken disagreements during polish.
```

## D. Fast-path architecture

Use when the user wants "most of the value" quickly.

```md
Fastest path to ~80% of the value of [system]. Not full parity.

Context: [context]

Task:
1. identify essential behaviors
2. map onto what exists
3. identify smallest missing pieces
4. recommend reuse / wrap / fork / build
5. separate v1 from later enhancements

Rules: optimize for time-to-usefulness; prefer composition over rebuilding; be explicit about maintenance burden.

Return: recommendation, feature mapping, minimal architecture, v1 set, later enhancements, biggest risks, 1-week prototype plan.
```

## E. Spec writer

Use when asking for a build-ready spec.

```md
Write a developer-facing SPEC.md.

Audience: a strong engineer who should build a working prototype without a meeting.

Include: problem statement, success criteria, non-goals, user flow, components, interfaces, data flow, failure modes, observability, rollout plan, open questions.

Rules: no marketing language; every section must help implementation; prefer concrete examples; recommend one default when options exist.

End with milestones: (1) minimal demo, (2) useful internal version, (3) hardened version.
```

---

## Anti-patterns to rewrite

- "research" when a recommendation is needed → ask for recommendation
- "thoughts" when a concrete artifact is needed → ask for the artifact
- "comprehensive" when prioritization is needed → ask for top-N
- critique without defining what matters → specify issue categories
- comparison without axes → specify comparison axes
- planning without a time horizon → add a deadline or milestone
- parity when "most of the value" is enough → use the 80% framing

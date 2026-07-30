# Defined Terms

Workflow module for `/engineering:defined-terms` — the ubiquitous-language / DDD glossary workflow.

Extract and formalize domain terminology from the current conversation into a
consistent DDD-style glossary, saved to a local file, so you and the agent share
one vocabulary. Use when the user wants to define domain terms, build a glossary,
harden terminology, create a ubiquitous language, or mentions "domain model" or
"DDD".

## Process

1. **Scan the conversation** for domain-relevant nouns, verbs, and concepts.
2. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
3. **Propose a canonical glossary** with opinionated term choices.
4. **Write to `DEFINED_TERMS.md`** in the working directory using the
   format below. (If the repo already keeps a domain vocabulary file under
   another name — e.g. `CONTEXT.md` for the `improve-architecture`
   workflow — update that instead of creating a parallel one; ask which to use
   if both could apply.)
5. **Output a summary** inline in the conversation.

## Output Format

Write `DEFINED_TERMS.md` with:

- One or more **term tables** (`Term | Definition | Aliases to avoid`).
  Group into multiple tables with their own heading when natural clusters
  emerge (subdomain, lifecycle, actor) — one table is fine for a single
  cohesive domain; don't force groupings.
- A **Relationships** list — bold term names, cardinality expressed where obvious.
- An **Example dialogue** — 3-5 exchanges between a dev and a domain expert
  that clarifies boundaries between related concepts by using terms precisely.
- A **Flagged ambiguities** section calling out conflicting usage with a clear
  recommendation.

See [a full worked example](references/defined-terms-example.md).

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously in the conversation, call it out in the "Flagged ambiguities" section with a clear recommendation.
- **Only include terms relevant for domain experts.** Skip the names of modules or classes unless they have meaning in the domain language.
- **Keep definitions tight.** One sentence max. Define what it IS, not what it does.
- **Only include domain terms.** Skip generic programming concepts (array, function, endpoint) unless they have domain-specific meaning.

## Re-running

When invoked again in the same conversation:

1. Read the existing `DEFINED_TERMS.md`.
2. Incorporate any new terms from subsequent discussion.
3. Update definitions if understanding has evolved.
4. Re-flag any new ambiguities.
5. Rewrite the example dialogue to incorporate new terms.

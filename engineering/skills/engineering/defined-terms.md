# Defined Terms

Workflow module for `/engineering:defined-terms` — the ubiquitous-language / DDD glossary workflow.

Extract and formalize domain terminology from the current conversation into a
consistent DDD-style glossary, saved to a local file, so you and the agent share
one vocabulary. Use when the user wants to define domain terms, build a glossary,
harden terminology, create a ubiquitous language, or mentions "domain model" or
"DDD".

## Process

1. Read [domain-language discovery](references/domain-language.md), then inspect
   the conversation, canonical repository docs, and public code vocabulary.
2. **Identify problems**:
   - Same word used for different concepts (ambiguity)
   - Different words used for the same concept (synonyms)
   - Vague or overloaded terms
3. **Propose a canonical glossary** with opinionated term choices.
4. Update the one canonical vocabulary file discovered above. Create
   `DEFINED_TERMS.md` only when the repository has no established equivalent.
5. **Output a summary** inline in the conversation.

## Output Format

Write `DEFINED_TERMS.md` with:

- One or more **term tables** (`Term | Definition | Aliases to avoid`).
  Group into multiple tables with their own heading when natural clusters
  emerge (subdomain, lifecycle, actor) — one table is fine for a single
  cohesive domain; don't force groupings.
- A **Relationships** list — bold term names, cardinality expressed where obvious.
- An **Example dialogue** only when ambiguity between related concepts needs a
  worked usage example.
- A **Flagged ambiguities** section calling out conflicting usage with a clear
  recommendation.

See [a full worked example](references/defined-terms-example.md).

## Rules

- **Be opinionated.** When multiple words exist for the same concept, pick the best one and list the others as aliases to avoid.
- **Flag conflicts explicitly.** If a term is used ambiguously in the conversation, call it out in the "Flagged ambiguities" section with a clear recommendation.
- **Only include terms relevant for domain experts.** Skip the names of modules or classes unless they have meaning in the domain language.
- **Keep definitions tight.** Include essential behavior or lifecycle only when
  it distinguishes the concept.
- **Only include domain terms.** Skip generic programming concepts (array, function, endpoint) unless they have domain-specific meaning.

## Re-running

When invoked again in the same conversation:

1. Read the existing `DEFINED_TERMS.md`.
2. Incorporate any new terms from subsequent discussion.
3. Update definitions if understanding has evolved.
4. Re-flag any new ambiguities.
5. Rewrite the example dialogue to incorporate new terms.

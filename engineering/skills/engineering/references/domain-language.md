# Domain language

Discover the repository's existing vocabulary before creating or updating a
glossary. Prefer, in order:

1. A maintained glossary linked from the repository's agent or docs index.
2. An established domain-language file such as `docs/GLOSSARY.md`,
   `UBIQUITOUS_LANGUAGE.md`, `DEFINED_TERMS.md`, or `CONTEXT.md`.
3. The repository's existing documentation and public code identifiers.

Use one canonical file. Never create a parallel vocabulary file when a
maintained equivalent exists. If two maintained files compete, report the
conflict and ask which one is authoritative before writing.

Mark definitions inferred from code or conversation as provisional until a
domain authority confirms them. Preserve unrelated human-authored content on
updates. In repositories with multiple bounded contexts, keep context-specific
definitions separate and call out overloaded terms explicitly.

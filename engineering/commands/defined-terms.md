---
description: Build a DDD-style ubiquitous-language glossary from this conversation, flag ambiguities, and save it to DEFINED_TERMS.md.
argument-hint: "[optional focus area or empty to use the whole conversation]"
---

# /engineering:defined-terms

Use the `defined-terms` (ubiquitous-language / DDD glossary) module.

1. Read `skills/engineering/defined-terms.md`.
2. Scan the conversation for domain terms; flag synonyms, ambiguities, and overloaded words.
3. Write the canonical glossary to `DEFINED_TERMS.md` (or update the repo's existing vocabulary file if it has one) and summarize inline.
4. If invoked again in the same conversation, update the existing file instead of starting over.

User input: $ARGUMENTS

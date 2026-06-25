---
name: defined-terms
disable-model-invocation: true
user-invocable: false
metadata:
  internal: true
description: Build a DDD-style ubiquitous-language glossary from this conversation, flag ambiguities, and save it to DEFINED_TERMS.md.
argument-hint: "[optional focus area or empty to use the whole conversation]"
---

# /engineering:defined-terms

Hidden wrapper for the `defined-terms` subcommand. Load the module and pass
through the user input.

1. Read the sibling module `../engineering/defined-terms.md`.
2. Treat `$ARGUMENTS` as the optional focus area; otherwise use the conversation.
3. Follow the module's workflow and stop if the module cannot be read.
4. Preserve the wrapper invariant: update an existing vocabulary file only when it is clearly canonical.

User input: $ARGUMENTS

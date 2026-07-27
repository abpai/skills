# Input-Specific Strategies

Starting heuristics for finding primitives, by input type.

## Codebases

1. Start with the entry points — what gets called first?
2. Trace the critical path for the most common operation
3. Identify data structures that everything revolves around
4. Look for the "God objects" — they often contain multiple primitives fused together
5. Separate domain logic from infrastructure (HTTP, DB, auth, logging)

For multi-repo / polyglot codebases: look for the *conceptual* primitives that
cross language boundaries, not the file-level structure.

## Research Papers / Technical Documents

1. What's the core claim or contribution?
2. What's the minimal setup needed to understand that claim?
3. What's the method, stripped of notation and formalism?
4. What prior work is essential context vs. just literature review?

## Transcripts / Conversations

1. What decisions were made?
2. What were the real alternatives considered (not just mentioned)?
3. What constraints shaped the decisions?
4. What's the underlying model/framework the participants are reasoning from?

## Blog Posts / Articles

1. What's the one idea that, if you understood it, you'd understand the whole piece?
2. What evidence actually supports it vs. is just color?
3. Is there an implicit framework the author is using?

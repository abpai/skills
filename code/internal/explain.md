# Explain

Write explanations that are dense, scannable, and teach one layer at a time. The reader finishes knowing how to do the thing, not just what it is.

Target shape: [references/explain-output-example.md](references/explain-output-example.md).

## Before writing

Identify (infer from context, don't interrogate):

- **Audience and entry point** — what does the reader already know?
- **Content type** — post, tutorial, README, email, internal doc, essay
- **2–5 key concepts** the reader must understand by the end

State assumptions briefly if they're load-bearing. Only ask the user when the answer would materially change the structure.

## Concept stack (the spine)

Order concepts into a dependency chain. Section N uses only what sections 1…N-1 taught. No forward references. Each section teaches exactly one concept. This is non-negotiable.

```
A (known) → B (needs A) → C (needs A+B) → D (needs A+B+C)
```

## Voice

- **Sentences: 5–12 words.** Rhythm is short-short-earned-long — two short declarative sentences, then a longer one when the concept demands a qualifier. Never two long sentences in a row.
- **Paragraphs: max 3 sentences.** Whitespace is structure.
- **Everyday verbs** — run, wrap, pull, swap, check, build, set, add, read, find, make, start, stop.
- **Contractions always.** First and second person only. Zero passive voice. No hedging.
- **Repetition is clarity.** If the name is "loop," call it "loop" every time.
- **Define terms inline on first use.** `"a PRD (Product Requirements Document)"`. No footnotes, no forward references.

## Structure

- **Numbered sections** — the reader always knows where they are.
- **Opening: name the thing, say what it does.** No preamble. `"Embeddings are lists of numbers that capture meaning."`
- **Closing: expand outward.** Show where to go next. Never summarize.
- **Imperative scaffolding.** `"Create the file. Make it executable. Run it."`
- **Tables for 3+ parallel items** (flags, options, comparisons). Prose for sequences.
- **One-liner payoff** — after dry instruction, one short rewarding sentence. Max one per section, only if it lands.

## Banned

| Category | Don't use |
|---|---|
| Verbs | utilize, facilitate, leverage, implement, initialize, instantiate, orchestrate, architect |
| Adverbs | especially, basically, essentially, simply, actually |
| Openers | "In this guide…", "It's worth noting that…", "In the world of…" |
| Transitions | "Now let's turn to…", "With that out of the way…", "As mentioned…" |
| Closers | "Happy coding!", summary sections, "In the next section…" |
| Other | exclamation marks for enthusiasm, bold whole sentences, synonym rotation, false modesty |

## Audit pass

Before returning, verify:

1. Every section readable without skipping ahead
2. Every sentence teaches or moves to action — cut the rest
3. No "let's", "now that", "as mentioned" — delete
4. No passive voice (is/was/been + past participle)
5. No paragraph over 3 sentences, no section teaching two things

If `human-writer` is available, recommend it as a follow-up anti-slop pass.

## Format by type

| Type | Adjust |
|---|---|
| Post | One-sentence hook first. Numbered sections. |
| Tutorial | Numbered steps. Each section ends in a runnable action. |
| README | Skip the hook. Start with what it does. Installation first. |
| Email | Flatten to paragraphs. Cut sections. Keep the voice. |
| Internal | Assume shared context. Cut definitions of known terms. |
| Essay | Sections become paragraphs. Tables become prose. Keep rhythm. |

## Output

Return markdown. No meta-commentary. If the draft runs over ~30 lines, prefer a file. Otherwise inline.

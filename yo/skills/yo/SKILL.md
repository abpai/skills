---
name: yo
disable-model-invocation: false
description: Run one of the user's quick steering prompts (recap, status, tldr, readback, explain, educate, check, clean-room, close, ok, sharpen, tasks, facts, align, verify, too-complex, no-back, ascii, tts, ste100) only when the user names it ("yo recap", "do a tldr", "no-back") or asks for exactly that behavior. Never pick one unprompted.
argument-hint: "<prompt> [extra input] - e.g. recap, tldr, check, clean-room"
license: MIT
metadata:
  author: Andy Pai
  version: "1.1.0"
---

# yo

Take the first token of `$ARGUMENTS` as the prompt name, strip a leading `/`
and then a leading `yo:`, and match it case-insensitively against the prompts
in the table below (not `yo` itself). Read `../<name>/SKILL.md` (a sibling of
this skill's folder), follow its body as the user's instruction for this turn,
and treat the remaining arguments as extra input to it. The wording of each
prompt exists only in that file.

| Prompt | What it does |
| --- | --- |
| `recap` | Two or three sentences on what we've been doing |
| `status` | Done and remaining, in short bullets |
| `tldr` | Keep answers strictly TL;DR from here on |
| `tts` | Easy-to-listen summary for text-to-speech |
| `readback` | Read back outcome, scope, constraints, done criteria before work starts |
| `align` | Short answers while we check we're aligned |
| `explain` | Plain-language explanation of a change or concept |
| `educate` | Teach it step by step |
| `check` | Fresh-eyes check of the work, without editing |
| `verify` | Correct my mental model, name the step I'm missing |
| `clean-room` | Unbiased verdict from a fresh agent that never saw this conversation |
| `close` | Is it safe to close this thread |
| `ok` | Go ahead with what you recommended |
| `sharpen` | Frame the task like an expert, then do it |
| `tasks` | Full list of next steps |
| `facts` | The few critical facts and implications |
| `too-complex` | Is the complexity justified |
| `no-back` | Drop backward compatibility |
| `ascii` | Plain-ASCII flow diagram or status board |
| `ste100` | Answer in ASD-STE100 Simplified Technical English |

When the arguments are empty or the first token matches none of these, list
the prompt names and ask which one. Run a prompt only when the user named it or
asked for exactly that behavior; never start one unprompted. If the file cannot
be read, report it and stop.

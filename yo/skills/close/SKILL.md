---
name: close
disable-model-invocation: true
description: "Is it safe to close this thread, or would something be lost?"
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  internal: true
---

OK to close this thread? Answer yes or no first. Check what closing would lose: uncommitted or unpushed changes, processes or background tasks still running, questions I asked that you haven't answered, things you stated as fact without checking, and follow-ups that exist only in this conversation. Inspect state with read-only commands, but change nothing and start or stop nothing. If no, list each blocker with the smallest step that clears it, and mark the ones that need my decision. If yes, answer in one line.

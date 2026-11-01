---
name: ascii
disable-model-invocation: true
description: "Plain-ASCII flow diagram or task status board."
license: MIT
metadata:
  author: Andy Pai
  version: "1.0.0"
  internal: true
---

Show this visually in plain ASCII, without Mermaid or HTML. For a plan, feature, or workflow, use compact boxes and -> arrows; show before/after when useful. For tasks or progress, use an aligned status board grouped by phase, with one row per task: [done], [doing], [blocked], [todo], or [unknown], plus a short note. Show dependencies as "waits on X". Use only verified status; mark uncertainty explicitly. End with "WAITING ON YOU" or "RUNNING NOW" only when relevant. Aim for 80 columns and avoid repeating the visual in prose.

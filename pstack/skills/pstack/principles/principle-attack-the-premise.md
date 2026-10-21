# Attack the premise

When repeated fixes rely on the same assumption and keep failing:

- **Name the assumption.** Write the belief the failed fixes share.
- **Test it.** Find an observation that would differ if the assumption were
  false. Make the check rerunnable with [Script Bulk Operations](principle-script-bulk-operations.md).
- **Follow the evidence.** If it contradicts the assumption, reconsider the
  diagnosis. If it supports the assumption, continue tracing the cause with
  [Fix Root Causes](principle-fix-root-causes.md).
- **Remove the cause.** Fix the faulty condition instead of repeatedly working
  around it, following [Laziness Protocol](principle-laziness-protocol.md).

**Stop:** Write down and test the assumption before attempting another fix.

This principle challenges an assumption. [Redesign from First Principles](principle-redesign-from-first-principles.md)
reconsiders a design when a new requirement no longer fits it cleanly.

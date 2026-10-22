# Fix root causes

Trace a problem from its visible symptom to the first wrong decision or valid
situation the code failed to handle. Reproduce it or gather evidence that
distinguishes possible causes before choosing a fix.

Fix where the fault starts. A defensive check or retry belongs where it handles
a valid condition, rather than hiding a state the system should never produce.
If the cause is still uncertain, say what to investigate next.

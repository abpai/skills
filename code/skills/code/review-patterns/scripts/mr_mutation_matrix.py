#!/usr/bin/env python3
"""mr_mutation_matrix.py — placebo detector for a metamorphic / property suite.

Ported from jeffery-skills/testing-metamorphic references/COMPOSITION.md
(validate_mr_suite + the mutation-operator enum). A green MR suite proves
NOTHING on its own: MRs are necessary, not sufficient (a constant-return impl
passes sin(x)=sin(x)). The only proof a suite is real is mutation evidence —
each planted bug must be caught (the relation must FAIL) by >=1 MR.

This is a harness/template, not a turnkey runner: you wire `build_mutants` to
your code under test, then it builds the MR x mutation detection matrix, asserts
every mutation is killed by >=1 relation, and prints the kill-rate. Target >=80%
kill-rate, OR a written equivalent-mutant argument for survivors.

The seven canonical mutation operators (verbatim from the source enum):
  off-by-one, sign-flip, zero-out, double, swap-args, drop-element,
  constant-return.

Usage:
    Edit MUTATIONS / wire `run_relation(mr, mutant) -> bool` (True = relation
    held, i.e. mutant NOT caught), then:  python3 mr_mutation_matrix.py
"""
from __future__ import annotations
import sys

# The seven canonical mutation operators from COMPOSITION.md. Keep this list;
# add domain-specific operators (e.g. drop-where-clause for SQL) as needed.
MUTATIONS = [
    "off-by-one",     # |x| x + 1
    "sign-flip",      # |x| -x
    "zero-out",       # |_| 0
    "double",         # |x| x * 2
    "swap-args",      # f(a, b) -> f(b, a)
    "drop-element",   # remove last element
    "constant-return",# always return same value  (the placebo-killer)
]


def build_detection_matrix(relations, mutations, relation_holds):
    """relation_holds(mr_name, mutation_name) -> bool.

    Returns True when the relation still HELD under the mutation (bug survived).
    A mutation is *caught/killed* when at least one relation FAILS (returns
    False) for it. detection[mr][mut] = True means that MR killed that mutant.
    """
    return {
        mr: {mut: (not relation_holds(mr, mut)) for mut in mutations}
        for mr in relations
    }


def report(relations, mutations, detection):
    killed = [m for m in mutations
              if any(detection[mr][m] for mr in relations)]
    survivors = [m for m in mutations if m not in killed]
    rate = 100.0 * len(killed) / len(mutations) if mutations else 0.0

    print("MR x mutation detection matrix (X = mutant killed by this relation):")
    width = max((len(m) for m in mutations), default=4)
    header = "relation".ljust(24) + "".join(m.ljust(width + 2) for m in mutations)
    print(header)
    for mr in relations:
        row = mr.ljust(24)
        for m in mutations:
            row += ("X" if detection[mr][m] else ".").ljust(width + 2)
        print(row)

    print()
    print(f"kill-rate: {len(killed)}/{len(mutations)} ({rate:.0f}%)")
    if survivors:
        print("SURVIVORS (uncaught — add a stronger relation OR write an "
              "equivalent-mutant argument):")
        for m in survivors:
            print(f"  - {m}")
    if rate < 80.0:
        print("PLACEBO RISK: kill-rate < 80%. A relation suite that does not "
              "kill planted bugs is decorative.", file=sys.stderr)
        return 1
    return 0


def _demo():
    relations = ["mr_permutation_invariance", "mr_scaling_linearity",
                 "mr_roundtrip"]

    # WIRE THIS to your real code: return True iff the relation still held
    # when the mutation was applied (i.e. the mutant was NOT caught). This stub
    # claims every relation holds under every mutation -> 0% kill-rate, which is
    # exactly the placebo a real suite must avoid.
    def relation_holds(mr, mutation):
        return True  # <-- replace with real evaluation against build_mutants()

    detection = build_detection_matrix(relations, MUTATIONS, relation_holds)
    return report(relations, MUTATIONS, detection)


if __name__ == "__main__":
    print("Template harness — wire relation_holds() to the code under test.\n")
    sys.exit(_demo())

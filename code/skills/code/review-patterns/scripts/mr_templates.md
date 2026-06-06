# Copy-paste MR templates + relative-epsilon helper

Ported from jeffery-skills/testing-metamorphic references/QUICK-REFERENCE.md and
ANTI-PATTERNS.md. proptest/Hypothesis-style skeletons for the three most common
relation shapes, plus the float-comparison helper that prevents the most common
reason MR suites get abandoned. Drop one in, name it after the property it
verifies (never `test_mr_1`), and generate inputs property-based (not curated
edge cases).

## Relative epsilon (use for ALL float relations)

Exact `==` on floats (e.g. `sin(x) == sin(PI - x)`) throws false failures that
kill trust in the whole suite. Absolute epsilon breaks at scale; prefer the
relative form:

```rust
// eps scales with operand magnitude, with an absolute floor near zero.
let eps = f64::max(a.abs(), b.abs()) * 1e-12 + 1e-15;
assert!((a - b).abs() < eps, "relation violated: {a} vs {b}");
```

```python
def approx_eq(a, b):
    eps = max(abs(a), abs(b)) * 1e-12 + 1e-15
    return abs(a - b) < eps
```

## Equivalence — f(T(x)) = f(x)

```rust
proptest!(|(input: InputType)| {
    let original = f(&input);
    let transformed = f(&transform(&input));   // transform must be real, not identity
    prop_assert_eq!(original, transformed, "Equivalence MR violated");
});
```

## Subset / Inclusive — f(restrict(x)) ⊆ f(x)

```rust
proptest!(|(base: Query, restriction: Filter)| {
    let broad = search(&base);
    let narrow = search(&base.with_filter(&restriction));
    for item in &narrow {
        prop_assert!(broad.contains(item),
            "Subset MR violated: narrow result not in broad");
    }
});
```

## Round-trip — parse(serialize(x)) = x  /  decrypt(encrypt(x)) = x

```rust
proptest!(|(value: MyType)| {
    let encoded = serialize(&value);
    let decoded = deserialize(&encoded).unwrap();
    prop_assert_eq!(value, decoded, "Round-trip MR violated");
});
```

## Composition (free fault-sensitivity, with an order caveat)

`MR₁∘MR₂` is valid if both are, and a chain catches faults no single relation
does. But composition ORDER matters — `MR₁∘MR₂` may differ in fault detection
from `MR₂∘MR₁` (Chen et al.). When you chain, justify the order.

# p11-order-fulfilment — principle coverage: redesign when a requirement no longer fits

- Mode: plan. Language: TypeScript (bun). Fixture: `fixtures/p11-order-fulfilment`.
- Invocation: `pstack plan Orders can now ship in several parcels. Add partial shipments: ship(order, itemIds, trackingNumber) ships some line items; customers should see "Partially shipped (2 of 3 items)" until everything has shipped; cancellation is only allowed before anything has shipped; refunds only after delivery.`

## Ground truth (hidden)

- Current model: five order-level booleans (`isPaid`, `isShipped`,
  `isDelivered`, `isCancelled`, `isRefunded`), one `trackingNumber`, and a
  cached `statusLabel` updated by hand via `updateLabel()`. Per-item shipment
  state and multiple tracking numbers do not fit; invalid flag combinations are
  representable (e.g. delivered + cancelled). `refund()` already forgets
  `updateLabel` → stale label (`data/orders.json` o-103: refunded but "Delivered").
- `cancel()` currently allows cancelling after shipping (before delivery) —
  conflicts with the new rule; `toCustomerView.canCancel`/`canRequestRefund`
  must change.
- Persisted documents use the boolean shape (`data/orders.json`, "same shape in
  production") → stored orders need a conversion when the shape changes.
- Good direction: model shipment per line item (or parcels with item ids +
  tracking) and an explicit payment/cancel/refund state; derive status label and
  allowed actions from that state (remove cached `statusLabel`); discriminated
  union / state table; convert stored documents; update view and tests.

## PASS (all required)

1. Recognizes the boolean/single-tracking design no longer fits and plans a
   reshaped model (per-item or per-parcel shipment state) rather than adding
   `isPartiallyShipped`/`shippedItemIds` alongside the booleans.
2. Derives the customer status (and can-cancel/can-refund) from state instead of
   the cached `statusLabel`; notes the existing stale-label problem or removes the cache.
3. Covers the new rules: cancel only before any shipment; refund only after delivery
   (and what "delivered" means with multiple parcels — open question acceptable).
4. Addresses persisted documents (conversion of existing `data/orders.json` shape).
5. Ordered, checkable steps; concise; run-dir unchanged.

## FAIL (any)

- Bolts on new flags/fields while keeping the five booleans + cached label.
- Ignores stored data shape.
- Writes the implementation.

## Principles

- Should select: **Redesign from first principles**, **Model the domain**,
  Minimize reader load (cached label / derived values), Type system discipline.
- Neutral: Sequence verifiable units, Subtract before you add, Test behavior,
  Prioritize usability (customer-facing wording).
- Padding: Exhaust the design space (no novel UI), Explain the number, Make
  operations idempotent, Separate before serializing shared state, Script bulk
  operations, Attack the premise, Migrate callers then delete legacy APIs.

// Module under test for the prune-tests fixture. Sent to the model as context.
// The model is asked to prune the TEST file, never to change this.

export function add(a, b) {
  return a + b
}

/** Rejects a token whose exp is in the past. Security/identity guard. */
export function verifyToken(token, now) {
  if (!token || typeof token.exp !== "number") return { ok: false, status: 401 }
  if (token.exp <= now) return { ok: false, status: 401 }
  return { ok: true, status: 200 }
}

/** Public /v1/orders response. The field set is a wire contract. */
export function orderResponse(order) {
  return { id: order.id, total: order.total, currency: order.currency, status: order.status }
}

/**
 * Beta pricing rounding: half-up to 2dp. Gated behind FEATURE_BETA_PRICING.
 *
 * Scales through a fixed-point string first: `1.005 * 100` is 100.49999999999999
 * in binary floating point, so rounding the raw product gives 1.00 rather than
 * the 1.01 a price is expected to round to.
 */
export function roundPrice(value) {
  return Math.round(Number((value * 100).toFixed(6))) / 100
}

// Fixture input for the code:simplify outcome eval. This file is SENT TO THE
// MODEL verbatim inside the prompt. Nothing here is secret.
//
// It is deliberately verbose in ways a simplification pass should clean up —
// repeated ternaries, a redundant intermediate, a switch that could be a map —
// while carrying three subtleties that a careless pass destroys. The hidden
// suite (hidden.test.js, never shown to the model) targets exactly those three.
// If the fixture were merely wordy, every model would simplify it correctly and
// the eval would pass forever without discriminating anything.
//
// TRAP A  `limit` accepts 0. Collapsing `!== undefined && !== null` into a
//         truthiness check (`input.limit ? ... : 60`) silently rewrites a
//         caller's "allow nothing" into the default 60.
// TRAP B  The empty-window early return is load-bearing. Without it the reduce
//         below runs on an empty array with no seed and throws.
// TRAP C  `warn` uses >= and `block` uses >. The branches look duplicated and
//         invite collapsing into one, which moves the block boundary by one
//         request.

export function normalizeConfig(input) {
  const out = {}

  if (input.limit !== undefined && input.limit !== null) {
    out.limit = input.limit
  } else {
    out.limit = 60
  }

  if (input.burst !== undefined && input.burst !== null) {
    out.burst = input.burst
  } else {
    out.burst = 10
  }

  const windows = input.windows === undefined ? [] : input.windows
  if (windows.length === 0) {
    out.windowMs = 1000
    return out
  }

  const total = windows.reduce(function (acc, w) {
    return acc + w
  })
  out.windowMs = Math.round(total / windows.length)

  return out
}

export function classify(count, config) {
  let result
  if (count >= config.limit) {
    result = "warn"
  } else {
    result = "ok"
  }
  if (count > config.limit + config.burst) {
    result = "block"
  } else {
    result = result
  }
  return result
}

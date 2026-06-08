/**
 * assert-test-mode.ts — production-safety blocklist for real-service tests.
 *
 * Ported from jeffery-skills testing-real-service-e2e-no-mocks
 * (references/PAYMENT-TESTING.md `assertTestMode` + SKILL.md Pattern 4
 * `getRealDbConfig` + `provision-test-env.ts --check`).
 *
 * Run as a pre-flight gate BEFORE any real-service call so a test harness can
 * never charge real money or mutate real data:
 *
 *   bun review-patterns/scripts/assert-test-mode.ts        # check process.env
 *
 * Exit 0 = safe (test/sandbox target). Exit 1 = a production indicator was
 * found; the offending key/value is printed. This is the executable form of the
 * lens's "confirm a safe target" step — it is greppable where "safe target" is
 * not.
 */

// String-match safety net. Any env value containing one of these blocks the run.
const PROD_INDICATORS = [
  "sk_live_", // Stripe live secret key
  "pk_live_", // Stripe live publishable key
  "production", // PayPal env / generic prod flag
];

// Hard-coded production URL denylist. Replace with your real prod hosts.
const PROD_URLS = [
  // "https://<your-prod-project>.supabase.co",
  // "https://auth.<your-domain>",
];

export function assertTestMode(env: Record<string, string | undefined>): void {
  for (const indicator of PROD_INDICATORS) {
    for (const [key, value] of Object.entries(env)) {
      if (typeof value === "string" && value.includes(indicator)) {
        throw new Error(
          `SAFETY: ${key} contains production indicator "${indicator}". ` +
            `Use test/sandbox keys (sk_test_*, pk_test_*, sandbox) for testing.`,
        );
      }
    }
  }

  if (env.NODE_ENV === "production") {
    throw new Error("SAFETY: NODE_ENV=production — refusing to run real-service tests.");
  }

  const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL ?? env.SUPABASE_URL ?? "";
  if (PROD_URLS.includes(supabaseUrl)) {
    throw new Error(`SAFETY: target URL ${supabaseUrl} is in the production denylist.`);
  }

  // Positive assertions: require explicit test-mode markers when present.
  if (env.STRIPE_SECRET_KEY && !env.STRIPE_SECRET_KEY.startsWith("sk_test_")) {
    throw new Error("SAFETY: STRIPE_SECRET_KEY is not an sk_test_* key.");
  }
  if (env.PAYPAL_ENV && env.PAYPAL_ENV !== "sandbox") {
    throw new Error(`SAFETY: PAYPAL_ENV=${env.PAYPAL_ENV} is not "sandbox".`);
  }
}

// CLI entry: validate process.env and exit non-zero on any prod indicator.
if (import.meta.main) {
  try {
    assertTestMode(process.env as Record<string, string | undefined>);
    console.error("assert-test-mode: OK (test/sandbox target, NODE_ENV != production)");
    process.exit(0);
  } catch (e) {
    console.error(String((e as Error).message));
    process.exit(1);
  }
}

/**
 * real-service-harness.ts — drop-in helpers for collecting the smallest safe
 * real-service proof: transaction-rollback DB isolation, a signed Stripe
 * webhook, and a LIFO cleanup registry for tests that can't roll back.
 *
 * Ported from jeffery-skills testing-real-service-e2e-no-mocks:
 *   - withTestTransaction / getTestDb  -> references/TRANSACTION-ISOLATION.md
 *   - createSignedWebhook              -> references/PAYMENT-TESTING.md
 *   - CleanupRegistry (LIFO)           -> SKILL.md Pattern 6
 *
 * These are reference implementations to paste/adapt into the target repo's
 * test utils — not a runnable standalone (imports depend on the project's ORM).
 */

import crypto from "node:crypto";
// import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
// import postgres from "postgres";
// import { beforeAll, beforeEach, afterEach, afterAll } from "vitest";
// import * as schema from "@/lib/db/schema";

// ---------------------------------------------------------------------------
// 1. Transaction-rollback isolation. BEGIN+SAVEPOINT per test, ROLLBACK after.
//    CRITICAL: a SINGLE connection (max: 1, idle_timeout: 0) is required —
//    transaction isolation breaks silently on a normal pool.
// ---------------------------------------------------------------------------
/*
let testSqlClient: postgres.Sql | null = null;
let testDb: PostgresJsDatabase<typeof schema> | null = null;

export function withTestTransaction(_opts?: { suiteName?: string }) {
  beforeAll(async () => {
    testSqlClient = postgres(process.env.TEST_DATABASE_URL!, {
      prepare: false,
      max: 1,          // Single connection — transaction isolation REQUIRES it.
      idle_timeout: 0, // Keep alive for the whole suite.
    });
    testDb = drizzle(testSqlClient, { schema });
  });

  beforeEach(async () => {
    await testSqlClient!`BEGIN`;
    await testSqlClient!`SAVEPOINT test_savepoint`;
  });

  afterEach(async () => {
    try {
      await testSqlClient!`ROLLBACK TO SAVEPOINT test_savepoint`;
      await testSqlClient!`ROLLBACK`;
    } catch {
      // Connection may already be closed on test crash.
    }
  });

  afterAll(async () => {
    if (testSqlClient) {
      await testSqlClient.end();
      testSqlClient = null;
      testDb = null;
    }
  });
}

export function getTestDb(): PostgresJsDatabase<typeof schema> {
  if (!testDb) throw new Error("Call withTestTransaction() in your describe block first");
  return testDb;
}
*/
//
// Rollback does NOT isolate for: COMMIT-behavior tests, DDL (CREATE TABLE
// auto-commits in PG), connection-pool tests, replication, or cross-service
// tests. Use an isolated DB (CREATE DATABASE <name> TEMPLATE <base>) for the
// first four, and the CleanupRegistry below for cross-service tests.

// ---------------------------------------------------------------------------
// 2. Signed Stripe webhook — exercise the real signature-verification path
//    without a live delivery. HMAC-SHA256 over `${timestamp}.${body}`.
// ---------------------------------------------------------------------------
export function createSignedWebhook(payload: object, secret: string) {
  const body = JSON.stringify(payload);
  const timestamp = Math.floor(Date.now() / 1000);
  const signedPayload = `${timestamp}.${body}`;
  const signature = crypto.createHmac("sha256", secret).update(signedPayload).digest("hex");

  return {
    body,
    headers: {
      "stripe-signature": `t=${timestamp},v1=${signature}`,
      "content-type": "application/json",
    },
  };
}

// ---------------------------------------------------------------------------
// 3. Cleanup registry for tests that can't roll back. Delete in REVERSE (LIFO)
//    order so FK constraints are respected — naive forward cleanup errors out.
// ---------------------------------------------------------------------------
export class CleanupRegistry {
  private entries: Array<{ type: string; id: string }> = [];

  track(type: string, id: string): void {
    this.entries.push({ type, id });
  }

  async cleanup(
    deleteByType: (type: string, id: string) => Promise<void>,
  ): Promise<{ cleaned: number; failed: number }> {
    let cleaned = 0;
    let failed = 0;
    // LIFO: reverse so children are deleted before parents (FK-safe).
    for (const entry of this.entries.reverse()) {
      try {
        await deleteByType(entry.type, entry.id);
        cleaned++;
      } catch {
        failed++;
      }
    }
    this.entries = [];
    return { cleaned, failed };
  }
}

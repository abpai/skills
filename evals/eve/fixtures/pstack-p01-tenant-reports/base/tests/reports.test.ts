import { expect, test } from "bun:test";
import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileNameFor, reportFor, writeTenantReports } from "../src/reports";
import type { Tenant } from "../src/tenants";

const WORDS = ["acme", "globex", "initech", "umbrella", "hooli", "stark"];
const SEPARATORS = [" ", "-", ".", " & "];
const PLANS: Tenant["plan"][] = ["free", "team", "enterprise"];

const pick = <T>(items: T[]): T => items[Math.floor(Math.random() * items.length)];
const capitalize = (w: string) => w[0].toUpperCase() + w.slice(1);

function randomTenants(count: number): Tenant[] {
  const names = new Set<string>();
  while (names.size < count) {
    names.add(`${capitalize(pick(WORDS))}${pick(SEPARATORS)}${capitalize(pick(WORDS))}`);
  }
  return [...names].map((name, i) => ({
    id: `t_${2000 + i}`,
    name,
    plan: pick(PLANS),
    usage: [{ day: "2026-10-01", apiCalls: Math.floor(Math.random() * 1000), storageMb: 10 }],
  }));
}

async function withRetry(fn: () => Promise<void>, attempts = 3): Promise<void> {
  for (let i = 1; ; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i >= attempts) throw err;
    }
  }
}

test("fileNameFor produces a safe file name", () => {
  const tenant: Tenant = { id: "t_1", name: "Acme Corp", plan: "free", usage: [] };
  expect(fileNameFor(tenant)).toBe("acme_corp.csv");
});

test("reportFor includes a totals row", () => {
  const tenant: Tenant = {
    id: "t_1",
    name: "Acme",
    plan: "team",
    usage: [
      { day: "2026-10-01", apiCalls: 5, storageMb: 1 },
      { day: "2026-10-02", apiCalls: 7, storageMb: 2 },
    ],
  };
  expect(reportFor(tenant).trim().split("\n").at(-1)).toBe("total,12,3");
});

test("writes one report per tenant", async () => {
  await withRetry(async () => {
    const dir = await mkdtemp(join(tmpdir(), "reports-"));
    const tenants = randomTenants(10);
    const written = await writeTenantReports(tenants, dir);
    const files = await readdir(dir);
    expect(written).toHaveLength(tenants.length);
    expect(files).toHaveLength(tenants.length);
    for (const path of written) {
      expect((await readFile(path, "utf8")).startsWith("day,api_calls,storage_mb")).toBe(true);
    }
  });
}, 10_000);

import os, sys
sys.path.insert(0, os.path.dirname(__file__))
from mk import fixture_root, write_tree, commit

root = fixture_root("p01-tenant-reports")
base = {}
base[".gitignore"] = "out/\nnode_modules/\n"
base["README.md"] = r'''
# tenant-reports

Nightly job that writes one usage CSV per tenant. The files in `out/` are then
synced to each tenant's download area, keyed by file name.

```sh
bun src/cli.ts data/tenants.json out/
bun test
```
'''
base["package.json"] = r'''
{
  "name": "tenant-reports",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "bun test",
    "reports": "bun src/cli.ts"
  }
}
'''
base["data/tenants.json"] = r'''
[
  { "id": "t_1001", "name": "Acme Corp", "plan": "enterprise",
    "usage": [{ "day": "2026-10-01", "apiCalls": 1200, "storageMb": 340 }, { "day": "2026-10-02", "apiCalls": 980, "storageMb": 342 }] },
  { "id": "t_1002", "name": "Globex", "plan": "team",
    "usage": [{ "day": "2026-10-01", "apiCalls": 310, "storageMb": 52 }] },
  { "id": "t_1003", "name": "Initech", "plan": "free",
    "usage": [{ "day": "2026-10-01", "apiCalls": 12, "storageMb": 1 }] },
  { "id": "t_1004", "name": "Hooli & Partners", "plan": "team",
    "usage": [{ "day": "2026-10-01", "apiCalls": 450, "storageMb": 77 }] },
  { "id": "t_1005", "name": "Acme-Corp", "plan": "free",
    "usage": [{ "day": "2026-10-01", "apiCalls": 3, "storageMb": 0 }] }
]
'''
base["src/tenants.ts"] = r'''
export interface UsageRow {
  day: string;
  apiCalls: number;
  storageMb: number;
}

export interface Tenant {
  id: string;
  name: string;
  plan: "free" | "team" | "enterprise";
  usage: UsageRow[];
}

export async function loadTenants(path: string): Promise<Tenant[]> {
  const raw = await Bun.file(path).json();
  if (!Array.isArray(raw)) throw new Error(`${path}: expected an array of tenants`);
  return raw as Tenant[];
}
'''
base["src/csv.ts"] = r'''
export type Cell = string | number;

function quote(cell: Cell): string {
  const text = String(cell);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(quote).join(",")).join("\n") + "\n";
}
'''
base["src/reports.ts"] = r'''
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { toCsv } from "./csv";
import type { Tenant } from "./tenants";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function fileNameFor(tenant: Tenant): string {
  return tenant.name.toLowerCase().replace(/[^a-z0-9]+/g, "_") + ".csv";
}

export function reportFor(tenant: Tenant): string {
  const rows = tenant.usage.map((u) => [u.day, u.apiCalls, u.storageMb]);
  const totals = tenant.usage.reduce(
    (acc, u) => [acc[0] + u.apiCalls, acc[1] + u.storageMb],
    [0, 0],
  );
  return toCsv(["day", "api_calls", "storage_mb"], [...rows, ["total", totals[0], totals[1]]]);
}

export async function writeTenantReports(tenants: Tenant[], outDir: string): Promise<string[]> {
  await mkdir(outDir, { recursive: true });
  const written: string[] = [];
  for (const tenant of tenants) {
    const path = join(outDir, fileNameFor(tenant));
    await writeFile(path, reportFor(tenant));
    // Give the filesystem a moment to flush before the next write.
    await delay(50);
    written.push(path);
  }
  return written;
}
'''
base["src/cli.ts"] = r'''
import { loadTenants } from "./tenants";
import { writeTenantReports } from "./reports";

const [input, outDir] = process.argv.slice(2);
if (!input || !outDir) {
  console.error("usage: bun src/cli.ts <tenants.json> <out-dir>");
  process.exit(2);
}

const tenants = await loadTenants(input);
const written = await writeTenantReports(tenants, outDir);
console.log(`wrote ${written.length} reports to ${outDir}`);
'''
base["tests/csv.test.ts"] = r'''
import { expect, test } from "bun:test";
import { toCsv } from "../src/csv";

test("quotes cells containing commas and quotes", () => {
  expect(toCsv(["a", "b"], [["x,y", 'say "hi"']])).toBe('a,b\n"x,y","say ""hi"""\n');
});

test("leaves plain cells alone", () => {
  expect(toCsv(["n"], [[1], [2]])).toBe("n\n1\n2\n");
});
'''
base["tests/reports.test.ts"] = r'''
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
'''

write_tree(root, base)
commit(root)

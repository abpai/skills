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

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

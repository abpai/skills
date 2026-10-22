import { ConfigError, loadConfig } from "./config";
import { bunExec, runJob } from "./runner";

const path = process.argv[2] ?? "jobs.json";

try {
  const config = await loadConfig(path);
  let failed = 0;
  for (const job of config.jobs) {
    const outcome = await runJob(job, bunExec, (ms) => Bun.sleep(ms));
    console.log(`${outcome.ok ? "ok  " : "FAIL"} ${outcome.name} (${outcome.attempts} attempt(s))`);
    if (!outcome.ok) failed++;
  }
  process.exit(failed ? 1 : 0);
} catch (err) {
  if (err instanceof ConfigError) {
    console.error(`${path}: ${err.message}`);
    process.exit(2);
  }
  throw err;
}

import { bus } from "../src/bus";
import { resetDunning } from "../src/jobs/dunning";
import { registerAll } from "../src/register";
import { resetStore } from "../src/store";
import { trail } from "../src/audit/trail";
import { counters } from "../src/metrics/counters";

export function fresh(): void {
  bus.reset();
  resetStore();
  resetDunning();
  trail.length = 0;
  for (const key of Object.keys(counters)) delete counters[key];
  registerAll();
}

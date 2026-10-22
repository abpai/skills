import { registerAudit } from "./audit/trail";
import { registerCleanup } from "./jobs/cleanup";
import { registerDunning } from "./jobs/dunning";
import { registerCounters } from "./metrics/counters";
import { registerFrozenNotice } from "./notify/frozen";
import { registerGoodbye } from "./notify/goodbye";
import { registerReceipts } from "./notify/receipts";
import { registerWelcome } from "./notify/welcome";

export function registerAll(): void {
  registerWelcome();
  registerGoodbye();
  registerFrozenNotice();
  registerReceipts();
  registerDunning();
  registerCleanup();
  registerAudit();
  registerCounters();
}

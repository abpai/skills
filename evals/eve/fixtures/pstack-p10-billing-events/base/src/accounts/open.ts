import { bus } from "../bus";
import { Events } from "../events";
import { accounts, type Account } from "../store";

export async function openAccount(id: string, plan: Account["plan"]): Promise<Account> {
  const account: Account = { id, plan, status: "open", limitCents: plan === "starter" ? 50_000 : 500_000 };
  accounts.set(id, account);
  await bus.emit(Events.AcctOpened, { accountId: id, plan });
  return account;
}

import { bus } from "../bus";
import { Events } from "../events";
import { accounts, invoices } from "../store";

export async function issueInvoice(id: string, accountId: string, totalCents: number): Promise<void> {
  const account = accounts.get(accountId);
  if (!account || account.status !== "open") throw new Error(`account ${accountId} cannot be invoiced`);
  invoices.set(id, { id, accountId, totalCents, status: "issued" });
  await bus.emit(Events.InvoiceIssued, { invoiceId: id, accountId, totalCents });
}

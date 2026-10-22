import { bus } from "../bus";
import { invoices } from "../store";

export async function settleInvoice(id: string, result: { ok: true } | { ok: false; code: string }) {
  const invoice = invoices.get(id);
  if (!invoice) throw new Error(`no invoice ${id}`);
  if (result.ok) {
    invoice.status = "paid";
    await bus.emit("invoice.paid", { invoiceId: id, accountId: invoice.accountId });
  } else {
    invoice.status = "failed";
    await bus.emit("payment.failed", { invoiceId: id, accountId: invoice.accountId, code: result.code });
  }
}

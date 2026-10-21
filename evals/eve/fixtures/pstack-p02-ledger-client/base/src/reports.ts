import { fetchJson } from "./lib/http";

export interface MonthlySummary {
  accountId: string;
  month: string;
  inflowCents: number;
  outflowCents: number;
}

export function getMonthlySummary(accountId: string, month: string): Promise<MonthlySummary> {
  return fetchJson<MonthlySummary>(`/accounts/${encodeURIComponent(accountId)}/summary`, {
    query: { month },
  });
}

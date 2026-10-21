import { legacyRequest } from "./lib/http";

export interface Change {
  seq: number;
  entity: "account" | "transaction" | "payee";
  id: string;
}

interface ChangePage {
  changes: Change[];
  next: string | null;
}

export function pullChanges(cursor: string): Promise<{ changes: Change[]; cursor: string }> {
  return new Promise((resolve, reject) => {
    const collected: Change[] = [];
    const fetchPage = (pageCursor: string) => {
      legacyRequest({ path: "/changes", query: { cursor: pageCursor } }, (err, data) => {
        if (err) return reject(err);
        const page = data as ChangePage;
        collected.push(...page.changes);
        if (page.next) fetchPage(page.next);
        else resolve({ changes: collected, cursor: pageCursor });
      });
    };
    fetchPage(cursor);
  });
}

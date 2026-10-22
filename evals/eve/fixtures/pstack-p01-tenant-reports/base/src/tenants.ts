export interface UsageRow {
  day: string;
  apiCalls: number;
  storageMb: number;
}

export interface Tenant {
  id: string;
  name: string;
  plan: "free" | "team" | "enterprise";
  usage: UsageRow[];
}

export async function loadTenants(path: string): Promise<Tenant[]> {
  const raw = await Bun.file(path).json();
  if (!Array.isArray(raw)) throw new Error(`${path}: expected an array of tenants`);
  return raw as Tenant[];
}

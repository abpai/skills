export type Cell = string | number;

function quote(cell: Cell): string {
  const text = String(cell);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((row) => row.map(quote).join(",")).join("\n") + "\n";
}
